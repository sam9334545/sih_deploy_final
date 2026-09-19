"""Idle time, low-demand windows and repositioning — blueprint §26.

Three separate things the PS bundles into one sentence, kept separate here:
  A. idle days inside *our* plan — falls out of the simulator,
  B. market-wide low-demand windows — good news for a charterer, so framed that way,
  C. ballast/deadheading — priced as the premium owners put into the rate.
"""
from __future__ import annotations

from datetime import date, timedelta

import numpy as np
from sqlalchemy.orm import Session

from app.models import Port
from app.repositories import reference as ref_repo
from app.repositories import series as series_repo
from app.services import forecast_service
from app.services.constants import CLASS_INDEX
from app.services.cost_model import repositioning_cost, sea_days


def low_demand_strip(db: Session, vessel_class: str, as_of: date, months: int = 6) -> dict:
    """low_demand(class, month) = forecast p50 < 30th percentile of that calendar
    month's history over the last 5 years. Simple, checkable, and the right sign
    for a charterer: a soft window is when you want to commit volume."""
    index_code = CLASS_INDEX[vessel_class]
    dates, values, _, _ = series_repo.index_history(db, index_code, as_of, 5 * 366)
    by_month: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    for d, v in zip(dates, values):
        by_month[d.month].append(float(v))

    strip = []
    cursor = as_of
    for i in range(months):
        target = (cursor.replace(day=1) + timedelta(days=32 * (i + 1))).replace(day=1)
        horizon = max(7, (target - as_of).days)
        h = min([7, 14, 28, 60, 90, 180], key=lambda x: abs(x - horizon))
        fc = forecast_service.get_or_build(db, index_code, h, as_of)
        hist = by_month.get(target.month) or list(values)
        p30 = float(np.percentile(hist, 30)) if hist else 0.0
        p70 = float(np.percentile(hist, 70)) if hist else 0.0
        regime = "LOW" if fc.point < p30 else "HIGH" if fc.point > p70 else "NORMAL"
        strip.append({
            "month": target.strftime("%Y-%m"),
            "horizon_days": h,
            "forecast_point": fc.point,
            "interval_80": [fc.lo_80, fc.hi_80],
            "month_p30_history": round(p30, 1),
            "month_p70_history": round(p70, 1),
            "regime": regime,
            "charterer_reading": {
                "LOW": "Soft window — favourable for committing volume on a multi-voyage contract",
                "NORMAL": "Neither side has the advantage; fix on operational grounds",
                "HIGH": "Firm market — prefer spot cover and shorter commitments",
            }[regime],
        })

    soft = [s["month"] for s in strip if s["regime"] == "LOW"]
    return {
        "vessel_class": vessel_class, "index": index_code, "as_of": as_of.isoformat(),
        "strip": strip,
        "headline": (f"Forecast soft window for {vessel_class}: {', '.join(soft)} — "
                     "favourable for committing volume"
                     if soft else
                     f"No soft window for {vessel_class} in the next {months} months"),
        "method": ("Regime is LOW when the forecast p50 sits below the 30th percentile of the "
                   "same calendar month over the last five years."),
    }


def ballast_matrix(db: Session, vessel_class: str, as_of: date,
                   from_port: str | None = None) -> dict:
    """Ballast cost between every pair in our port registry, for one class."""
    vc = ref_repo.get_vessel_class(db, vessel_class)
    if vc is None:
        raise LookupError(f"Unknown vessel class {vessel_class}")
    _, bunker = series_repo.latest_value(db, "BUNKER_VLSFO_SG", as_of)
    bunker = bunker or 550.0

    ports: list[Port] = ref_repo.all_ports(db)
    rows = []
    for a in ports:
        if from_port and a.port_id != from_port:
            continue
        for b in ports:
            if a.port_id == b.port_id:
                continue
            route = ref_repo.get_route(db, a.port_id, b.port_id) or \
                ref_repo.get_route(db, b.port_id, a.port_id)
            if route is None:
                continue
            days = sea_days(route.distance_nm, vc.speed_ballast_kn)
            cost = repositioning_cost(vc, route.distance_nm, bunker, 0.0)
            rows.append({
                "from_port": a.port_id, "to_port": b.port_id,
                "distance_nm": route.distance_nm, "ballast_days": round(days, 2),
                "ballast_cost_usd": round(cost, 2),
                "backhaul_index": route.backhaul_index,
                "priced_into_rate_usd": round(cost * (1 - route.backhaul_index), 2),
            })
    rows.sort(key=lambda r: r["ballast_cost_usd"])
    return {"vessel_class": vessel_class, "bunker_usd_mt": round(float(bunker), 2),
            "as_of": as_of.isoformat(), "rows": rows,
            "note": ("For a charterer the actionable output is not 'send the ship to X' but "
                     "'this lane has weak backhaul, so expect owners to price ballast into the "
                     "rate'. The priced_into_rate column is that premium.")}


def backhaul_insight(db: Session, origin_port: str, destination_port: str,
                     vessel_class: str, as_of: date) -> dict:
    route = ref_repo.get_route(db, origin_port, destination_port)
    if route is None:
        raise LookupError(f"No route {origin_port} → {destination_port}")
    vc = ref_repo.get_vessel_class(db, vessel_class)
    _, bunker = series_repo.latest_value(db, "BUNKER_VLSFO_SG", as_of)
    bunker = bunker or 550.0
    premium = repositioning_cost(vc, route.distance_nm, bunker, route.backhaul_index)

    alternatives = []
    for r in ref_repo.all_ports(db, role="load"):
        alt = ref_repo.get_route(db, r.port_id, destination_port)
        if alt and alt.backhaul_index > route.backhaul_index:
            alternatives.append({"origin_port": r.port_id, "port_name": r.port_name,
                                 "backhaul_index": alt.backhaul_index,
                                 "distance_nm": alt.distance_nm})
    alternatives.sort(key=lambda a: -a["backhaul_index"])
    return {
        "route_id": route.route_id, "backhaul_index": route.backhaul_index,
        "ballast_premium_usd": round(premium, 2),
        "message": (f"This lane has a backhaul availability of {route.backhaul_index:.2f}; "
                    f"expect owners to price roughly ${premium:,.0f} of ballast into the rate "
                    f"for a {vessel_class}."),
        "better_backhaul_origins": alternatives[:4],
        "parameter_note": "backhaul_index is an expert-set 0–1 parameter, documented per lane.",
    }
