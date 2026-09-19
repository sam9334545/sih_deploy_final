"""Hard feasibility and draft-limited intake — blueprint §21.3, §24.1.

Deterministic, no ML, no tuned parameters. Every rejection carries a reason and
the numbers behind it, because showing the rejected options with reasons is more
convincing than showing only the winner.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Berth, Port, VesselClass
from app.services.constants import LIGHTERAGE_PORTS


@dataclass(slots=True)
class IntakeResult:
    feasible: bool
    max_intake_t: float
    intake_ratio: float
    reason: str | None = None
    detail: str | None = None
    allowed_draft_m: float = 0.0
    ukc_m: float = 0.0
    draft_limited: bool = False
    severe_partload: bool = False


@dataclass(slots=True)
class BerthFit:
    berth: Berth
    intake: IntakeResult


@dataclass(slots=True)
class PortFit:
    """Best berth at a port for a (class, cargo) pair, plus every rejection reason."""
    port_id: str
    feasible: bool
    best: BerthFit | None = None
    requires_lighterage: bool = False
    lighterage_port_id: str | None = None
    reason: str | None = None
    detail: str | None = None
    rejections: list[dict] = field(default_factory=list)


def under_keel_clearance(static_draft_m: float) -> float:
    """10% UKC convention, floored — a stated assumption, not a data point."""
    return max(settings.ukc_min_m, settings.ukc_fraction * static_draft_m)


def draft_limited_intake(vc: VesselClass, berth: Berth) -> IntakeResult:
    """max_intake_t from the berth's permissible draft and the class TPC.

        allowed_draft = max_draft + tide_allowance − UKC
        deficit       = ref_draft − allowed_draft          (if positive)
        intake        = ref_dwt − constants − deficit × 100 × TPC
    """
    ukc = under_keel_clearance(vc.ref_draft_m)
    allowed = (berth.max_draft_m or 0.0) + (berth.tide_allowance_m or 0.0) - ukc
    usable_dwt = vc.ref_dwt - vc.constants_t

    if allowed >= vc.ref_draft_m:
        intake = usable_dwt
        draft_limited = False
    else:
        deficit = vc.ref_draft_m - allowed
        intake = usable_dwt - deficit * 100.0 * vc.tpc
        draft_limited = True

    if berth.max_dwt:
        intake = min(intake, berth.max_dwt - vc.constants_t)

    intake = max(0.0, intake)
    ratio = intake / vc.ref_dwt if vc.ref_dwt else 0.0

    if intake <= 0:
        return IntakeResult(
            False, 0.0, 0.0, "draft",
            f"Requires {vc.ref_draft_m:.1f} m plus {ukc:.1f} m UKC; "
            f"{berth.berth_name} permits {allowed:.1f} m effective — no cargo can be lifted",
            allowed, ukc, True,
        )

    severe = ratio < settings.severe_partload_ratio
    return IntakeResult(
        True, round(intake), round(ratio, 3), None,
        (f"Part-load at {ratio:.0%} of class deadweight — {allowed:.1f} m effective draft "
         f"vs {vc.ref_draft_m:.1f} m loaded" if draft_limited else None),
        allowed, ukc, draft_limited, severe,
    )


def evaluate_berth(vc: VesselClass, berth: Berth, cargo_type: str, on: date) -> IntakeResult:
    if not berth.is_effective(on):
        return IntakeResult(False, 0, 0, "berth_unavailable",
                            f"{berth.berth_name} not in effect on {on.isoformat()}")
    if berth.status != "operational":
        return IntakeResult(False, 0, 0, "berth_unavailable",
                            f"{berth.berth_name} status is '{berth.status}'")
    if cargo_type not in berth.cargo_types:
        return IntakeResult(False, 0, 0, "cargo_not_handled",
                            f"{berth.berth_name} handles {', '.join(berth.cargo_types)} — not {cargo_type}")
    if berth.max_loa_m is not None and vc.ref_loa_m > berth.max_loa_m:
        return IntakeResult(False, 0, 0, "loa",
                            f"Requires {vc.ref_loa_m:.0f} m LOA; {berth.berth_name} maximum {berth.max_loa_m:.0f} m")
    if berth.min_loa_m is not None and vc.ref_loa_m < berth.min_loa_m:
        return IntakeResult(False, 0, 0, "loa",
                            f"{vc.ref_loa_m:.0f} m LOA below {berth.berth_name} minimum {berth.min_loa_m:.0f} m")
    if berth.max_beam_m is not None and vc.ref_beam_m > berth.max_beam_m:
        return IntakeResult(False, 0, 0, "beam",
                            f"Requires {vc.ref_beam_m:.1f} m beam; {berth.berth_name} maximum {berth.max_beam_m:.1f} m")
    return draft_limited_intake(vc, berth)


def evaluate_port(
    db: Session, vc: VesselClass, port_id: str, cargo_type: str, on: date,
    allow_lighterage: bool = True,
) -> PortFit:
    """Pick the berth that lifts the most cargo; keep every rejection reason."""
    berths = db.query(Berth).filter(Berth.port_id == port_id).all()
    if not berths:
        return PortFit(port_id, False, reason="not_found",
                       detail=f"No berth records for port {port_id}")

    fits: list[BerthFit] = []
    rejections: list[dict] = []
    for b in berths:
        r = evaluate_berth(vc, b, cargo_type, on)
        if r.feasible:
            fits.append(BerthFit(b, r))
        else:
            rejections.append({"berth_id": b.berth_id, "berth_name": b.berth_name,
                               "reason": r.reason, "detail": r.detail,
                               "source_url": b.source_url})

    if fits:
        best = max(fits, key=lambda f: f.intake.max_intake_t)
        return PortFit(port_id, True, best=best, rejections=rejections)

    # Nothing direct. Haldia-style ports can still be served via a lighterage anchorage.
    light_id = LIGHTERAGE_PORTS.get(port_id)
    if allow_lighterage and light_id:
        alt = evaluate_port(db, vc, light_id, cargo_type, on, allow_lighterage=False)
        if alt.feasible:
            alt.port_id = port_id
            alt.requires_lighterage = True
            alt.lighterage_port_id = light_id
            alt.rejections = rejections
            return alt

    worst = _binding_rejection(rejections)
    return PortFit(port_id, False, reason=worst["reason"], detail=worst["detail"],
                   rejections=rejections)


def _binding_rejection(rejections: list[dict]) -> dict:
    """The reason we report is the one that blocked the *most promising* berth."""
    order = {"draft": 0, "beam": 1, "loa": 2, "cargo_not_handled": 3, "berth_unavailable": 4}
    if not rejections:
        return {"reason": "not_found", "detail": "No berths evaluated"}
    return sorted(rejections, key=lambda r: order.get(r["reason"] or "", 9))[0]


def route_intake(load: PortFit, disch: PortFit) -> float:
    """The binding port wins (blueprint §24.2)."""
    return min(load.best.intake.max_intake_t, disch.best.intake.max_intake_t)


def get_vessel_classes(db: Session) -> list[VesselClass]:
    return db.query(VesselClass).order_by(VesselClass.ref_dwt).all()


def get_port(db: Session, port_id: str) -> Port | None:
    return db.get(Port, port_id)
