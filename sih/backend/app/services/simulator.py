"""Charter Strategy Digital Twin — blueprint §28.

Each strategy is run as a Monte Carlo over the four things that actually move
the money: the freight rate, the bunker price, the queue at each end, and the
weather. Waiting time is an *empirical bootstrap* from observed port calls, not
an assumed distribution — that is the single most defensible choice in here.

Seeded, so the same request always returns the same numbers.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from app.config import settings
from app.services.cost_model import laytime_days_for, repositioning_cost
from app.services.scenario import ClassContext, ScenarioContext


@dataclass(slots=True)
class Strategy:
    id: str
    vessel_class: str
    voyages: int
    structure: str                # "spot" | "multi_voyage"
    execution: str                # "sequential" | "parallel"
    commit_offset_days: int = 0

    @property
    def label(self) -> str:
        ships = 1 if self.execution == "sequential" else self.voyages
        struct = (f"{self.voyages}-voyage contract" if self.structure == "multi_voyage" else "spot")
        return f"{ships} × {self.vessel_class}, {struct}"


@dataclass(slots=True)
class SimResult:
    strategy: Strategy
    mean: float
    p10: float
    p50: float
    p90: float
    cvar_90: float
    std: float
    p_deadline_miss: float
    risk_adjusted: float
    total_days_mean: float
    idle_days_mean: float
    idle_cost_mean: float
    breakdown: dict[str, float]
    usd_per_tonne: float
    feasible: bool = True
    infeasible_reason: str | None = None
    notes: list[str] = field(default_factory=list)


def _sample_lognormal_from_band(rng, point: float, lo: float, hi: float, n: int) -> np.ndarray:
    """Fit a lognormal to the calibrated 80% band, then draw from it."""
    if point <= 0:
        return np.full(n, max(point, 0.0))
    lo = max(lo, point * 0.2)
    if hi <= lo:                       # a pinned rate (a fixed COA, or a test) is a constant
        return np.full(n, point)
    mu = math.log(point)
    sigma = (math.log(hi) - math.log(lo)) / (2 * 1.2815926)   # z_0.9 − z_0.1
    return np.exp(rng.normal(mu, max(sigma, 1e-4), n))


def enumerate_strategies(ctx: ScenarioContext) -> list[Strategy]:
    """The feasible space is tiny, so we enumerate it exactly instead of approximating.

    (Blueprint §25.3 option 2 — the MILP in optimizer.py is the scalability story.)
    """
    out: list[Strategy] = []
    i = 0
    for name, cc in ctx.classes.items():
        for structure in ("spot", "multi_voyage"):
            # A COA commits you to one class and a minimum number of voyages (C8/C9).
            if structure == "multi_voyage" and cc.n_voyages < 2:
                continue
            for execution in ("sequential", "parallel"):
                if cc.n_voyages == 1 and execution == "parallel":
                    continue
                i += 1
                out.append(Strategy(f"S{i}", name, cc.n_voyages, structure, execution))
    return out


def simulate(ctx: ScenarioContext, strategy: Strategy, n: int | None = None,
             seed: int | None = None, freight_shift: float = 1.0,
             wait_shift: float = 1.0, weather_shift: float = 1.0,
             bunker_shift: float = 1.0) -> SimResult:
    n = n or settings.n_simulations_default
    rng = np.random.default_rng(settings.simulation_seed if seed is None else seed)
    cc = ctx.classes[strategy.vessel_class]
    vc = cc.vc

    parcels = _parcels(ctx, cc, strategy.voyages)

    # ---- 1. freight: lognormal fitted to the conformal 80% band ----
    rate = cc.base_rate_usd_t
    freight = _sample_lognormal_from_band(rng, rate.usd_per_tonne, rate.lo_80, rate.hi_80, n)
    freight *= freight_shift
    if strategy.structure == "multi_voyage":
        freight = freight * (1.0 - settings.contract_discount)
        # A COA fixes the rate up front: you lose the upside and shed the variance.
        freight = freight.mean() + (freight - freight.mean()) * 0.35

    # ---- 2. bunker: lognormal, sigma from realised vol scaled to the voyage ----
    horizon_yrs = max(ctx.days_to_deadline, 7) / 365.0
    bsig = max(0.02, ctx.bunker_vol * math.sqrt(horizon_yrs))
    bunker = ctx.bunker_usd_mt * np.exp(rng.normal(-0.5 * bsig ** 2, bsig, n)) * bunker_shift

    # ---- 3 & 4. waiting (empirical bootstrap) and weather, per voyage ----
    # ---- 3 & 4. waiting (empirical bootstrap) and weather, per voyage ----
    # Vectorised over paths: this is exactly the arithmetic in cost_model, applied to
    # whole arrays. tests/test_cost_model.py asserts the two agree draw for draw.
    totals = np.zeros(n)
    durations = np.zeros(n)
    idle_days = np.zeros(n)
    idle_cost = np.zeros(n)
    comp_sums = {k: 0.0 for k in ("freight", "bunker", "port_costs", "waiting",
                                  "expected_demurrage", "lighterage", "repositioning")}

    laytime = laytime_days_for(cc.intake_t, cc.load_rate_tpd) + \
        laytime_days_for(cc.intake_t, cc.disch_rate_tpd)
    reposition = repositioning_cost(vc, ctx.route.distance_nm, ctx.bunker_usd_mt,
                                    ctx.route.backhaul_index, cc.load_charges.port_dues)
    laden_days = ctx.route.distance_nm / (vc.speed_laden_kn * 24.0)
    ballast_days = ctx.route.distance_nm / (vc.speed_ballast_kn * 24.0)

    for v_idx, tonnes in enumerate(parcels):
        w_load = cc.load_wait.draw(rng, n) * wait_shift
        w_disch = cc.disch_wait.draw(rng, n) * wait_shift
        if strategy.execution == "sequential" and v_idx > 0:
            # Queuing behind yourself: your own earlier calls congest the berth.
            w_disch = w_disch * (1.0 + 0.12 * v_idx)

        p_stop = min(0.95, ctx.weather_stop_fraction * weather_shift)
        wx_frac = p_stop * (0.5 + rng.binomial(1, p_stop, size=n).astype(float))

        light_t = (cc.lighterage_tonnes_per_voyage * (tonnes / cc.intake_t)
                   if cc.requires_lighterage else 0.0)
        light_days = (light_t / settings.sandheads_lighterage_rate_tpd
                      + settings.sandheads_transit_days) if light_t > 0 else 0.0

        load_cargo_days = tonnes / cc.load_rate_tpd if cc.load_rate_tpd else 0.0
        disch_cargo_days = ((tonnes - light_t) / cc.disch_rate_tpd) if cc.disch_rate_tpd else 0.0
        working = laden_days + ballast_days + load_cargo_days + disch_cargo_days + light_days
        weather_days = working * wx_frac

        wait_days = (w_load + w_disch) / 24.0
        total_days = working + wait_days + weather_days

        freight_cost = freight * tonnes
        port_hours = (load_cargo_days + disch_cargo_days) * 24.0
        port_cost = (cc.load_charges.port_dues + cc.load_charges.pilotage
                     + cc.disch_charges.port_dues + cc.disch_charges.pilotage
                     + (cc.load_charges.berth_hire_per_hour
                        + cc.disch_charges.berth_hire_per_hour) * port_hours / 2.0
                     + cc.disch_charges.wharfage_per_tonne * tonnes)
        billable = np.maximum(0.0, wait_days - laytime)
        waiting_cost = (wait_days - billable) * vc.demurrage_usd_day * 0.35
        demurrage = billable * vc.demurrage_usd_day
        lighterage_cost = (light_t * cc.disch_charges.lighterage_per_tonne
                           + light_days * vc.demurrage_usd_day * 0.6
                           + cc.disch_charges.anchorage_per_hour * light_days * 24.0) \
            if light_t > 0 else 0.0
        repo = reposition if (v_idx > 0 or strategy.execution == "parallel") else reposition * 0.5

        voyage_total = (freight_cost + port_cost + waiting_cost + demurrage
                        + lighterage_cost + repo)
        totals += voyage_total
        this_idle = wait_days + weather_days
        idle_days += this_idle
        idle_cost += this_idle * vc.demurrage_usd_day * 0.6
        if strategy.execution == "sequential":
            durations += total_days
        else:
            durations = np.maximum(durations, total_days + v_idx * 3.0)

        comp_sums["freight"] += float(np.mean(freight_cost))
        comp_sums["port_costs"] += float(port_cost)
        comp_sums["waiting"] += float(np.mean(waiting_cost))
        comp_sums["expected_demurrage"] += float(np.mean(demurrage))
        comp_sums["lighterage"] += float(lighterage_cost)
        comp_sums["repositioning"] += float(repo)

    deadline_days = ctx.days_to_deadline
    misses = float(np.mean(durations + settings.charter_lead_time_days > deadline_days))

    mean = float(totals.mean())
    p90 = float(np.percentile(totals, 90))
    tail = totals[totals >= p90]
    cvar = float(tail.mean()) if tail.size else p90
    risk_adj = (mean + ctx.risk_aversion * (cvar - mean)
                + ctx.deadline_miss_penalty_usd * misses)

    # Mean cost breakdown per *requirement* — summed over voyages, averaged over paths.
    breakdown = {k: round(v, 2) for k, v in comp_sums.items()}
    breakdown["total"] = round(sum(comp_sums.values()), 2)
    notes: list[str] = []
    if cc.stranded_parcel:
        notes.append(
            f"Final parcel is only {cc.last_parcel_t:,.0f} t "
            f"({cc.last_parcel_t / cc.intake_t:.0%} of intake) — poor utilisation")
    if cc.requires_lighterage:
        notes.append("Requires Sandheads lighterage; transhipment cost and days are priced in")
    if cc.load_fit.best.intake.severe_partload or cc.disch_fit.best.intake.severe_partload:
        notes.append("Severe part-load: draft restriction limits intake below 50% of class deadweight")

    return SimResult(
        strategy=strategy, mean=round(mean, 2),
        p10=round(float(np.percentile(totals, 10)), 2),
        p50=round(float(np.percentile(totals, 50)), 2),
        p90=round(p90, 2), cvar_90=round(cvar, 2), std=round(float(totals.std()), 2),
        p_deadline_miss=round(misses, 4), risk_adjusted=round(risk_adj, 2),
        total_days_mean=round(float(durations.mean()), 2),
        idle_days_mean=round(float(idle_days.mean()), 2),
        idle_cost_mean=round(float(idle_cost.mean()), 2),
        breakdown=breakdown,
        usd_per_tonne=round(mean / ctx.quantity_t, 3) if ctx.quantity_t else 0.0,
        notes=notes,
    )


def _parcels(ctx: ScenarioContext, cc: ClassContext, voyages: int) -> list[float]:
    remaining = ctx.quantity_t
    out: list[float] = []
    while remaining > 0:
        t = min(cc.intake_t, remaining)
        out.append(t)
        remaining -= t
        if len(out) >= voyages and remaining > 0:
            # A voyage count that cannot lift the cargo would otherwise silently
            # overload the last parcel past the berth's draft limit. Add the voyage.
            continue
    return out


def deadline_feasible(ctx: ScenarioContext, strategy: Strategy) -> tuple[bool, str | None]:
    """Stage 3 of the vessel selection engine — sequential vs parallel completion."""
    cc = ctx.classes[strategy.vessel_class]
    per_voyage = (
        ctx.route.distance_nm / (cc.vc.speed_laden_kn * 24)
        + ctx.route.distance_nm / (cc.vc.speed_ballast_kn * 24) * (1 - ctx.route.backhaul_index)
        + (cc.intake_t / cc.load_rate_tpd if cc.load_rate_tpd else 3.0)
        + (cc.intake_t / cc.disch_rate_tpd if cc.disch_rate_tpd else 4.0)
        + (cc.load_wait.p50 + cc.disch_wait.p50) / 24.0
    )
    per_voyage *= (1 + ctx.weather_stop_fraction)
    sequential = strategy.voyages * per_voyage
    parallel = per_voyage + (strategy.voyages - 1) * 3.0
    need = sequential if strategy.execution == "sequential" else parallel
    budget = ctx.days_to_deadline - settings.charter_lead_time_days
    if need > budget:
        return False, (f"{strategy.execution.capitalize()} execution needs {need:.1f} days "
                       f"but only {budget:.1f} days remain before {ctx.required_by.isoformat()}")
    return True, None
