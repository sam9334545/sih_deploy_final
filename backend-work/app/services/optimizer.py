"""Strategy ranking — blueprint §24–§25.

Primary path is enumerate-then-simulate: the feasible space is a few dozen
strategies, so we evaluate every one of them exactly rather than linearising the
nonlinear waiting and demurrage terms. `milp_crosscheck` states the equivalent
MILP/CP-SAT formulation that carries the same decision to 30 ports and 200
cargoes, and runs it when OR-Tools is installed.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import settings
from app.services import simulator
from app.services.scenario import ScenarioContext
from app.services.simulator import SimResult, Strategy


@dataclass(slots=True)
class Ranking:
    results: list[SimResult]
    infeasible: list[dict]
    winner: SimResult | None


def rank_strategies(ctx: ScenarioContext, n_simulations: int | None = None,
                    seed: int | None = None) -> Ranking:
    results: list[SimResult] = []
    infeasible: list[dict] = []

    for strat in simulator.enumerate_strategies(ctx):
        ok, why = simulator.deadline_feasible(ctx, strat)
        if not ok:
            infeasible.append({"id": strat.id, "label": strat.label,
                               "reason": "deadline", "detail": why})
            continue
        results.append(simulator.simulate(ctx, strat, n=n_simulations, seed=seed))

    for r in ctx.rejected:
        infeasible.append({"id": None, "label": f"{r['vessel_class']} → {ctx.destination.port_name}",
                           "reason": r["reason"], "detail": r["detail"],
                           "source": r.get("source")})

    results.sort(key=lambda r: r.risk_adjusted)
    return Ranking(results, infeasible, results[0] if results else None)


def explain(ctx: ScenarioContext, best: SimResult, others: list[SimResult]) -> list[str]:
    cc = ctx.classes[best.strategy.vessel_class]
    lines: list[str] = []

    lines.append(
        f"Port compatible: {best.strategy.vessel_class} clears "
        f"{ctx.destination.port_name} limits at {cc.intake_t:,.0f} t intake "
        f"({cc.intake_t / cc.vc.ref_dwt:.0%} of class deadweight); "
        f"binding constraint is {cc.binding_constraint} at {cc.binding_port}")

    lines.append(
        f"Freight outlook: {cc.index_code} {cc.forecast_trend} to {cc.index_point:,.0f} "
        f"(80% band {cc.index_lo:,.0f}–{cc.index_hi:,.0f}); derived rate "
        f"${cc.base_rate_usd_t.usd_per_tonne:.2f}/t")

    wait_ranked = sorted(ctx.classes.values(), key=lambda c: c.disch_wait.p50)
    if wait_ranked and wait_ranked[0].vc.vessel_class == best.strategy.vessel_class and len(wait_ranked) > 1:
        lines.append(
            f"Lowest expected waiting at {ctx.destination.port_name} in month "
            f"{ctx.month:02d}: {cc.disch_wait.p50:.0f} h median vs "
            f"{wait_ranked[-1].disch_wait.p50:.0f} h for {wait_ranked[-1].vc.vessel_class} "
            f"(bootstrapped from {cc.disch_wait.sample_days} observed calls)")
    else:
        lines.append(
            f"Expected waiting at {ctx.destination.port_name}: {cc.disch_wait.p50:.0f} h median, "
            f"{cc.disch_wait.p90:.0f} h at p90 (bootstrapped from "
            f"{cc.disch_wait.sample_days} observed calls)")

    slack = ctx.days_to_deadline - best.total_days_mean - settings.charter_lead_time_days
    lines.append(
        f"Meets the {ctx.required_by.isoformat()} deadline with {slack:.0f} days of slack "
        f"(P(miss) = {best.p_deadline_miss:.1%})")

    if others:
        runner = others[0]
        delta = runner.risk_adjusted - best.risk_adjusted
        lines.append(
            f"Lower risk-adjusted cost than every feasible alternative — "
            f"${delta:,.0f} ({delta / best.risk_adjusted:.1%}) better than "
            f"{runner.strategy.label}")
    else:
        lines.append("Only feasible strategy for this cargo, route and deadline")

    if best.strategy.structure == "multi_voyage":
        lines.append(
            f"A {best.strategy.voyages}-voyage contract fixes the rate and removes "
            f"{settings.contract_discount:.0%} from the freight, at the cost of losing "
            "the option to re-fix if the market softens")
    lines.extend(best.notes)
    return lines


def milp_crosscheck(ctx: ScenarioContext, ranking: Ranking) -> dict:
    """CP-SAT formulation of the same decision (blueprint §25.1–§25.2).

    Runs only if OR-Tools is present; the enumerate-then-simulate result above is
    always the answer we serve. Agreement between the two is reported.
    """
    try:
        from ortools.sat.python import cp_model
    except ImportError:
        return {"available": False,
                "note": "OR-Tools not installed; enumerate-then-simulate is exact at this scale. "
                        "The MILP/CP-SAT path is the scalability story for 30 ports × 200 cargoes."}

    unit: dict[str, float] = {}
    for r in ranking.results:
        cls = r.strategy.vessel_class
        per_voyage = r.risk_adjusted / max(r.strategy.voyages, 1)
        unit[cls] = min(unit.get(cls, per_voyage), per_voyage)
    if not unit:
        return {"available": True, "status": "infeasible", "agrees_with_simulation": False}

    m = cp_model.CpModel()
    classes = list(unit)
    x = {c: m.NewIntVar(0, 12, f"x_{c}") for c in classes}
    y = {c: m.NewBoolVar(f"y_{c}") for c in classes}
    for c in classes:
        m.Add(x[c] <= 12 * y[c])                                    # C2 linking
        m.Add(x[c] >= y[c])
    m.Add(sum(int(ctx.classes[c].intake_t) * x[c] for c in classes)
          >= int(ctx.quantity_t))                                   # C1 cargo covered
    m.Add(sum(y[c] for c in classes) <= settings.max_classes_in_mix)  # C11 fleet-mix cap
    m.Minimize(sum(int(unit[c]) * x[c] for c in classes))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return {"available": True, "status": "infeasible", "agrees_with_simulation": False}

    plan = {c: solver.Value(x[c]) for c in classes if solver.Value(x[c]) > 0}
    winner = ranking.winner.strategy.vessel_class if ranking.winner else None
    return {"available": True, "status": solver.StatusName(status),
            "objective_usd": round(solver.ObjectiveValue(), 2), "plan": plan,
            "agrees_with_simulation": winner in plan,
            "note": "CP-SAT minimises the same risk-adjusted cost with integer voyage counts; "
                    "used as a cross-check, not as the served answer."}
