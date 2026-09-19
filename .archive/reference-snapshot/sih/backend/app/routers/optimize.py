from __future__ import annotations

import time
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import require_port, resolve_as_of
from app.errors import InfeasibleRequestError, NotFound
from app.routers.vessels import _validate_dates
from app.schemas.requests import (
    OpportunityRequest, OptimizeCharterRequest, SimulateStrategyRequest,
)
from app.schemas.responses import OptimizeResponse, SimulateResponse
from app.services import opportunity, optimizer, risk_engine, scenario, simulator
from app.services.cost_model import to_inr

router = APIRouter(tags=["decision"])

DISTRIBUTIONS = {
    "freight_rate": "Lognormal fitted to the conformal-calibrated 80% forecast band",
    "bunker_price": "Lognormal, sigma from 90-day realised volatility scaled to the horizon",
    "waiting_load": "Empirical bootstrap of observed calls, stratified by class and month",
    "waiting_discharge": "Empirical bootstrap of observed calls, stratified by class and month",
    "weather_stoppage": "Binomial on working time, p from port-month climatology",
    "demurrage_rate": "Deterministic per class, user-editable assumption",
}


def _context(db: Session, req, as_of):
    require_port(db, req.origin_port)
    require_port(db, req.destination_port)
    try:
        return scenario.build_context(
            db, cargo_type=req.cargo.type, quantity_t=req.cargo.quantity_t,
            origin_port=req.origin_port, destination_port=req.destination_port,
            required_by=req.required_by, as_of=as_of,
            risk_aversion=getattr(req, "risk_aversion", None),
            deadline_miss_penalty_usd=getattr(req, "deadline_miss_penalty_usd", None))
    except scenario.InfeasibleRequest as e:
        raise InfeasibleRequestError(
            "No vessel class can serve this cargo on this route",
            hint="Relax the deadline, split the cargo, or choose another discharge port",
            payload={"rejected": e.reasons}) from e
    except LookupError as e:
        raise NotFound(str(e), field="route") from e


@router.post("/optimize-charter", response_model=OptimizeResponse,
             summary="Recommend a charter strategy and explain it")
def optimize_charter(req: OptimizeCharterRequest, request: Request,
                     db: Session = Depends(get_db)):
    t0 = time.perf_counter()
    as_of = resolve_as_of(req.as_of)
    _validate_dates(req, as_of)
    ctx = _context(db, req, as_of)

    ranking = optimizer.rank_strategies(ctx, n_simulations=req.n_simulations, seed=req.seed)
    if ranking.winner is None:
        raise InfeasibleRequestError(
            "Every strategy misses the deadline",
            hint="Move the deadline out, or split the cargo across more ships",
            payload={"infeasible": ranking.infeasible})

    best = ranking.winner
    if req.contract_horizon_voyages:
        preferred = [r for r in ranking.results
                     if r.strategy.voyages == req.contract_horizon_voyages]
        if preferred:
            best = preferred[0]

    cc = ctx.classes[best.strategy.vessel_class]
    others = [r for r in ranking.results if r is not best]

    opp = None
    cos = None
    if req.include_opportunity_score:
        o = opportunity.compute(ctx, best.strategy, n=max(150, (req.n_simulations or 1000) // 4),
                                seed=req.seed)
        cos = o.score
        opp = {
            "charter_opportunity_score": o.score, "verdict": o.verdict,
            "window_days": o.window_days, "best_date": o.best_date.isoformat(),
            "worst_date": o.worst_date.isoformat(),
            "window": [{"date": p.commit_date.isoformat(),
                        "risk_adjusted_cost_usd": round(p.risk_adjusted_cost, 2),
                        "mean_cost_usd": round(p.mean_cost, 2),
                        "p_deadline_miss": p.p_deadline_miss} for p in o.window],
            "attribution_usd": o.attribution,
            "lambda_sensitivity": o.sensitivity,
            "note": o.note,
            "method": ("Percentile position of today's risk-adjusted cost among every remaining "
                       "commit date. No invented weights: the only judgement calls are risk "
                       "aversion and the deadline-miss penalty, both user-visible."),
        }

    risk = risk_engine.assess(db, port_id=ctx.destination.port_id,
                              vessel_class=best.strategy.vessel_class,
                              month=ctx.month, as_of=as_of, ctx=ctx)

    window_start = as_of
    window_end = as_of + timedelta(days=min(5, max(1, ctx.days_to_deadline - 1)))

    recommendation = {
        "vessel_class": best.strategy.vessel_class, "voyages": best.strategy.voyages,
        "execution": best.strategy.execution,
        "contract_structure": ("short_term_multi_voyage"
                               if best.strategy.structure == "multi_voyage" else "spot"),
        "charter_window": {"start": window_start, "end": window_end},
        "expected_cost_usd": best.mean,
        "expected_cost_inr": to_inr(best.mean, ctx.fx_usd_inr),
        "expected_usd_per_tonne": best.usd_per_tonne,
        "fx_rate": ctx.fx_usd_inr, "fx_date": ctx.fx_date,
        "interval_80_usd": [best.p10, best.p90], "cvar_90_usd": best.cvar_90,
        "p_deadline_miss": best.p_deadline_miss,
        "risk_adjusted_cost_usd": best.risk_adjusted,
        "risk": risk.overall, "charter_opportunity_score": cos,
    }

    milp = optimizer.milp_crosscheck(ctx, ranking) if req.include_milp_crosscheck else None

    return OptimizeResponse(
        recommendation=recommendation,
        cost_breakdown_usd=best.breakdown,
        idle={"idle_days": best.idle_days_mean, "idle_cost_usd": best.idle_cost_mean},
        alternatives=[_strategy_dict(r) for r in others[:5]],
        infeasible=ranking.infeasible,
        explanation=optimizer.explain(ctx, best, others),
        opportunity=opp,
        risk={"overall": risk.overall, "main_driver": risk.main_driver,
              "components": [c.__dict__ if hasattr(c, "__dict__")
                             else {k: getattr(c, k) for k in c.__slots__} for c in risk.components]},
        milp_crosscheck=milp,
        assumptions=[a for a in ctx.assumptions if a] + [
            f"Risk aversion λ = {ctx.risk_aversion} (user-editable)",
            f"Deadline-miss penalty = ${ctx.deadline_miss_penalty_usd:,.0f} (user-editable)",
        ],
        provenance={"freight": "derived", "port_costs": cc.disch_charges.provenance,
                    "waiting": "simulated_demo" if settings.demo_mode else "measured",
                    "constraints": "measured", "weather": "derived"},
        as_of=as_of, runtime_ms=int((time.perf_counter() - t0) * 1000),
        request_id=request.state.request_id)


@router.post("/simulate-strategy", response_model=SimulateResponse,
             summary="Charter Strategy Digital Twin — compare strategies under uncertainty")
def simulate_strategy(req: SimulateStrategyRequest, request: Request,
                      db: Session = Depends(get_db)):
    t0 = time.perf_counter()
    as_of = resolve_as_of(req.as_of)
    _validate_dates(req, as_of)
    ctx = _context(db, req, as_of)

    ranking = optimizer.rank_strategies(ctx, n_simulations=req.n_simulations, seed=req.seed)
    results = ranking.results
    if req.strategies and "auto" not in req.strategies:
        wanted = {s.lower() for s in req.strategies}
        results = [r for r in results
                   if r.strategy.id.lower() in wanted
                   or r.strategy.vessel_class.lower() in wanted]

    return SimulateResponse(
        results=[_strategy_dict(r) for r in results],
        infeasible=ranking.infeasible,
        winner=results[0].strategy.id if results else None,
        n_simulations=req.n_simulations,
        seed=req.seed if req.seed is not None else settings.simulation_seed,
        runtime_ms=int((time.perf_counter() - t0) * 1000),
        distributions=DISTRIBUTIONS,
        as_of=as_of, assumptions=[a for a in ctx.assumptions if a],
        provenance={"freight": "derived", "waiting": "simulated_demo" if settings.demo_mode
                    else "measured", "port_costs": "measured", "weather": "derived"},
        request_id=request.state.request_id)


@router.post("/opportunity-score", summary="Charter Opportunity Score for a requirement")
def opportunity_score(req: OpportunityRequest, request: Request,
                      db: Session = Depends(get_db)):
    as_of = resolve_as_of(req.as_of)
    _validate_dates(req, as_of)
    ctx = _context(db, req, as_of)

    if req.vessel_class:
        if req.vessel_class not in ctx.classes:
            rejected = next((r for r in ctx.rejected if r["vessel_class"] == req.vessel_class), None)
            raise InfeasibleRequestError(
                f"{req.vessel_class} cannot serve this route",
                payload={"rejected": [rejected] if rejected else ctx.rejected})
        cls = req.vessel_class
    else:
        ranking = optimizer.rank_strategies(ctx, n_simulations=200, seed=None)
        if ranking.winner is None:
            raise InfeasibleRequestError("Every strategy misses the deadline",
                                         payload={"infeasible": ranking.infeasible})
        cls = ranking.winner.strategy.vessel_class

    cc = ctx.classes[cls]
    strat = simulator.Strategy("COS", cls, cc.n_voyages, "spot", "sequential")
    o = opportunity.compute(ctx, strat, n=req.n_simulations)
    return {
        "vessel_class": cls, "as_of": as_of.isoformat(),
        "charter_opportunity_score": o.score, "verdict": o.verdict,
        "window_days": o.window_days, "window_points": len(o.window),
        "best_date": o.best_date.isoformat(), "worst_date": o.worst_date.isoformat(),
        "window": [{"date": p.commit_date.isoformat(),
                    "risk_adjusted_cost_usd": round(p.risk_adjusted_cost, 2),
                    "p_deadline_miss": p.p_deadline_miss} for p in o.window],
        "attribution_usd": o.attribution,
        "lambda_sensitivity": o.sensitivity,
        "note": o.note,
        "interpretation": (f"COS {o.score:.0f} means committing today is better than "
                           f"{o.score:.0f}% of the remaining days in the decision window."),
        "request_id": request.state.request_id,
    }


def _strategy_dict(r) -> dict:
    return {
        "id": r.strategy.id, "label": r.strategy.label,
        "vessel_class": r.strategy.vessel_class, "voyages": r.strategy.voyages,
        "structure": r.strategy.structure, "execution": r.strategy.execution,
        "total_days": r.total_days_mean,
        "cost": {"mean": r.mean, "p10": r.p10, "p50": r.p50, "p90": r.p90,
                 "cvar_90": r.cvar_90, "std": r.std},
        "usd_per_tonne": r.usd_per_tonne,
        "p_deadline_miss": r.p_deadline_miss,
        "risk_adjusted_cost": r.risk_adjusted,
        "breakdown": r.breakdown,
        "idle_days": r.idle_days_mean, "idle_cost_usd": r.idle_cost_mean,
        "feasible": r.feasible, "notes": r.notes,
    }
