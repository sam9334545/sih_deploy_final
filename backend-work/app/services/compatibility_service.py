"""Precompute the port × berth × vessel_class × cargo × season compatibility grid.

Blueprint §21. ~1,300 rows, fully deterministic, rebuildable in seconds, and
shippable as a CSV artefact the team can defend line by line.
"""
from __future__ import annotations

from datetime import UTC, date, datetime

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Berth, Compatibility, Port, VesselClass
from app.repositories import reference as ref_repo
from app.services import congestion_service
from app.services.constants import (
    CARGO_TYPES, LIGHTERAGE_PORTS, SEASON_EXPOSURE, SEASONS, months_of_season,
)
from app.services.constraint_service import evaluate_berth
from app.services.scenario import _compat_score


def rebuild(db: Session, as_of: date | None = None) -> int:
    on = as_of or date.today()
    db.query(Compatibility).delete()
    classes: list[VesselClass] = ref_repo.all_vessel_classes(db)
    ports: list[Port] = ref_repo.all_ports(db)
    rows: list[Compatibility] = []

    for port in ports:
        berths = db.execute(select(Berth).where(Berth.port_id == port.port_id)).scalars().all()
        for berth in berths:
            for vc in classes:
                for cargo in CARGO_TYPES:
                    intake = evaluate_berth(vc, berth, cargo, on)
                    for season in SEASONS:
                        rows.append(_row(db, port, berth, vc, cargo, season, intake))

    # U_cost is "cost vs the best feasible option", so it can only be filled in once
    # every option in the group has been costed. Group = port × cargo × season.
    _apply_cost_ratio(rows)
    db.add_all(rows)
    db.commit()
    return len(rows)


def _row(db: Session, port: Port, berth: Berth, vc: VesselClass, cargo: str,
         season: str, intake) -> Compatibility:
    months = months_of_season(season)
    wx_rows = [ref_repo.weather(db, port.port_id, m) for m in months]
    wx = float(np.mean([w.weather_stop_fraction for w in wx_rows if w])) if any(wx_rows) else 0.02

    if not intake.feasible:
        return Compatibility(
            port_id=port.port_id, berth_id=berth.berth_id, vessel_class=vc.vessel_class,
            cargo_type=cargo, season=season, feasible=False,
            infeasible_reason=intake.reason, infeasible_detail=intake.detail,
            max_intake_t=0.0, intake_ratio=0.0,
            handling_rate_tpd=berth.handling_rate_tpd, weather_stop_frac=round(wx, 4),
            requires_lighterage=False, compat_score=0.0, computed_at=datetime.now(UTC),
        )

    waits = [congestion_service.wait_pool(db, port.port_id, vc.vessel_class, m) for m in months]
    p50 = float(np.mean([w.p50 for w in waits]))
    p90 = float(np.mean([w.p90 for w in waits]))
    cargo_days = (intake.max_intake_t / berth.handling_rate_tpd) if berth.handling_rate_tpd else 0.0
    turnaround = cargo_days + p50 / 24.0 + cargo_days * wx
    score, factors = _compat_score(intake.intake_ratio, cargo_days, turnaround, wx, season)

    return Compatibility(
        port_id=port.port_id, berth_id=berth.berth_id, vessel_class=vc.vessel_class,
        cargo_type=cargo, season=season, feasible=True,
        infeasible_reason=None, infeasible_detail=intake.detail,
        max_intake_t=intake.max_intake_t, intake_ratio=intake.intake_ratio,
        handling_rate_tpd=berth.handling_rate_tpd,
        est_cargo_days=round(cargo_days, 2),
        est_wait_hours_p50=round(p50, 2), est_wait_hours_p90=round(p90, 2),
        est_turnaround_days=round(turnaround, 2), weather_stop_frac=round(wx, 4),
        requires_lighterage=port.port_id in LIGHTERAGE_PORTS and intake.draft_limited,
        compat_score=score, u_cargo=factors["u_cargo"], u_time=factors["u_time"],
        u_cost=factors["u_cost"], u_reliability=factors["u_reliability"],
        computed_at=datetime.now(UTC),
    )


def _apply_cost_ratio(rows: list[Compatibility]) -> None:
    """U_cost = min(1, cost_ref / cost_here), with cost proxied by turnaround days
    per tonne lifted — the part of cost the port actually controls."""
    groups: dict[tuple, list[Compatibility]] = {}
    for r in rows:
        if r.feasible and r.max_intake_t:
            groups.setdefault((r.port_id, r.cargo_type, r.season), []).append(r)
    for group in groups.values():
        unit = {r.berth_id + r.vessel_class: (r.est_turnaround_days or 0) / r.max_intake_t * 1e5
                for r in group}
        ref = min(v for v in unit.values() if v > 0) if any(v > 0 for v in unit.values()) else 0
        for r in group:
            here = unit[r.berth_id + r.vessel_class]
            u_cost = min(1.0, ref / here) if here > 0 else 1.0
            r.u_cost = round(u_cost, 3)
            r.compat_score = round(100.0 * r.u_cargo * r.u_time * u_cost * r.u_reliability, 1)


def for_port(db: Session, port_id: str, season: str | None = None,
             cargo_type: str | None = None) -> list[Compatibility]:
    stmt = select(Compatibility).where(Compatibility.port_id == port_id)
    if season:
        stmt = stmt.where(Compatibility.season == season)
    if cargo_type:
        stmt = stmt.where(Compatibility.cargo_type == cargo_type)
    return db.execute(stmt.order_by(Compatibility.compat_score.desc())).scalars().all()


def best_per_class(db: Session, port_id: str, season: str, cargo_type: str) -> list[dict]:
    rows = for_port(db, port_id, season, cargo_type)
    best: dict[str, Compatibility] = {}
    for r in rows:
        cur = best.get(r.vessel_class)
        if cur is None or (r.feasible, r.compat_score or 0) > (cur.feasible, cur.compat_score or 0):
            best[r.vessel_class] = r
    out = []
    for vc, r in best.items():
        out.append({
            "vessel_class": vc, "cargo_type": cargo_type, "season": season,
            "feasible": r.feasible, "berth_id": r.berth_id,
            "max_intake_t": r.max_intake_t, "intake_ratio": r.intake_ratio,
            "compat_score": r.compat_score,
            "factors": {"u_cargo": r.u_cargo, "u_time": r.u_time,
                        "u_cost": r.u_cost, "u_reliability": r.u_reliability},
            "est_turnaround_days": r.est_turnaround_days,
            "est_wait_hours_p50": r.est_wait_hours_p50,
            "est_wait_hours_p90": r.est_wait_hours_p90,
            "requires_lighterage": r.requires_lighterage,
            "infeasible_reason": r.infeasible_reason,
            "infeasible_detail": r.infeasible_detail,
        })
    return sorted(out, key=lambda d: (-int(d["feasible"]), -(d["compat_score"] or 0)))
