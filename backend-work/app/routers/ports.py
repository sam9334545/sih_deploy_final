from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_port, resolve_as_of
from app.errors import NotFound
from app.models import Berth
from app.repositories import reference as ref_repo
from app.schemas.responses import PortDetail, PortSummary
from app.services import compatibility_service, congestion_service
from app.services.constants import CARGO_TYPES, LIGHTERAGE_PORTS, SEASONS, season_of

router = APIRouter(prefix="/ports", tags=["ports"])


@router.get("", response_model=list[PortSummary], summary="Port registry")
def list_ports(country: str | None = Query(None, min_length=2, max_length=2),
               role: str | None = Query(None, pattern="^(load|discharge|both)$"),
               db: Session = Depends(get_db)):
    out = []
    for p in ref_repo.all_ports(db, country.upper() if country else None, role):
        drafts = [b.max_draft_m for b in p.berths if b.max_draft_m]
        out.append(PortSummary(
            port_id=p.port_id, name=p.port_name, country=p.country, role=p.role,
            lat=p.lat, lon=p.lon, authority=p.authority, authority_type=p.authority_type,
            berth_count=len(p.berths), max_draft_m=max(drafts) if drafts else None,
            verification=p.verification))
    return out


@router.get("/{port_id}", response_model=PortDetail, summary="Port constraints, congestion and compatibility")
def get_port(port_id: str, request: Request,
             cargo_type: str = Query("coking_coal"),
             season: str | None = Query(None),
             as_of=Query(None),
             db: Session = Depends(get_db)):
    as_of_d = resolve_as_of(as_of)
    p = require_port(db, port_id)
    if cargo_type not in CARGO_TYPES:
        raise NotFound(f"Unknown cargo type '{cargo_type}'", field="cargo_type",
                       allowed=CARGO_TYPES)
    season = season or season_of(as_of_d)
    if season not in SEASONS:
        raise NotFound(f"Unknown season '{season}'", field="season", allowed=SEASONS)

    pool = congestion_service.wait_pool(db, p.port_id, None, as_of_d.month)
    notes = []
    if p.port_id in LIGHTERAGE_PORTS:
        light = require_port(db, LIGHTERAGE_PORTS[p.port_id])
        notes.append(
            f"Two-mode port: vessels deeper than the permissible draft are lightened at "
            f"{light.port_name} ({light.port_id}) before the balance goes upriver. The "
            f"transhipment days and cost are priced into every recommendation.")
    weather = [
        {"month": m, "weather_stop_fraction": w.weather_stop_fraction,
         "p90_wave_height_m": w.p90_wave_height_m, "mean_wind_kn": w.mean_wind_kn,
         "cyclone_freq_per_decade": w.cyclone_freq_per_decade}
        for m in range(1, 13) if (w := ref_repo.weather(db, p.port_id, m))
    ]

    return PortDetail(
        port_id=p.port_id, name=p.port_name, country=p.country, role=p.role,
        lat=p.lat, lon=p.lon, authority=p.authority, authority_type=p.authority_type,
        approach_channel_depth_m=p.approach_channel_depth_m, tidal_range_m=p.tidal_range_m,
        seasonal_notes=" ".join(filter(None, [p.seasonal_notes] + notes)) or None,
        berths=[_berth(b) for b in sorted(p.berths, key=lambda b: b.berth_id)],
        congestion={"expected_wait_hours_p50": round(pool.p50, 1),
                    "p90": round(pool.p90, 1), "strata": pool.strata,
                    "sample_size": pool.sample_days, "as_of": as_of_d},
        weather=weather,
        vessel_compatibility=compatibility_service.best_per_class(
            db, p.port_id, season, cargo_type),
        source_url=p.source_url, retrieved_at=p.retrieved_at.date(),
        verification=p.verification, constraints_as_of=as_of_d,
        request_id=request.state.request_id)


@router.get("/{port_id}/compatibility", summary="Full compatibility grid for a port")
def port_compatibility(port_id: str, season: str | None = None, cargo_type: str | None = None,
                       db: Session = Depends(get_db)):
    p = require_port(db, port_id)
    rows = compatibility_service.for_port(db, p.port_id, season, cargo_type)
    return {
        "port_id": p.port_id, "rows": [
            {"berth_id": r.berth_id, "vessel_class": r.vessel_class, "cargo_type": r.cargo_type,
             "season": r.season, "feasible": r.feasible,
             "infeasible_reason": r.infeasible_reason, "infeasible_detail": r.infeasible_detail,
             "max_intake_t": r.max_intake_t, "intake_ratio": r.intake_ratio,
             "est_cargo_days": r.est_cargo_days, "est_turnaround_days": r.est_turnaround_days,
             "est_wait_hours_p50": r.est_wait_hours_p50, "est_wait_hours_p90": r.est_wait_hours_p90,
             "weather_stop_frac": r.weather_stop_frac, "requires_lighterage": r.requires_lighterage,
             "compat_score": r.compat_score,
             "factors": {"u_cargo": r.u_cargo, "u_time": r.u_time,
                         "u_cost": r.u_cost, "u_reliability": r.u_reliability}}
            for r in rows],
        "score_formula": "100 × feasible × U_cargo × U_time × U_cost × U_reliability "
                         "(geometric mean of interpretable ratios; no tuned weights)",
    }


def _berth(b: Berth) -> dict:
    return {"berth_id": b.berth_id, "name": b.berth_name, "cargo_types": b.cargo_types,
            "max_loa_m": b.max_loa_m, "min_loa_m": b.min_loa_m, "max_beam_m": b.max_beam_m,
            "max_draft_m": b.max_draft_m, "tide_allowance_m": b.tide_allowance_m,
            "handling_rate_tpd": b.handling_rate_tpd, "mechanised": b.mechanised,
            "daylight_only": b.daylight_only, "coupling_constraint": b.coupling_constraint,
            "status": b.status, "effective_from": b.effective_from, "effective_to": b.effective_to,
            "source_url": b.source_url, "verification": b.verification}
