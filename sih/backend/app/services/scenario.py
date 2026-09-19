"""Assemble everything one decision needs, once, from the database.

The simulator and optimiser are pure functions over a ScenarioContext; nothing
below the API layer touches a Session. That keeps a 1,000-path Monte Carlo out
of the ORM and makes every number reproducible from a seed.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Port, Route, VesselClass
from app.repositories import reference as ref_repo
from app.repositories import series as series_repo
from app.services import congestion_service, forecast_service, shadow_freight
from app.services.constraint_service import PortFit, evaluate_port
from app.services.constants import (
    CHOKEPOINT_RISK, CLASS_INDEX, SANCTIONS_EXPOSED_ORIGINS, SEASON_EXPOSURE, season_of,
)
from app.services.cost_model import PortChargeSet, port_charges


class InfeasibleRequest(Exception):
    def __init__(self, reasons: list[dict]):
        self.reasons = reasons
        super().__init__("No vessel class can serve this cargo")


@dataclass(slots=True)
class ClassContext:
    vc: VesselClass
    load_fit: PortFit
    disch_fit: PortFit
    intake_t: float
    binding_port: str
    binding_constraint: str
    load_charges: PortChargeSet
    disch_charges: PortChargeSet
    load_wait: congestion_service.WaitPool
    disch_wait: congestion_service.WaitPool
    load_rate_tpd: float | None
    disch_rate_tpd: float | None
    requires_lighterage: bool
    lighterage_tonnes_per_voyage: float
    index_code: str
    index_point: float
    index_lo: float
    index_hi: float
    tce_usd_day: float
    base_rate_usd_t: shadow_freight.ShadowRate
    forecast_confidence: float
    forecast_mase: float
    forecast_trend: str
    compat_score: float
    compat_factors: dict[str, float]
    arrival_lag_days: int                 # laycan → discharge, for month-of-arrival lookups
    forecast_curve: dict[int, float]      # horizon days → index point, the term structure
    wait_by_month: dict[int, float]       # month → median discharge wait, hours
    weather_by_month: dict[int, float]    # month → weather-stop fraction
    n_voyages: int
    last_parcel_t: float
    stranded_parcel: bool
    rejections: list[dict] = field(default_factory=list)


@dataclass(slots=True)
class ScenarioContext:
    as_of: date
    cargo_type: str
    quantity_t: float
    required_by: date
    origin: Port
    destination: Port
    route: Route
    season: str
    month: int
    weather_stop_fraction: float
    bunker_usd_mt: float
    bunker_vol: float
    fx_usd_inr: float
    fx_date: date | None
    classes: dict[str, ClassContext]
    rejected: list[dict]
    risk_aversion: float
    deadline_miss_penalty_usd: float
    route_risk_flags: list[str]
    assumptions: list[str]

    @property
    def days_to_deadline(self) -> float:
        return (self.required_by - self.as_of).days


def _weather_fraction(db: Session, port_ids: list[str], month: int) -> float:
    fracs = []
    for pid in port_ids:
        w = ref_repo.weather(db, pid, month)
        if w:
            fracs.append(w.weather_stop_fraction)
    return float(np.mean(fracs)) if fracs else 0.02


def build_context(
    db: Session, *, cargo_type: str, quantity_t: float, origin_port: str,
    destination_port: str, required_by: date, as_of: date,
    risk_aversion: float | None = None, deadline_miss_penalty_usd: float | None = None,
) -> ScenarioContext:
    origin = ref_repo.all_ports(db) and db.get(Port, origin_port)
    destination = db.get(Port, destination_port)
    if origin is None or destination is None:
        raise LookupError(f"Unknown port: {origin_port if origin is None else destination_port}")

    route = ref_repo.get_route(db, origin_port, destination_port)
    if route is None:
        raise LookupError(f"No route in dim_route for {origin_port} → {destination_port}")

    # The operating month is when the ship actually works, not when the deadline falls:
    # fixing today means a laycan about `charter_lead_time_days` out, and a discharge
    # one laden passage after that.
    laycan = as_of + timedelta(days=settings.charter_lead_time_days)
    month = laycan.month
    season = season_of(laycan)
    wx = _weather_fraction(db, [origin_port, destination_port], month)

    _, bunker = series_repo.latest_value(db, "BUNKER_VLSFO_SG", as_of)
    _, bunker_hist = series_repo.series_history(db, "BUNKER_VLSFO_SG", as_of, 400)
    bunker = bunker or 550.0
    bunker_vol = series_repo.realised_vol(bunker_hist, 90) if len(bunker_hist) > 95 else 0.25
    fx_date, fx = series_repo.latest_value(db, "USD_INR", as_of)
    fx = fx or settings.fx_usd_inr

    classes: dict[str, ClassContext] = {}
    rejected: list[dict] = []

    for vc in ref_repo.all_vessel_classes(db):
        load_fit = evaluate_port(db, vc, origin_port, cargo_type, as_of)
        disch_fit = evaluate_port(db, vc, destination_port, cargo_type, as_of)
        if not load_fit.feasible:
            rejected.append(_rejection(vc, origin, load_fit))
            continue
        if not disch_fit.feasible:
            rejected.append(_rejection(vc, destination, disch_fit))
            continue

        li, di = load_fit.best.intake, disch_fit.best.intake
        intake = min(li.max_intake_t, di.max_intake_t)
        if intake <= 0:
            rejected.append(_rejection(vc, destination, disch_fit))
            continue

        binding_port, binding_fit = ((origin_port, load_fit) if li.max_intake_t <= di.max_intake_t
                                     else (destination_port, disch_fit))
        binding = ("draft-limited part load" if binding_fit.best.intake.draft_limited
                   else "class capacity")

        lc = port_charges(ref_repo.tariffs(db, origin_port, as_of), vc.grt)
        d_port_for_charges = disch_fit.lighterage_port_id or destination_port
        dc = port_charges(ref_repo.tariffs(db, d_port_for_charges, as_of), vc.grt)
        if disch_fit.requires_lighterage:
            light = port_charges(ref_repo.tariffs(db, disch_fit.lighterage_port_id, as_of), vc.grt)
            dc.lighterage_per_tonne = light.lighterage_per_tonne
            dc.anchorage_per_hour = light.anchorage_per_hour

        arrival = laycan + timedelta(days=route.distance_nm / (vc.speed_laden_kn * 24.0))
        lw = congestion_service.wait_pool(db, origin_port, vc.vessel_class, laycan.month)
        dw = congestion_service.wait_pool(db, destination_port, vc.vessel_class, arrival.month)

        index_code = CLASS_INDEX[vc.vessel_class]
        horizon = _nearest_horizon((required_by - as_of).days)
        fc = forecast_service.get_or_build(db, index_code, horizon, as_of)
        tce = forecast_service.tc_from_index(db, index_code, fc.point, as_of)

        load_rate = load_fit.best.berth.handling_rate_tpd
        disch_rate = disch_fit.best.berth.handling_rate_tpd
        load_days = intake / load_rate if load_rate else 3.0
        disch_days = intake / disch_rate if disch_rate else 4.0

        lighterage_t = intake * 0.5 if disch_fit.requires_lighterage else 0.0

        rate = shadow_freight.estimate(
            vc, tce, route.distance_nm, intake, bunker, lc, dc,
            load_days, disch_days,
            weather_days=(load_days + disch_days) * wx,
            backhaul_index=route.backhaul_index,
            margin=shadow_freight.LANE_MARGIN.get(
                shadow_freight.lane_key(origin.country, destination.country)),
            extra_band=max(0.0, (fc.hi_80 - fc.lo_80) / (2 * fc.point)) if fc.point else 0.0,
        )

        n_voy = max(1, int(-(-quantity_t // intake)))
        last_parcel = quantity_t - (n_voy - 1) * intake

        compat, factors = _compat_score(
            intake_ratio=intake / vc.ref_dwt,
            cargo_days=load_days + disch_days,
            turnaround_days=load_days + disch_days + (lw.p50 + dw.p50) / 24.0,
            weather_stop_frac=wx, season=season,
        )

        classes[vc.vessel_class] = ClassContext(
            vc=vc, load_fit=load_fit, disch_fit=disch_fit, intake_t=intake,
            binding_port=binding_port, binding_constraint=binding,
            load_charges=lc, disch_charges=dc, load_wait=lw, disch_wait=dw,
            load_rate_tpd=load_rate, disch_rate_tpd=disch_rate,
            requires_lighterage=disch_fit.requires_lighterage,
            lighterage_tonnes_per_voyage=lighterage_t,
            index_code=index_code, index_point=fc.point, index_lo=fc.lo_80, index_hi=fc.hi_80,
            tce_usd_day=tce, base_rate_usd_t=rate,
            forecast_confidence=fc.confidence, forecast_mase=fc.validation_mase or 1.0,
            forecast_trend=fc.trend or "stable",
            compat_score=compat, compat_factors=factors,
            forecast_curve=_forecast_curve(db, index_code, as_of),
            wait_by_month={m: congestion_service.wait_pool(
                db, destination_port, vc.vessel_class, m).p50 for m in range(1, 13)},
            arrival_lag_days=(arrival - laycan).days,
            weather_by_month={m: _weather_fraction(db, [origin_port, destination_port], m)
                              for m in range(1, 13)},
            n_voyages=n_voy, last_parcel_t=last_parcel,
            stranded_parcel=(n_voy > 1 and last_parcel / intake < settings.stranded_parcel_ratio),
            rejections=load_fit.rejections + disch_fit.rejections,
        )

    if not classes:
        raise InfeasibleRequest(rejected)

    flags: list[str] = []
    if origin_port in SANCTIONS_EXPOSED_ORIGINS:
        flags.append(f"Origin {origin.port_name} is sanctions-exposed — compliance review required")
    for p in route.via_passages:
        if p in CHOKEPOINT_RISK:
            flags.append(f"Transits {p}")

    return ScenarioContext(
        as_of=as_of, cargo_type=cargo_type, quantity_t=quantity_t, required_by=required_by,
        origin=origin, destination=destination, route=route, season=season, month=month,
        weather_stop_fraction=wx, bunker_usd_mt=float(bunker), bunker_vol=float(bunker_vol),
        fx_usd_inr=float(fx), fx_date=fx_date, classes=classes, rejected=rejected,
        risk_aversion=(settings.default_risk_aversion if risk_aversion is None else risk_aversion),
        deadline_miss_penalty_usd=(settings.default_deadline_miss_penalty_usd
                                   if deadline_miss_penalty_usd is None
                                   else deadline_miss_penalty_usd),
        route_risk_flags=flags,
        assumptions=_assumptions(route),
    )


def _forecast_curve(db: Session, index_code: str, as_of: date) -> dict[int, float]:
    """The forecast term structure. Commit later and you buy at a different point on it —
    that, plus the seasonality of queues and weather, is what makes one day better
    than another."""
    from app.services.constants import HORIZONS
    out = {0: float(series_repo.latest_index(db, index_code, as_of).value)}
    for h in HORIZONS:
        out[h] = forecast_service.get_or_build(db, index_code, h, as_of).point
    return out


def interpolate_curve(curve: dict[int, float], h: float) -> float:
    ks = sorted(curve)
    if h <= ks[0]:
        return curve[ks[0]]
    if h >= ks[-1]:
        return curve[ks[-1]]
    for a, b in zip(ks, ks[1:]):
        if a <= h <= b:
            w = (h - a) / (b - a)
            return curve[a] * (1 - w) + curve[b] * w
    return curve[ks[-1]]


def _rejection(vc: VesselClass, port: Port, fit: PortFit) -> dict:
    src = fit.rejections[0]["source_url"] if fit.rejections else None
    return {"vessel_class": vc.vessel_class, "reason": fit.reason or "infeasible",
            "detail": f"{port.port_name}: {fit.detail}" if fit.detail else f"{port.port_name}: infeasible",
            "port_id": port.port_id, "source": src}


def _nearest_horizon(days: int) -> int:
    from app.services.constants import HORIZONS
    return min(HORIZONS, key=lambda h: abs(h - max(1, days)))


def _compat_score(intake_ratio: float, cargo_days: float, turnaround_days: float,
                  weather_stop_frac: float, season: str,
                  cost_ref: float | None = None, cost_here: float | None = None):
    """Blueprint §21.4 — a product of interpretable ratios, no invented weights."""
    u_cargo = max(0.0, min(1.0, intake_ratio))
    u_time = max(0.0, min(1.0, cargo_days / turnaround_days)) if turnaround_days else 0.0
    u_cost = 1.0 if not (cost_ref and cost_here) else min(1.0, cost_ref / cost_here)
    u_rel = max(0.0, 1.0 - weather_stop_frac * SEASON_EXPOSURE[season])
    score = 100.0 * u_cargo * u_time * u_cost * u_rel
    return round(score, 1), {"u_cargo": round(u_cargo, 3), "u_time": round(u_time, 3),
                             "u_cost": round(u_cost, 3), "u_reliability": round(u_rel, 3)}


def _assumptions(route: Route) -> list[str]:
    return [
        f"Under-keel clearance = max({settings.ukc_min_m} m, "
        f"{settings.ukc_fraction:.0%} of static draft) — stated convention, user-editable",
        f"Multi-voyage contract discount {settings.contract_discount:.0%} on freight — user-editable",
        f"Backhaul availability on this lane = {route.backhaul_index:.2f} "
        "(expert-set 0–1 parameter, documented in docs/assumptions.md)",
        "Demurrage rates are per vessel class from market convention — user-editable",
        "Freight $/t is derived by the shadow freight model, not a Baltic-assessed voyage rate",
        route.caveat or "",
    ]


def charter_windows(as_of: date, required_by: date, lead_time_days: int | None = None,
                    step_days: int = 7) -> list[date]:
    """Commit dates that still leave time to fix a ship and sail."""
    lead = settings.charter_lead_time_days if lead_time_days is None else lead_time_days
    last = required_by - timedelta(days=lead)
    out, d = [], as_of
    while d <= last:
        out.append(d)
        d += timedelta(days=step_days)
    return out or [as_of]
