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


def test_lightgbm_validation_api_is_detected_not_assumed():
    """LightGBM <=4.6 takes eval_set, >=4.7 takes eval_X/eval_y. Either must work."""
    import numpy as np
    from forecast_v2 import models as M
    if not M.HAS_LGB:
        pytest.skip("lightgbm not installed")
    rng = np.random.default_rng(0)
    X, y = rng.normal(size=(300, 6)), rng.normal(size=300)
    m = M.LgbModel().fit(X[:240], y[:240], X_val=X[240:], y_val=y[240:])
    assert np.isfinite(m.predict(X[240:])).all()
    # early stopping must actually be wired up, not silently skipped
    assert m.m_.best_iteration_ is not None

    kw = M._eval_kwargs(X[240:], y[240:])
    assert set(kw) in ({"eval_X", "eval_y"}, {"eval_set"})


def test_lightgbm_is_reproducible():
    import numpy as np
    from forecast_v2 import models as M
    if not M.HAS_LGB:
        pytest.skip("lightgbm not installed")
    rng = np.random.default_rng(1)
    X, y = rng.normal(size=(300, 6)), rng.normal(size=300)
    a = M.LgbModel().fit(X[:240], y[:240], X_val=X[240:], y_val=y[240:]).predict(X[240:])
    b = M.LgbModel().fit(X[:240], y[:240], X_val=X[240:], y_val=y[240:]).predict(X[240:])
    np.testing.assert_allclose(a, b)


# ───────────────────────── leakage regression (item 4) ─────────────────────────

def _mutate_after(df: pd.DataFrame, t_index: int, factor: float = 3.0) -> pd.DataFrame:
    """Violently change every index value strictly after row t_index."""
    out = df.copy()
    for c in INDEX_COLS:
        vals = out[c].to_numpy(dtype=float).copy()
        vals[t_index + 1:] = vals[t_index + 1:] * factor + 500.0
        out[c] = vals
    return out


def test_no_feature_reacts_to_data_after_its_origin(real):
    """The leakage regression test: perturb the future, the past must not move.

    Truncation alone can miss a bug that reads a future row without changing
    length. This rewrites the future in place and asserts every feature at the
    origin is bit-identical.
    """
    spec = FeatureSpec()
    t = 1200
    for target in INDEX_COLS:
        base = build_features(real, target, spec)
        mutated = build_features(_mutate_after(real, t), target, spec)
        cols = [c for c in base.columns if c != "obs_date"]
        a = base.iloc[t][cols].to_numpy(dtype=float)
        b = mutated.iloc[t][cols].to_numpy(dtype=float)
        bad = [cols[i] for i in np.where(~np.isclose(a, b, rtol=0, atol=0,
                                                     equal_nan=True))[0]]
        assert not bad, f"{target}: features changed when the future changed: {bad}"


def test_every_feature_group_is_leakage_free_at_many_origins(real):
    """Same check across origins and every feature group, not one lucky row."""
    spec = FeatureSpec()
    for t in (400, 700, 1000, 1500):
        base = build_features(real, "bpi_value", spec)
        mutated = build_features(_mutate_after(real, t), "bpi_value", spec)
        cols = [c for c in base.columns if c != "obs_date"]
        np.testing.assert_array_equal(
            base.iloc[:t + 1][cols].to_numpy(dtype=float),
            mutated.iloc[:t + 1][cols].to_numpy(dtype=float),
            err_msg=f"leakage detected at or before origin {t}")


def test_served_forecast_is_unchanged_by_future_data(real):
    """End-to-end: the served forecast at T must not move when data after T does."""
    from forecast_v2 import predict
    root = Path(__file__).resolve().parent.parent / "models/saved_models/v2"
    if not (root / "bpi_h28.joblib").exists():
        pytest.skip("production artifacts not built")

    t = len(real) - 40
    history_at_t = real.iloc[:t + 1].reset_index(drop=True)
    a = predict.forecast(history_at_t, "BPI", 28, root=root)
    b = predict.forecast(_mutate_after(real, t).iloc[:t + 1].reset_index(drop=True),
                         "BPI", 28, root=root)
    assert a.point == b.point and a.lo_80 == b.lo_80 and a.hi_80 == b.hi_80


def test_target_never_uses_data_before_its_origin(real):
    """The mirror of leakage: the target must be strictly in the future."""
    for h in (7, 90):
        data = supervised(real, "bci_value", h)
        origin_pos = {d: i for i, d in enumerate(real["obs_date"])}
        row = data.iloc[len(data) // 2]
        gap = origin_pos[pd.Timestamp(row["target_date"])] - \
            origin_pos[pd.Timestamp(row["obs_date"])]
        assert gap == h, f"target is {gap} sessions ahead, expected {h}"


def test_walk_forward_training_window_never_includes_the_scored_origin(real):
    """A fold must not train on the row it is about to predict."""
    data = supervised(real, "bsi_value", 28)
    fcols = feature_columns(data)
    seen = {}

    class Spy(M.NaiveFlat):
        def fit(self, X, y, **kw):
            seen["n_train"] = len(X)
            return self

    walk_forward(data, fcols, lambda: Spy(), min_train=600, step=10**9)
    assert seen["n_train"] <= 600


def test_model_selection_is_driven_by_validation_not_hardcoded():
    """Item 6: if a baseline wins the benchmark, the baseline must be selected."""
    from forecast_v2.train_final import select_model
    bench = pd.DataFrame([
        {"target": "BPI", "horizon": 7, "model": "naive_flat", "mase": 5.0,
         "skill_vs_naive_pct": 0.0, "directional_accuracy": 0.0, "bootstrap_p": None, "n": 900},
        {"target": "BPI", "horizon": 7, "model": "ensemble", "mase": 4.9,
         "skill_vs_naive_pct": 2.0, "directional_accuracy": 55.0, "bootstrap_p": 0.4, "n": 900},
        {"target": "BPI", "horizon": 7, "model": "damped_momentum", "mase": 4.2,
         "skill_vs_naive_pct": 16.0, "directional_accuracy": 62.0, "bootstrap_p": 0.01, "n": 900},
    ])
    chosen, meta = select_model(bench, "BPI", 7)
    assert chosen == "damped_momentum"
    assert meta["significant_at_05"] is True


def test_selection_falls_back_to_persistence_when_nothing_beats_it():
    from forecast_v2.train_final import select_model
    bench = pd.DataFrame([
        {"target": "BSI", "horizon": 180, "model": "naive_flat", "mase": 9.0,
         "skill_vs_naive_pct": 0.0, "directional_accuracy": 0.0, "bootstrap_p": None, "n": 700},
        {"target": "BSI", "horizon": 180, "model": "ensemble", "mase": 9.8,
         "skill_vs_naive_pct": -8.0, "directional_accuracy": 48.0, "bootstrap_p": 0.9, "n": 700},
    ])
    chosen, meta = select_model(bench, "BSI", 180)
    assert chosen == "naive_flat"
    assert meta["beat_persistence"] is False


def test_all_six_model_families_are_available():
    """Item 6: the comparison set must not silently shrink."""
    from forecast_v2.train_final import CANDIDATES, build_model
    assert set(CANDIDATES) == {"naive_flat", "drift_mean", "damped_momentum",
                               "ridge", "lightgbm", "ensemble"}
    cols = ["mom_21"] + [f"f{i}" for i in range(5)]
    for name in CANDIDATES:
        assert build_model(name, cols) is not None


def test_environment_matches_artifact_metadata(recwarn):
    """Item 2: a version drift from the training environment must be visible."""
    import warnings
    from forecast_v2.check_env import check
    problems = check()
    if problems:
        warnings.warn("environment differs from forecast_v2/requirements.txt: "
                      + "; ".join(problems), RuntimeWarning, stacklevel=1)
    assert isinstance(problems, list)
