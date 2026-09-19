from __future__ import annotations

from datetime import date

import numpy as np
import pytest

from app.models import Compatibility
from app.services import compatibility_service, congestion_service, forecast_model
from app.services.constants import CARGO_TYPES, SEASONS, season_of_month
from app.services.scenario import _compat_score, interpolate_curve

AS_OF = date(2026, 9, 15)


def test_the_grid_covers_every_berth_class_cargo_season_combination(db):
    rows = db.query(Compatibility).count()
    berths = len({r.berth_id for r in db.query(Compatibility).all()})
    assert rows == berths * 4 * len(CARGO_TYPES) * len(SEASONS)


def test_score_is_a_product_of_ratios_so_a_zero_factor_zeroes_the_score():
    score, f = _compat_score(intake_ratio=0.0, cargo_days=2, turnaround_days=3,
                             weather_stop_frac=0.02, season="winter")
    assert score == 0.0
    score, f = _compat_score(intake_ratio=1.0, cargo_days=3, turnaround_days=3,
                             weather_stop_frac=0.0, season="winter")
    assert score == pytest.approx(100.0)
    assert f["u_cargo"] == 1.0 and f["u_time"] == 1.0


def test_a_part_load_scores_below_a_full_load_at_the_same_port():
    full, _ = _compat_score(0.98, 3, 4, 0.02, "post_monsoon")
    part, _ = _compat_score(0.45, 3, 4, 0.02, "post_monsoon")
    assert part < full


def test_monsoon_exposure_lowers_reliability_more_than_winter():
    wet, _ = _compat_score(0.9, 3, 4, 0.10, "monsoon")
    dry, _ = _compat_score(0.9, 3, 4, 0.10, "winter")
    assert wet < dry


def test_infeasible_rows_keep_the_reason_that_ruled_them_out(db):
    rows = compatibility_service.for_port(db, "INHAL")
    bad = [r for r in rows if not r.feasible]
    assert bad and all(r.infeasible_reason for r in bad)
    assert all(r.compat_score == 0 for r in bad)


def test_best_per_class_prefers_feasible_then_score(db):
    rows = compatibility_service.best_per_class(db, "INPRT", "post_monsoon", "coking_coal")
    assert [r["feasible"] for r in rows] == sorted((r["feasible"] for r in rows), reverse=True)
    feasible = [r for r in rows if r["feasible"]]
    assert [r["compat_score"] for r in feasible] == sorted(
        (r["compat_score"] for r in feasible), reverse=True)


def test_season_mapping_matches_the_bay_of_bengal_calendar():
    assert season_of_month(7) == "monsoon"
    assert season_of_month(11) == "post_monsoon"
    assert season_of_month(1) == "winter"


# ─────────────────────────── congestion ───────────────────────────

def test_wait_pool_backs_off_stratification_until_the_sample_is_usable(db):
    fine = congestion_service.wait_pool(db, "INPRT", "Capesize", 2)
    assert fine.sample_days >= 25
    assert fine.strata in ("port+class+month", "port+class", "port+month", "port")


def test_an_unknown_port_falls_back_to_a_declared_prior(db):
    pool = congestion_service.wait_pool(db, "ZZZZZ")
    assert pool.strata == "default_prior" and pool.sample_days == 0


def test_waiting_quantiles_are_ordered(db):
    pool = congestion_service.wait_pool(db, "INPRT", "Panamax", 10)
    assert 0 < pool.p50 <= pool.p90


# ─────────────────────────── forecasting ───────────────────────────

def _synthetic(n=1200, seed=0):
    rng = np.random.default_rng(seed)
    t = np.arange(n, dtype=float)
    level = 1500 * np.exp(np.cumsum(rng.normal(0, 0.006, n)) * 0.3
                          + 0.05 * np.sin(2 * np.pi * t / 365.25))
    return level, t


def test_the_model_only_wins_if_it_beats_the_baseline_on_backtest():
    y, t = _synthetic()
    bt = forecast_model.backtest(y, t, 28, folds=10, step=21)
    assert bt.chosen in ("ridge_log_v1", "damped_drift_v1")
    if bt.chosen == "ridge_log_v1":
        assert bt.mase <= bt.baseline_mase


def test_forecast_intervals_bracket_the_point_and_stay_positive():
    y, t = _synthetic()
    f = forecast_model.forecast(y, t, 28)
    assert 0 < f.lo_80 < f.point < f.hi_80
    assert 0 < f.confidence <= 1


def test_longer_horizons_are_not_more_confident_than_short_ones():
    y, t = _synthetic()
    short = forecast_model.forecast(y, t, 7)
    long = forecast_model.forecast(y, t, 180)
    assert (long.hi_80 - long.lo_80) / long.point >= (short.hi_80 - short.lo_80) / short.point


def test_features_never_look_past_the_training_origin():
    y, t = _synthetic()
    end = 800
    X, z = forecast_model._training_set(y, t, 28, end)
    # the last usable origin is `end − h`, so no target can reach beyond `end`
    assert X.shape[0] == len(z)
    y2 = y.copy()
    y2[end + 1:] = 1e9                       # corrupt the future
    X2, z2 = forecast_model._training_set(y2, t, 28, end)
    assert np.allclose(X, X2) and np.allclose(z, z2)


def test_curve_interpolation_is_monotone_between_its_knots():
    curve = {0: 1000.0, 7: 1050.0, 28: 1100.0, 90: 1200.0}
    assert interpolate_curve(curve, 0) == 1000.0
    assert 1050.0 < interpolate_curve(curve, 14) < 1100.0
    assert interpolate_curve(curve, 500) == 1200.0
