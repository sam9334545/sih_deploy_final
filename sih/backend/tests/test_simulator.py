"""Simulator behaviour, and the equivalence that justifies its vectorised inner loop."""
from __future__ import annotations

from datetime import date

import numpy as np
import pytest

from app.services import optimizer, simulator
from app.services.cost_model import (
    PortChargeSet, laytime_days_for, repositioning_cost, voyage_cost, voyage_timing,
)
from app.services.scenario import build_context

AS_OF = date(2026, 9, 15)


@pytest.fixture()
def ctx(db):
    return build_context(db, cargo_type="coking_coal", quantity_t=120000,
                         origin_port="AUHPT", destination_port="INPRT",
                         required_by=date(2026, 12, 20), as_of=AS_OF)


def _pin(ctx, cls="Panamax", wait_hours=36.0):
    """Collapse every random input so the Monte Carlo becomes one deterministic path."""
    cc = ctx.classes[cls]
    rate = cc.base_rate_usd_t
    rate.lo_80 = rate.hi_80 = rate.usd_per_tonne
    cc.load_wait.samples = np.asarray([wait_hours])
    cc.disch_wait.samples = np.asarray([wait_hours])
    ctx.weather_stop_fraction = 0.0
    ctx.bunker_vol = 0.0
    return cc


def test_vectorised_simulation_matches_the_cost_model_exactly(db):
    """The simulator inlines cost_model's arithmetic over numpy arrays for speed.
    With every distribution pinned, the two must agree to the cent."""
    ctx = build_context(db, cargo_type="coking_coal", quantity_t=70000,
                        origin_port="AUHPT", destination_port="INPRT",
                        required_by=date(2026, 12, 20), as_of=AS_OF)
    cc = _pin(ctx)
    strat = simulator.Strategy("T", "Panamax", 1, "spot", "sequential")
    res = simulator.simulate(ctx, strat, n=64)

    tonnes = ctx.quantity_t
    timing = voyage_timing(cc.vc, ctx.route.distance_nm, tonnes, cc.load_rate_tpd,
                           cc.disch_rate_tpd, 36.0, 36.0, 0.0)
    laytime = (laytime_days_for(cc.intake_t, cc.load_rate_tpd)
               + laytime_days_for(cc.intake_t, cc.disch_rate_tpd))
    expected = voyage_cost(cc.vc, timing, tonnes, cc.base_rate_usd_t.usd_per_tonne,
                           ctx.bunker_usd_mt, cc.load_charges, cc.disch_charges, laytime)
    expected.repositioning = repositioning_cost(
        cc.vc, ctx.route.distance_nm, ctx.bunker_usd_mt, ctx.route.backhaul_index,
        cc.load_charges.port_dues) * 0.5

    assert res.mean == pytest.approx(expected.total, rel=1e-9)
    assert res.breakdown["freight"] == pytest.approx(expected.freight, rel=1e-9)
    assert res.breakdown["expected_demurrage"] == pytest.approx(expected.expected_demurrage,
                                                                rel=1e-9)


def test_the_same_seed_gives_the_same_answer(ctx):
    strat = simulator.Strategy("T", "Panamax", 2, "spot", "sequential")
    a = simulator.simulate(ctx, strat, n=300, seed=7)
    b = simulator.simulate(ctx, strat, n=300, seed=7)
    assert a.mean == b.mean and a.cvar_90 == b.cvar_90


def test_cost_quantiles_are_ordered_and_cvar_sits_in_the_tail(ctx):
    strat = simulator.Strategy("T", "Panamax", 2, "spot", "sequential")
    r = simulator.simulate(ctx, strat, n=800)
    assert r.p10 <= r.p50 <= r.p90 <= r.cvar_90
    assert r.mean > 0 and 0.0 <= r.p_deadline_miss <= 1.0


def test_risk_adjusted_cost_penalises_the_tail_and_the_deadline(ctx):
    strat = simulator.Strategy("T", "Panamax", 2, "spot", "sequential")
    ctx.risk_aversion = 0.0
    neutral = simulator.simulate(ctx, strat, n=500, seed=3)
    ctx.risk_aversion = 1.0
    averse = simulator.simulate(ctx, strat, n=500, seed=3)
    assert averse.risk_adjusted > neutral.risk_adjusted
    assert neutral.risk_adjusted == pytest.approx(
        neutral.mean + ctx.deadline_miss_penalty_usd * neutral.p_deadline_miss, rel=1e-9)


def test_a_multi_voyage_contract_is_cheaper_and_less_volatile_than_spot(ctx):
    spot = simulator.Strategy("A", "Panamax", 2, "spot", "sequential")
    coa = simulator.Strategy("B", "Panamax", 2, "multi_voyage", "sequential")
    rs = simulator.simulate(ctx, spot, n=800, seed=11)
    rc = simulator.simulate(ctx, coa, n=800, seed=11)
    assert rc.mean < rs.mean            # the contract discount
    assert rc.std < rs.std              # and a fixed rate sheds variance


def test_more_voyages_on_one_ship_means_more_days(db):
    small = build_context(db, cargo_type="coking_coal", quantity_t=70000,
                          origin_port="AUHPT", destination_port="INPRT",
                          required_by=date(2027, 3, 1), as_of=AS_OF)
    big = build_context(db, cargo_type="coking_coal", quantity_t=150000,
                        origin_port="AUHPT", destination_port="INPRT",
                        required_by=date(2027, 3, 1), as_of=AS_OF)
    one = simulator.simulate(small, simulator.Strategy("A", "Panamax", 1, "spot", "sequential"),
                             n=200, seed=5)
    two = simulator.simulate(big, simulator.Strategy("B", "Panamax", 2, "spot", "sequential"),
                             n=200, seed=5)
    assert two.total_days_mean > one.total_days_mean


def test_parallel_execution_finishes_sooner_than_sequential(ctx):
    seq = simulator.simulate(ctx, simulator.Strategy("A", "Panamax", 2, "spot", "sequential"),
                             n=200, seed=5)
    par = simulator.simulate(ctx, simulator.Strategy("B", "Panamax", 2, "spot", "parallel"),
                             n=200, seed=5)
    assert par.total_days_mean < seq.total_days_mean


def test_a_voyage_count_that_cannot_lift_the_cargo_adds_a_voyage_not_an_overload(ctx):
    cc = ctx.classes["Panamax"]
    parcels = simulator._parcels(ctx, cc, voyages=1)
    assert sum(parcels) == pytest.approx(ctx.quantity_t)
    assert max(parcels) <= cc.intake_t          # never load past the draft limit


def test_enumeration_never_offers_a_one_voyage_contract_or_a_parallel_singleton(ctx):
    for s in simulator.enumerate_strategies(ctx):
        assert not (s.structure == "multi_voyage" and s.voyages < 2)
        assert not (s.execution == "parallel" and s.voyages == 1)


def test_ranking_is_sorted_and_infeasible_options_keep_their_reasons(ctx):
    r = optimizer.rank_strategies(ctx, n_simulations=200)
    costs = [x.risk_adjusted for x in r.results]
    assert costs == sorted(costs)
    assert r.winner is r.results[0]
    for item in r.infeasible:
        assert item["reason"] and item["detail"]


def test_explanation_names_the_binding_constraint_and_the_deadline(ctx):
    r = optimizer.rank_strategies(ctx, n_simulations=200)
    lines = optimizer.explain(ctx, r.winner, r.results[1:])
    joined = " ".join(lines)
    assert "Paradip" in joined and "deadline" in joined
    assert any("intake" in line for line in lines)
