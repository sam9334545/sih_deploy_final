"""Charter Opportunity Score — blueprint §23.

Not a weighted sum. COS is the percentile position of today's risk-adjusted cost
within the distribution of costs across every day you could still act. It answers
"how good is today, relative to the other days you have left?" — which is the
question a chartering manager actually has.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np

from app.config import settings
from app.services import simulator
from app.services.scenario import (
    ScenarioContext, charter_windows, interpolate_curve,
)
from app.services.simulator import Strategy


@dataclass(slots=True)
class WindowPoint:
    commit_date: date
    risk_adjusted_cost: float
    mean_cost: float
    p_deadline_miss: float


@dataclass(slots=True)
class OpportunityResult:
    score: float
    window: list[WindowPoint]
    best_date: date
    worst_date: date
    window_days: int
    attribution: dict[str, float]
    sensitivity: list[dict]
    verdict: str
    note: str


def _cost_on(ctx: ScenarioContext, strategy: Strategy, commit: date,
             n: int, seed: int | None) -> simulator.SimResult:
    """Cost of committing on `commit` rather than today.

    Three things actually change with the commit date, and all three come from
    data rather than from a fudge factor:
      • the freight you buy moves along the forecast term structure,
      • the queue you join is the queue that port has in the laycan month,
      • the weather you work in is that month's climatology.
    Committing later also eats schedule slack, which raises deadline risk.
    """
    cc = ctx.classes[strategy.vessel_class]
    delay = (commit - ctx.as_of).days

    h_now = max(1.0, (ctx.as_of - ctx.as_of).days + settings.charter_lead_time_days)
    h_then = delay + settings.charter_lead_time_days
    f_now = interpolate_curve(cc.forecast_curve, h_now)
    f_then = interpolate_curve(cc.forecast_curve, h_then)
    freight_shift = (f_then / f_now) if f_now else 1.0

    arrive_month = (commit + timedelta(days=settings.charter_lead_time_days
                                       + cc.arrival_lag_days)).month
    base_month = (ctx.as_of + timedelta(days=settings.charter_lead_time_days
                                        + cc.arrival_lag_days)).month
    base_wait = cc.wait_by_month.get(base_month) or cc.disch_wait.p50
    wait_shift = (cc.wait_by_month.get(arrive_month, base_wait) / base_wait) if base_wait else 1.0
    base_wx = cc.weather_by_month.get(base_month) or ctx.weather_stop_fraction
    weather_shift = (cc.weather_by_month.get(arrive_month, base_wx) / base_wx) if base_wx else 1.0

    res = simulator.simulate(ctx, strategy, n=n, seed=seed, freight_shift=freight_shift,
                             wait_shift=wait_shift, weather_shift=weather_shift)
    if delay:
        # Less slack left before the deadline means a higher chance of missing it.
        slack_loss = min(0.6, delay / max(ctx.days_to_deadline, 1))
        res.p_deadline_miss = round(min(1.0, res.p_deadline_miss * (1 + slack_loss)
                                        + 0.02 * slack_loss), 4)
        res.risk_adjusted = round(
            res.mean + ctx.risk_aversion * (res.cvar_90 - res.mean)
            + ctx.deadline_miss_penalty_usd * res.p_deadline_miss, 2)
    return res


def compute(ctx: ScenarioContext, strategy: Strategy, n: int = 300,
            seed: int | None = None) -> OpportunityResult:
    dates = charter_windows(ctx.as_of, ctx.required_by)
    points: list[WindowPoint] = []
    for d in dates:
        r = _cost_on(ctx, strategy, d, n, seed)
        points.append(WindowPoint(d, r.risk_adjusted, r.mean, r.p_deadline_miss))

    costs = np.asarray([p.risk_adjusted_cost for p in points])
    today = costs[0]
    pct_rank = float((costs < today).mean())
    score = round(100.0 * (1.0 - pct_rank), 1)

    best = points[int(np.argmin(costs))]
    worst = points[int(np.argmax(costs))]
    attribution = _attribute(ctx, strategy, today, best.risk_adjusted_cost,
                             best.commit_date, n, seed)
    sensitivity = _lambda_sensitivity(ctx, strategy, dates, n, seed)

    flips = len({s["preferred"] for s in sensitivity}) > 1
    if flips:
        note = ("This recommendation is sensitive to your risk tolerance — at low risk "
                "aversion waiting wins; at high risk aversion, charter now.")
    elif len(dates) <= 2:
        note = (f"Only {len(dates)} viable commit dates remain, so the score carries little "
                "information — the decision is effectively forced.")
    else:
        note = f"Scored across {len(dates)} viable commit dates between now and the lead-time cut-off."

    verdict = ("charter_now" if score >= 70 else "wait" if score <= 35 else "monitor")
    return OpportunityResult(score, points, best.commit_date, worst.commit_date,
                             (dates[-1] - dates[0]).days, attribution, sensitivity, verdict, note)


def _attribute(ctx: ScenarioContext, strategy: Strategy, today: float, best: float,
               best_date: date, n: int, seed: int | None) -> dict[str, float]:
    """One-at-a-time decomposition of the gap between today and the best day.

    Each delta re-runs the simulator with exactly one component moved to its
    best-day value and everything else held at today's. This is a decomposition
    of a quantity we actually computed, not a made-up weighting.
    """
    gap = today - best
    cc = ctx.classes[strategy.vessel_class]
    delay = (best_date - ctx.as_of).days
    h_now = settings.charter_lead_time_days
    h_best = delay + settings.charter_lead_time_days
    f_now = interpolate_curve(cc.forecast_curve, h_now)
    f_best = interpolate_curve(cc.forecast_curve, h_best)
    arrive_month = (best_date + timedelta(days=settings.charter_lead_time_days
                                          + cc.arrival_lag_days)).month
    base_month = (ctx.as_of + timedelta(days=settings.charter_lead_time_days
                                        + cc.arrival_lag_days)).month
    base_wait = cc.wait_by_month.get(base_month) or cc.disch_wait.p50
    base_wx = cc.weather_by_month.get(base_month) or ctx.weather_stop_fraction

    base = simulator.simulate(ctx, strategy, n=n, seed=seed)
    probes = {
        "freight": {"freight_shift": (f_best / f_now) if f_now else 1.0},
        "waiting": {"wait_shift": (cc.wait_by_month.get(arrive_month, base_wait) / base_wait)
                    if base_wait else 1.0},
        "weather": {"weather_shift": (cc.weather_by_month.get(arrive_month, base_wx) / base_wx)
                    if base_wx else 1.0},
        "bunker": {"bunker_shift": 1.0},
    }
    out: dict[str, float] = {}
    for name, kwargs in probes.items():
        r = simulator.simulate(ctx, strategy, n=n, seed=seed, **kwargs)
        out[name] = round(base.risk_adjusted - r.risk_adjusted, 2)
    out["deadline_risk"] = round(gap - sum(out.values()), 2)
    out["total"] = round(gap, 2)
    return out


def _lambda_sensitivity(ctx: ScenarioContext, strategy: Strategy, dates, n: int,
                        seed: int | None) -> list[dict]:
    """Does the act-now/wait call survive a change in risk aversion? Say so either way."""
    out = []
    original = ctx.risk_aversion
    try:
        for lam in (0.0, 0.25, 0.5, 0.75, 1.0):
            ctx.risk_aversion = lam
            costs = [_cost_on(ctx, strategy, d, max(120, n // 3), seed).risk_adjusted for d in dates]
            arr = np.asarray(costs)
            score = round(100.0 * (1.0 - float((arr < arr[0]).mean())), 1)
            out.append({"risk_aversion": lam, "score": score,
                        "preferred": "now" if score >= 50 else "wait"})
    finally:
        ctx.risk_aversion = original
    return out
