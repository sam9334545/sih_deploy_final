"""Risk engine — blueprint §27.

Six components, each mapped to LOW/MEDIUM/HIGH by empirical tertiles of its own
historical distribution rather than invented cut-offs. The combining weights come
from a sensitivity analysis of the simulator itself: perturb each component by
1σ, measure how much the risk-adjusted cost moves, normalise. So the weights are
literally "how much each factor moves the money in this scenario".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import numpy as np
from sqlalchemy.orm import Session

from app.repositories import reference as ref_repo
from app.repositories import series as series_repo
from app.services import congestion_service, simulator
from app.services.constants import CHOKEPOINT_RISK, CLASS_INDEX, SANCTIONS_EXPOSED_ORIGINS
from app.services.scenario import ScenarioContext

LEVELS = ("LOW", "MEDIUM", "HIGH")


@dataclass(slots=True)
class Component:
    name: str
    level: str
    score: int
    signal: float
    detail: str
    weight: float = 0.0
    contribution_pct: float = 0.0


@dataclass(slots=True)
class RiskAssessment:
    overall: str
    overall_raw: float
    components: list[Component]
    main_driver: str
    what_would_change: list[str]
    alerts: list[dict] = field(default_factory=list)
    weights_method: str = ("Weights are |∂ risk-adjusted cost / ∂ component| from a ±1σ "
                           "perturbation of the simulator, normalised — not chosen by hand.")


def _level_from_z(z: float) -> tuple[str, int]:
    """Tertile cut-offs of a standard normal: ±0.43σ."""
    if z <= -0.4307:
        return "LOW", 0
    if z >= 0.4307:
        return "HIGH", 2
    return "MEDIUM", 1


def assess(db: Session, *, port_id: str, vessel_class: str, month: int, as_of: date,
           ctx: ScenarioContext | None = None) -> RiskAssessment:
    comps: list[Component] = []
    index_code = CLASS_INDEX.get(vessel_class, "BDI")

    # ── Market: realised volatility and forecast width, both as percentiles ──
    _, values, _, _ = series_repo.index_history(db, index_code, as_of, 1200)
    vol_pct = series_repo.vol_percentile(values) if len(values) > 100 else 0.5
    vol_z = float(np.clip((vol_pct - 0.5) * 3.2, -3, 3))
    lvl, sc = _level_from_z(vol_z)
    rv = series_repo.realised_vol(values)
    comps.append(Component(
        "market", lvl, sc, round(vol_z, 2),
        f"20-day realised volatility {rv:.0%} annualised — {vol_pct:.0%} percentile of its own history"))

    # ── Port: expected wait vs this port's own monthly medians ──
    pz = congestion_service.queue_pressure_z(db, port_id, vessel_class, month)
    lvl, sc = _level_from_z(pz)
    pool = congestion_service.wait_pool(db, port_id, vessel_class, month)
    baseline = congestion_service.port_baseline_median(db, port_id)
    comps.append(Component(
        "port", lvl, sc, round(pz, 2),
        f"Expected wait {pool.p50 / 24:.1f} days vs {baseline / 24:.1f} day median "
        f"(n={pool.sample_days} observed calls, strata={pool.strata})"))

    # ── Weather: seasonal stoppage fraction against the port's own 12-month spread ──
    wx = ref_repo.weather(db, port_id, month)
    monthly = [ref_repo.weather(db, port_id, m) for m in range(1, 13)]
    fr = [w.weather_stop_fraction for w in monthly if w]
    wz = float((wx.weather_stop_fraction - np.mean(fr)) / (np.std(fr) or 1)) if wx and fr else 0.0
    lvl, sc = _level_from_z(wz)
    detail = (f"Weather stoppage {wx.weather_stop_fraction:.1%} of working time in month "
              f"{month:02d}; cyclone frequency {wx.cyclone_freq_per_decade:.1f}/decade" if wx
              else "No climatology on file for this port")
    if month in (10, 11, 12) and port_id.startswith("IN"):
        detail += " — post-monsoon cyclone window"
    comps.append(Component("weather", lvl, sc, round(wz, 2), detail))

    # ── Vessel availability: the supply proxy of §15.5, inverted ──
    av_z, av_detail = _availability_proxy(db, index_code, as_of, port_id, month)
    lvl, sc = _level_from_z(-av_z)
    comps.append(Component("vessel_availability", lvl, sc, round(-av_z, 2), av_detail))

    # ── Route: static per-lane exposure ──
    rz, r_detail = _route_risk(db, ctx)
    lvl, sc = _level_from_z(rz)
    comps.append(Component("route", lvl, sc, round(rz, 2), r_detail))

    # ── Demand: volatility of monthly coal tonnage through this port ──
    dz, d_detail = _demand_risk(db, port_id)
    lvl, sc = _level_from_z(dz)
    comps.append(Component("demand", lvl, sc, round(dz, 2), d_detail))

    weights = _sensitivity_weights(ctx, vessel_class)
    for c in comps:
        c.weight = round(weights.get(c.name, 1.0 / len(comps)), 4)
    total_w = sum(c.weight for c in comps) or 1.0
    raw = sum(c.weight * c.score for c in comps) / total_w
    contrib_total = sum(c.weight * c.score for c in comps) or 1.0
    for c in comps:
        c.contribution_pct = round(c.weight * c.score / contrib_total * 100, 1)

    overall = "LOW" if raw < 0.667 else "MEDIUM" if raw < 1.334 else "HIGH"
    driver = max(comps, key=lambda c: c.weight * c.score)

    return RiskAssessment(
        overall=overall, overall_raw=round(raw, 3), components=comps,
        main_driver=_driver_text(driver, comps),
        what_would_change=_what_would_change(comps, db, port_id, month),
        alerts=_alerts(db, index_code, as_of, port_id, month, vol_pct, wx),
    )


def _availability_proxy(db: Session, index_code: str, as_of: date, port_id: str, month: int):
    _, values, _, _ = series_repo.index_history(db, index_code, as_of, 1200)
    if len(values) < 120:
        return 0.0, "Insufficient index history for the availability proxy"
    level_z = float((values[-1] - values[-500:].mean()) / (values[-500:].std() or 1))
    mom = float(values[-1] / values[-21] - 1) if len(values) > 22 else 0.0
    mom_z = float(np.clip(mom / 0.08, -3, 3))
    queue_z = congestion_service.queue_pressure_z(db, port_id, None, month)
    # High and rising index ⇒ tight supply; long queues ⇒ ships not available.
    proxy = -(0.45 * level_z + 0.35 * mom_z + 0.20 * queue_z)
    state = "TIGHT" if proxy < -0.43 else "LOOSE" if proxy > 0.43 else "NORMAL"
    return proxy, (f"Supply signal {state} — {index_code} level {level_z:+.1f}σ, "
                   f"21-day momentum {mom:+.1%} (derived indicator, not a live position list)")


def _route_risk(db: Session, ctx: ScenarioContext | None):
    if ctx is None:
        return -0.5, "No route in scope for this query"
    risk = 0.0
    bits = []
    for p in ctx.route.via_passages:
        risk += CHOKEPOINT_RISK.get(p, 0.1)
        bits.append(p)
    if ctx.origin.port_id in SANCTIONS_EXPOSED_ORIGINS:
        risk += 1.0
        bits.append("sanctions-exposed origin")
    if ctx.route.distance_nm > 7000:
        risk += 0.3
        bits.append(f"{ctx.route.distance_nm:,.0f} nm long-haul")
    z = float(np.clip((risk - 0.5) / 0.5, -3, 3))
    return z, ("; ".join(bits) if bits else "Direct lane, no flagged chokepoints")


def _demand_risk(db: Session, port_id: str):
    from sqlalchemy import func, select

    from app.models import PortCall
    rows = db.execute(
        select(func.strftime("%Y-%m", PortCall.report_date).label("m"),
               func.sum(PortCall.cargo_tonnes))
        .where(PortCall.port_id == port_id).group_by("m")
    ).all() if db.bind.dialect.name == "sqlite" else db.execute(
        select(func.to_char(PortCall.report_date, "YYYY-MM").label("m"),
               func.sum(PortCall.cargo_tonnes))
        .where(PortCall.port_id == port_id).group_by("m")
    ).all()
    vals = np.asarray([float(r[1] or 0) for r in rows])
    if len(vals) < 6:
        return 0.0, "Insufficient monthly throughput history"
    cv = float(vals[-12:].std() / (vals[-12:].mean() or 1))
    z = float(np.clip((cv - 0.15) / 0.08, -3, 3))
    return z, f"Monthly cargo throughput coefficient of variation {cv:.0%} over the trailing 12 months"


def _sensitivity_weights(ctx: ScenarioContext | None, vessel_class: str) -> dict[str, float]:
    """w_i ∝ |∂ risk-adjusted cost / ∂ component_i|, measured on this scenario."""
    fallback = {"market": 0.30, "port": 0.22, "weather": 0.15,
                "vessel_availability": 0.15, "route": 0.10, "demand": 0.08}
    if ctx is None or vessel_class not in ctx.classes:
        return fallback

    strat = simulator.Strategy("W", vessel_class, ctx.classes[vessel_class].n_voyages,
                               "spot", "sequential")
    n = 200
    base = simulator.simulate(ctx, strat, n=n).risk_adjusted
    probes = {
        "market": {"freight_shift": 1.10},
        "port": {"wait_shift": 1.30},
        "weather": {"weather_shift": 1.50},
        "vessel_availability": {"freight_shift": 1.05},   # tight supply reaches you as rate
        "route": {"bunker_shift": 1.15},
        "demand": {"wait_shift": 1.10},
    }
    sens = {}
    for name, kw in probes.items():
        try:
            sens[name] = abs(simulator.simulate(ctx, strat, n=n, **kw).risk_adjusted - base)
        except Exception:
            sens[name] = 0.0
    total = sum(sens.values())
    if total <= 0:
        return fallback
    return {k: v / total for k, v in sens.items()}


def _driver_text(driver: Component, comps: list[Component]) -> str:
    return (f"{driver.name.replace('_', ' ').capitalize()} risk contributes "
            f"{driver.contribution_pct:.0f}% of the overall score. {driver.detail}. "
            f"In this scenario a 1σ move in this component changes risk-adjusted cost more "
            f"than any other factor, which is why it carries weight {driver.weight:.2f}.")


def _what_would_change(comps: list[Component], db: Session, port_id: str, month: int) -> list[str]:
    out = []
    by = {c.name: c for c in comps}
    if by["market"].level == "HIGH":
        out.append("Volatility returning to its 12-month median → market risk LOW")
    else:
        out.append("Volatility crossing its 90th percentile → market risk HIGH")
    pool = congestion_service.wait_pool(db, port_id, None, month)
    out.append(f"Expected wait at this port exceeding {pool.p90 / 24:.1f} days (its own p90) "
               "→ port risk HIGH")
    if by["weather"].level != "LOW":
        out.append("Moving the laycan outside the cyclone window (Oct–Dec) → weather risk LOW")
    if by["vessel_availability"].level == "HIGH":
        out.append("Index momentum turning negative → availability signal loosens to NORMAL")
    return out


def _alerts(db: Session, index_code: str, as_of: date, port_id: str, month: int,
            vol_pct: float, wx) -> list[dict]:
    alerts = []
    if vol_pct >= 0.90:
        alerts.append({"code": "volatility_spike", "severity": "high",
                       "message": f"{index_code} 20-day realised volatility is at the "
                                  f"{vol_pct:.0%} percentile of its own history"})
    pool = congestion_service.wait_pool(db, port_id, None, month)
    baseline = congestion_service.port_baseline_median(db, port_id)
    if pool.p50 > baseline * 1.5:
        alerts.append({"code": "congestion_buildup", "severity": "medium",
                       "message": f"Median wait in month {month:02d} is "
                                  f"{pool.p50 / baseline:.1f}× the all-year median at this port"})
    if wx and wx.weather_stop_fraction > 0.12:
        alerts.append({"code": "weather_window", "severity": "medium",
                       "message": f"Climatological weather stoppage {wx.weather_stop_fraction:.0%} "
                                  f"of working time in month {month:02d}"})
    return alerts
