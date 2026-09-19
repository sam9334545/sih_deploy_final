from __future__ import annotations

import time
from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_port, resolve_as_of
from app.errors import InfeasibleRequestError, InvalidInput, NotFound
from app.repositories import reference as ref_repo
from app.schemas.requests import RecommendVesselRequest
from app.schemas.responses import RecommendVesselResponse, VesselClassOut
from app.services import optimizer, scenario, simulator

router = APIRouter(tags=["vessels"])


@router.get("/vessels", response_model=list[VesselClassOut],
            summary="Baltic standard vessel class profiles")
def list_vessel_classes(db: Session = Depends(get_db)):
    return [
        VesselClassOut(
            vessel_class=v.vessel_class, index_code=v.index_code, ref_dwt=v.ref_dwt,
            ref_draft_m=v.ref_draft_m, ref_loa_m=v.ref_loa_m, ref_beam_m=v.ref_beam_m,
            tpc=v.tpc, speed_laden_kn=v.speed_laden_kn, speed_ballast_kn=v.speed_ballast_kn,
            cons_laden_mt_day=v.cons_laden_mt_day, cons_ballast_mt_day=v.cons_ballast_mt_day,
            geared=v.geared, dwt_range=[v.dwt_min, v.dwt_max], constants_t=v.constants_t,
            demurrage_usd_day=v.demurrage_usd_day, grt=v.grt,
            source_url=v.source_url, retrieved_at=v.retrieved_at.date(),
        ) for v in ref_repo.all_vessel_classes(db)
    ]


@router.get("/vessels/{vessel_class}", response_model=VesselClassOut)
def get_vessel_class(vessel_class: str, db: Session = Depends(get_db)):
    v = ref_repo.get_vessel_class(db, vessel_class)
    if v is None:
        raise NotFound(f"Unknown vessel class '{vessel_class}'", field="vessel_class",
                       allowed=[c.vessel_class for c in ref_repo.all_vessel_classes(db)])
    return VesselClassOut(
        vessel_class=v.vessel_class, index_code=v.index_code, ref_dwt=v.ref_dwt,
        ref_draft_m=v.ref_draft_m, ref_loa_m=v.ref_loa_m, ref_beam_m=v.ref_beam_m,
        tpc=v.tpc, speed_laden_kn=v.speed_laden_kn, speed_ballast_kn=v.speed_ballast_kn,
        cons_laden_mt_day=v.cons_laden_mt_day, cons_ballast_mt_day=v.cons_ballast_mt_day,
        geared=v.geared, dwt_range=[v.dwt_min, v.dwt_max], constants_t=v.constants_t,
        demurrage_usd_day=v.demurrage_usd_day, grt=v.grt,
        source_url=v.source_url, retrieved_at=v.retrieved_at.date())


@router.post("/recommend-vessel", response_model=RecommendVesselResponse,
             summary="Feasibility filter, parcel split and class ranking")
def recommend_vessel(req: RecommendVesselRequest, request: Request,
                     db: Session = Depends(get_db)):
    as_of = resolve_as_of(req.as_of)
    _validate_dates(req, as_of)
    require_port(db, req.origin_port)
    require_port(db, req.destination_port)

    try:
        ctx = scenario.build_context(
            db, cargo_type=req.cargo.type, quantity_t=req.cargo.quantity_t,
            origin_port=req.origin_port, destination_port=req.destination_port,
            required_by=req.required_by, as_of=as_of)
    except scenario.InfeasibleRequest as e:
        raise InfeasibleRequestError(
            "No vessel class can serve this cargo on this route",
            hint="Relax the deadline, split the cargo, or choose another discharge port",
            payload={"rejected": e.reasons}) from e
    except LookupError as e:
        raise NotFound(str(e), field="route") from e

    ranking = optimizer.rank_strategies(ctx, n_simulations=300)
    cost_by_class: dict[str, tuple[float, list[float]]] = {}
    for r in ranking.results:
        c = r.strategy.vessel_class
        if c not in cost_by_class or r.risk_adjusted < cost_by_class[c][0]:
            cost_by_class[c] = (r.risk_adjusted, [r.p10, r.p90])

    options = []
    for name, cc in ctx.classes.items():
        strat = simulator.Strategy("X", name, cc.n_voyages, "spot", "sequential")
        ok, why = simulator.deadline_feasible(ctx, strat)
        cost = cost_by_class.get(name)
        note = None
        if cc.stranded_parcel:
            note = (f"Second parcel only {cc.last_parcel_t:,.0f} t — poor utilisation")
        elif cc.requires_lighterage:
            note = "Requires Sandheads lighterage"
        elif not ok:
            note = why
        options.append({
            "vessel_class": name, "voyages": cc.n_voyages, "parcel_t": cc.intake_t,
            "last_parcel_t": round(cc.last_parcel_t), "intake_ratio": round(cc.intake_t / cc.vc.ref_dwt, 3),
            "compatibility_score": cc.compat_score, "compatibility_factors": cc.compat_factors,
            "estimated_days_per_voyage": _days_per_voyage(ctx, cc),
            "deadline_feasible": ok, "binding_constraint": cc.binding_constraint,
            "binding_port": cc.binding_port, "requires_lighterage": cc.requires_lighterage,
            "expected_cost_usd": round(cost[0], 2) if cost else None,
            "interval_80_usd": cost[1] if cost else None, "note": note,
        })

    options.sort(key=lambda o: (not o["deadline_feasible"],
                                o["expected_cost_usd"] if o["expected_cost_usd"] else 1e18))
    best = options[0] if options and options[0]["deadline_feasible"] else None

    return RecommendVesselResponse(
        recommended=best, alternatives=[o for o in options if o is not best],
        rejected=ctx.rejected, constraints_as_of=as_of, as_of=as_of,
        assumptions=[a for a in ctx.assumptions if a],
        provenance={"constraints": "measured", "intake": "derived",
                    "waiting": "simulated_demo", "cost": "derived"},
        request_id=request.state.request_id)


def _days_per_voyage(ctx, cc) -> float:
    d = (ctx.route.distance_nm / (cc.vc.speed_laden_kn * 24)
         + ctx.route.distance_nm / (cc.vc.speed_ballast_kn * 24) * (1 - ctx.route.backhaul_index)
         + (cc.intake_t / cc.load_rate_tpd if cc.load_rate_tpd else 3.0)
         + (cc.intake_t / cc.disch_rate_tpd if cc.disch_rate_tpd else 4.0)
         + (cc.load_wait.p50 + cc.disch_wait.p50) / 24.0)
    return round(d * (1 + ctx.weather_stop_fraction), 2)


def _validate_dates(req, as_of) -> None:
    if req.required_by <= as_of:
        raise InvalidInput(
            f"required_by {req.required_by.isoformat()} is not after as_of {as_of.isoformat()}",
            field="required_by", hint="The deadline must leave time to fix and sail a ship")
    if (req.required_by - as_of) > timedelta(days=540):
        raise InvalidInput("required_by is more than 18 months out", field="required_by",
                           hint="Forecast horizons stop at 180 days")
