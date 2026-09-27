"""Tests for forecast_v2. The leakage tests are the ones that matter most:
every accuracy number in the report is worthless if a feature can see the future.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import synth
from forecast_v2.conformal import walk_forward_intervals
from forecast_v2.dataset import (
    INDEX_COLS, FeatureSpec, build_features, feature_columns, load_real, supervised,
)
from forecast_v2.walkforward import metrics, scale_denominator, walk_forward
from forecast_v2 import models as M

REAL = Path(__file__).resolve().parent.parent / "data/processed/real_baltic_multivariate.csv"


@pytest.fixture(scope="module")
def real() -> pd.DataFrame:
    return load_real(str(REAL))


def test_features_do_not_see_the_future(real):
    """Truncating history after origin t must not change the features at t."""
    spec = FeatureSpec()
    cut = 900
    full = build_features(real, "bpi_value", spec)
    truncated = build_features(real.iloc[: cut + 1].reset_index(drop=True), "bpi_value", spec)
    cols = [c for c in full.columns if c != "obs_date"]
    a = full.iloc[cut][cols].to_numpy(dtype=float)
    b = truncated.iloc[-1][cols].to_numpy(dtype=float)
    np.testing.assert_allclose(a, b, rtol=1e-9, atol=1e-9)


def test_target_alignment(real):
    h = 28
    data = supervised(real, "bpi_value", h)
    lookup = dict(zip(real["obs_date"], real["bpi_value"]))
    row = data.iloc[100]
    assert lookup[pd.Timestamp(row["target_date"])] == pytest.approx(row["target_level"])
    assert row["target_logret"] == pytest.approx(
        np.log(row["target_level"]) - np.log(row["origin_level"]))


def test_origin_precedes_target(real):
    data = supervised(real, "bsi_value", 60)
    assert (pd.to_datetime(data["target_date"]) > pd.to_datetime(data["obs_date"])).all()


def test_no_raw_level_feature(real):
    """A non-stationary level column would let a linear model mean-revert forecasts."""
    data = supervised(real, "bpi_value", 7)
    assert "log_level" not in feature_columns(data)


def test_naive_flat_matches_persistence(real):
    data = supervised(real, "bhsi_value", 14)
    fcols = feature_columns(data)
    p = walk_forward(data, fcols, lambda: M.NaiveFlat(), min_train=500, step=60)
    np.testing.assert_allclose(p["pred_level"].to_numpy(), p["origin_level"].to_numpy())


def test_mase_denominator_is_positive(real):
    data = supervised(real, "bpi_value", 7)
    assert scale_denominator(data, 500) > 0


def test_walk_forward_only_predicts_after_min_train(real):
    data = supervised(real, "bpi_value", 7)
    fcols = feature_columns(data)
    p = walk_forward(data, fcols, lambda: M.NaiveFlat(), min_train=500, step=100)
    assert pd.Timestamp(p["origin_date"].min()) >= pd.Timestamp(data["obs_date"].iloc[500])
    assert len(p) == len(data) - 500


def test_conformal_intervals_reach_nominal_coverage(real):
    data = supervised(real, "bsi_value", 7)
    res = walk_forward_intervals(data, feature_columns(data), min_train=600, step=60)
    assert 70.0 <= res.coverage <= 92.0, f"coverage {res.coverage} far from nominal 80"
    assert res.frame["lvl_p90_cal"].ge(res.frame["lvl_p10_cal"]).all()


def test_quantiles_never_cross_after_sorting(real):
    data = supervised(real, "bpi_value", 28)
    res = walk_forward_intervals(data, feature_columns(data), min_train=700, step=90)
    f = res.frame
    assert (f["p10_raw"] <= f["p50"]).all() and (f["p50"] <= f["p90_raw"]).all()


def test_synthetic_generator_is_stationary_and_faithful(real):
    cfg = synth.SynthConfig(n_paths=4, path_len=600)
    model = synth.fit(real, cfg, fit_until_index=500)
    assert synth._spectral_radius(model.coefs) < 1.0
    paths = synth.simulate(model, cfg)
    assert len(paths) == 4
    for p in paths:
        assert p[INDEX_COLS].gt(0).all().all()
        assert np.isfinite(p[INDEX_COLS].to_numpy()).all()

    rep = synth.fidelity_report(real.iloc[:500], paths)
    # The properties the learner actually consumes: volatility and momentum.
    assert rep["ann_vol"]["rel_error_pct"].abs().max() < 35
    assert rep["ac1_return"]["rel_error_pct"].abs().max() < 20


def test_generator_cannot_see_beyond_its_fit_window(real):
    """Fitting on a prefix must be unaffected by later data."""
    cfg = synth.SynthConfig()
    a = synth.fit(real, cfg, fit_until_index=500)
    b = synth.fit(real.iloc[:500].reset_index(drop=True), cfg)
    np.testing.assert_allclose(a.coefs, b.coefs, rtol=1e-10, atol=1e-12)


def test_served_band_contains_served_point(real):
    """A forecast card that shows a point outside its own interval is a bug."""
    from forecast_v2 import predict
    root = Path(__file__).resolve().parent.parent / "models/saved_models/v2"
    if not (root / "bpi_h7.joblib").exists():
        pytest.skip("production artifacts not built")
    for code in ("BPI", "BCI", "BSI", "BHSI"):
        for h in (7, 28, 90):
            f = predict.forecast(real, code, h, root=root)
            assert f.lo_80 <= f.point <= f.hi_80, f"{code} h={h}: {f.lo_80} {f.point} {f.hi_80}"
            assert f.lo_80 > 0


# ───────────────────────── post-COVID panel ─────────────────────────

def test_postcovid_follows_its_regime_calendar(real):
    """The panel must actually trace the collapse → boom → trough shape it claims."""
    from forecast_v2 import postcovid
    cfg = postcovid.PostCovidConfig(n_scenarios=3)
    panels = postcovid.generate(real, "2026-09-15", cfg)
    checks = postcovid.validate(panels, real)
    assert checks["anchor_tracking_corr"].min() > 0.95

    for p in panels:
        med = p.groupby("regime", sort=False)["bci_value"].median()
        # The three facts that define this period, in order.
        assert med["covid_collapse"] < med["pre_covid_softening"]
        assert med["boom_peak"] > med["pre_covid_softening"] * 1.5
        assert med["trough_2023"] < med["boom_peak"] * 0.5


def test_postcovid_peak_lands_in_2021(real):
    from forecast_v2 import postcovid
    panels = postcovid.generate(real, "2026-09-15",
                                postcovid.PostCovidConfig(n_scenarios=3))
    for p in panels:
        peak = p.loc[p["bci_value"].idxmax(), "obs_date"]
        assert pd.Timestamp("2021-06-01") <= peak <= pd.Timestamp("2022-01-31"), \
            f"Capesize peak at {peak.date()}, outside the 2021 boom"


def test_postcovid_keeps_real_dynamics(real):
    """Steering the level path must not destroy the momentum structure."""
    from forecast_v2 import postcovid
    panels = postcovid.generate(real, "2026-09-15",
                                postcovid.PostCovidConfig(n_scenarios=3))
    rep = synth.fidelity_report(real, panels)
    assert rep["ac1_return"]["rel_error_pct"].abs().max() < 15
    assert rep["ac1_abs_return"]["rel_error_pct"].abs().max() < 20


def test_postcovid_rows_are_labelled_and_barred_from_scoring(real):
    from forecast_v2 import postcovid
    p = postcovid.generate(real, "2021-01-01", postcovid.PostCovidConfig(n_scenarios=1))[0]
    assert (p["provenance_tag"] == "synthetic_postcovid").all()
    assert p["obs_date"].min() > real["obs_date"].max()
    combined = Path(__file__).resolve().parent.parent / \
        "data/processed/baltic_real_plus_postcovid.csv"
    if combined.exists():
        c = pd.read_csv(combined)
        tags = set(c["provenance_tag"].unique())
        assert tags == {"verified_real_mendeley_cc_by_4.0", "synthetic_postcovid"}
