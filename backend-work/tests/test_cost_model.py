"""Cost model unit tests, plus the equivalence check that lets the simulator vectorise."""
from __future__ import annotations

import numpy as np
import pytest

from app.models import VesselClass
from app.services.cost_model import (
    PortChargeSet, cargo_days, laytime_days_for, port_charges, repositioning_cost,
    sea_days, to_inr, voyage_cost, voyage_timing,
)
from app.services.simulator import _sample_lognormal_from_band


def _vc() -> VesselClass:
    return VesselClass(vessel_class="Supramax", ref_dwt=63000, ref_draft_m=13.35,
                       ref_loa_m=199, ref_beam_m=32.26, tpc=58, speed_laden_kn=14,
                       speed_ballast_kn=14, cons_laden_mt_day=29, cons_ballast_mt_day=25,
                       geared=True, constants_t=2400, demurrage_usd_day=14000, grt=35000,
                       source_url="x", retrieved_at=None)


def test_sea_days_is_distance_over_speed():
    assert sea_days(5180, 14.0) == pytest.approx(5180 / (14 * 24))


def test_cargo_days_handles_a_missing_published_rate():
    assert cargo_days(60000, None) == 0.0
    assert cargo_days(60000, 30000) == 2.0


def test_waiting_inside_laytime_is_not_billed_as_demurrage():
    vc = _vc()
    t = voyage_timing(vc, 5180, 60000, 30000, 30000, load_wait_hours=12,
                      disch_wait_hours=12, weather_stop_fraction=0.0)
    laytime = laytime_days_for(60000, 30000) * 2
    c = voyage_cost(vc, t, 60000, 20.0, 600.0, PortChargeSet(), PortChargeSet(), laytime)
    assert c.expected_demurrage == 0.0
    assert c.waiting > 0


def test_waiting_beyond_laytime_becomes_demurrage_at_the_class_rate():
    vc = _vc()
    t = voyage_timing(vc, 5180, 60000, 30000, 30000, load_wait_hours=240,
                      disch_wait_hours=240, weather_stop_fraction=0.0)
    c = voyage_cost(vc, t, 60000, 20.0, 600.0, PortChargeSet(), PortChargeSet(),
                    laytime_days=2.0)
    over = (480 / 24) - 2.0
    assert c.expected_demurrage == pytest.approx(over * vc.demurrage_usd_day)


def test_freight_dominates_and_total_is_the_sum_of_its_parts():
    vc = _vc()
    t = voyage_timing(vc, 5180, 60000, 30000, 30000, 24, 24, 0.02)
    c = voyage_cost(vc, t, 60000, 20.0, 600.0,
                    PortChargeSet(port_dues=9000, pilotage=7000),
                    PortChargeSet(port_dues=11000, pilotage=8000, wharfage_per_tonne=0.52), 4.0)
    assert c.freight == pytest.approx(1_200_000)
    assert c.total == pytest.approx(c.freight + c.bunker + c.port_costs + c.waiting
                                    + c.expected_demurrage + c.lighterage + c.repositioning)


def test_idle_days_count_waiting_and_weather_but_not_cargo_work():
    t = voyage_timing(_vc(), 5180, 60000, 30000, 30000, 48, 72, 0.05)
    assert t.idle_days == pytest.approx(48 / 24 + 72 / 24 + t.weather_days)
    assert t.port_days > t.idle_days - t.weather_days


def test_a_perfect_backhaul_removes_the_ballast_premium():
    vc = _vc()
    assert repositioning_cost(vc, 5180, 600.0, backhaul_index=1.0) == 0.0
    assert repositioning_cost(vc, 5180, 600.0, backhaul_index=0.0) > 0


def test_tariffs_outside_their_grt_slab_are_skipped():
    from datetime import date

    from app.models import PortTariff
    slabbed = PortTariff(port_id="P", charge_type="pilotage", basis="per_grt", slab_min=0,
                         slab_max=30000, rate_foreign_usd=0.28, min_charge_usd=0,
                         effective_from=date(2024, 4, 1), source_url="x",
                         verification="manually_verified")
    assert port_charges([slabbed], grt=44000).pilotage == 0.0
    assert port_charges([slabbed], grt=20000).pilotage == pytest.approx(0.28 * 20000)


def test_estimated_tariffs_propagate_their_provenance():
    from datetime import date

    from app.models import PortTariff
    t = PortTariff(port_id="P", charge_type="port_dues", basis="per_grt", slab_min=0,
                   rate_foreign_usd=0.3, min_charge_usd=0, effective_from=date(2024, 4, 1),
                   source_url="x", verification="estimated")
    assert port_charges([t], 35000).provenance == "estimated"


def test_inr_conversion_uses_the_supplied_rate():
    assert to_inr(1000, 83.0) == 83000.0


def test_freight_sampler_reproduces_the_requested_80_percent_band():
    rng = np.random.default_rng(1)
    draws = _sample_lognormal_from_band(rng, 20.0, 18.0, 22.0, 200_000)
    assert np.percentile(draws, 10) == pytest.approx(18.0, rel=0.02)
    assert np.percentile(draws, 90) == pytest.approx(22.0, rel=0.02)
