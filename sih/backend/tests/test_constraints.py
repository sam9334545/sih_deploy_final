"""The constraint layer is the part a juror will poke at, so it is tested hardest."""
from __future__ import annotations

from datetime import date

import pytest

from app.models import Berth, VesselClass
from app.services.constraint_service import (
    draft_limited_intake, evaluate_berth, evaluate_port, under_keel_clearance,
)

ON = date(2026, 9, 15)


def _vc(**kw) -> VesselClass:
    base = dict(vessel_class="Test", index_code="BSI", ref_dwt=63000, ref_draft_m=13.35,
                ref_loa_m=199.0, ref_beam_m=32.26, tpc=58.0, speed_laden_kn=14.0,
                speed_ballast_kn=14.0, cons_laden_mt_day=29.0, cons_ballast_mt_day=25.0,
                geared=True, dwt_min=45000, dwt_max=65000, constants_t=2400,
                demurrage_usd_day=14000, grt=35000, source_url="x",
                retrieved_at=date(2026, 9, 10))
    base.update(kw)
    return VesselClass(**base)


def _berth(**kw) -> Berth:
    base = dict(berth_id="B1", port_id="P", berth_name="Berth 1",
                cargo_types_raw="coking_coal|thermal_coal", max_loa_m=300.0, min_loa_m=120.0,
                max_beam_m=48.0, max_draft_m=14.5, tide_allowance_m=0.5, max_dwt=None,
                handling_rate_tpd=30000.0, status="operational",
                effective_from=date(2024, 4, 1), effective_to=None, source_url="x",
                retrieved_at=date(2026, 9, 10), verification="manually_verified")
    base.update(kw)
    return Berth(**base)


def test_ukc_is_ten_percent_with_a_floor():
    assert under_keel_clearance(18.2) == pytest.approx(1.82)
    assert under_keel_clearance(2.0) == 0.5          # floor binds on tiny drafts


def test_unrestricted_berth_gives_full_deadweight_less_constants():
    r = draft_limited_intake(_vc(), _berth(max_draft_m=18.0))
    assert r.feasible and not r.draft_limited
    assert r.max_intake_t == pytest.approx(63000 - 2400)


def test_draft_deficit_is_priced_at_tpc():
    # allowed = 12.0 + 0.5 − 1.335 = 11.165; deficit 2.185 m → 2.185 × 100 × 58 t
    vc, berth = _vc(), _berth(max_draft_m=12.0)
    r = draft_limited_intake(vc, berth)
    expected = 63000 - 2400 - (13.35 - (12.0 + 0.5 - 1.335)) * 100 * 58
    assert r.draft_limited
    assert r.max_intake_t == pytest.approx(round(expected), abs=1)
    assert r.intake_ratio < 1.0


def test_severe_partload_is_flagged_not_hidden():
    r = draft_limited_intake(_vc(), _berth(max_draft_m=9.0))
    assert r.feasible and r.severe_partload
    assert r.intake_ratio < 0.5


def test_deep_ship_at_a_shallow_berth_is_a_part_load_not_a_silent_full_load():
    # 24% of a Capesize is commercially absurd but physically real, so we carry it
    # through flagged rather than rejecting it — the cost ranking then kills it.
    cape = _vc(ref_dwt=180000, ref_draft_m=18.2, tpc=125.0, constants_t=6000)
    r = draft_limited_intake(cape, _berth(max_draft_m=9.0))
    assert r.feasible and r.severe_partload and r.intake_ratio < 0.3


def test_intake_clamps_at_zero_and_reports_draft_as_the_reason():
    cape = _vc(ref_dwt=180000, ref_draft_m=18.2, tpc=125.0, constants_t=6000)
    r = draft_limited_intake(cape, _berth(max_draft_m=4.0, tide_allowance_m=0.0))
    assert not r.feasible and r.reason == "draft"
    assert r.max_intake_t == 0.0


@pytest.mark.parametrize("kwargs,reason", [
    ({"max_loa_m": 180.0}, "loa"),
    ({"min_loa_m": 250.0}, "loa"),
    ({"max_beam_m": 32.0}, "beam"),
    ({"cargo_types_raw": "iron_ore"}, "cargo_not_handled"),
    ({"status": "under_maintenance"}, "berth_unavailable"),
])
def test_each_hard_constraint_rejects_with_its_own_reason(kwargs, reason):
    r = evaluate_berth(_vc(), _berth(**kwargs), "coking_coal", ON)
    assert not r.feasible and r.reason == reason
    assert r.detail                                   # a rejection always explains itself


def test_berth_outside_its_effective_window_is_unavailable():
    r = evaluate_berth(_vc(), _berth(effective_from=date(2027, 1, 1)), "coking_coal", ON)
    assert not r.feasible and r.reason == "berth_unavailable"


def test_paradip_western_dock_lets_a_capesize_in(db):
    vc = db.get(VesselClass, "Capesize")
    fit = evaluate_port(db, vc, "INPRT", "coking_coal", ON)
    assert fit.feasible
    assert fit.best.berth.berth_id == "INPRT-WD1"     # the deepest berth that takes coking coal


def test_haldia_falls_back_to_sandheads_lighterage(db):
    vc = db.get(VesselClass, "Capesize")
    fit = evaluate_port(db, vc, "INHAL", "coking_coal", ON)
    assert fit.feasible and fit.requires_lighterage
    assert fit.lighterage_port_id == "INSGD"
    assert fit.rejections                              # the direct berths are still explained


def test_gopalpur_cannot_take_a_capesize_at_all(db):
    vc = db.get(VesselClass, "Capesize")
    fit = evaluate_port(db, vc, "INGPR", "coking_coal", ON)
    assert not fit.feasible
    assert fit.reason in ("draft", "loa", "beam")
