"""Regression tests over the full 24-artifact matrix (items 7, 9, 16, 19).

Every index × horizon must train, load, predict, carry validation and provenance,
and produce a finite ordered interval. Combinations are tested exhaustively rather
than sampled, because the one that silently fails is the one nobody checked.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import predict
from forecast_v2.dataset import INDEX_COLS, feature_columns, load_real, supervised

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "models/saved_models/v2"
REAL = ROOT / "data/processed/real_baltic_multivariate.csv"
CODES = ["BPI", "BCI", "BSI", "BHSI"]
HORIZONS = [7, 14, 28, 60, 90, 180]
MATRIX = [(c, h) for c in CODES for h in HORIZONS]

pytestmark = pytest.mark.skipif(
    not (ART / "manifest.json").exists(),
    reason="production artifacts not built; run forecast_v2/train_final.py")


@pytest.fixture(scope="module")
def real() -> pd.DataFrame:
    return load_real(str(REAL))


def test_the_matrix_is_complete():
    """4 indices × 6 horizons = 24. No gaps, no extras."""
    present = {p.stem for p in ART.glob("*.joblib")}
    expected = {f"{c.lower()}_h{h}" for c, h in MATRIX}
    assert present == expected, (f"missing {sorted(expected - present)}, "
                                 f"unexpected {sorted(present - expected)}")
    assert len(json.loads((ART / "manifest.json").read_text())) == 24


@pytest.mark.parametrize("code,horizon", MATRIX, ids=lambda v: str(v))
def test_artifact_loads_and_is_well_formed(code, horizon):
    art = predict.load(code, horizon, ART)
    p = art["provenance"]
    assert p["index_code"] == code and p["horizon_days"] == horizon
    assert len(art["features"]) == p["feature_count"] > 0
    assert np.isfinite(art["q_hat"])
    assert set(art["quantiles"]) == {"lo", "mid", "hi"}


@pytest.mark.parametrize("code,horizon", MATRIX, ids=lambda v: str(v))
def test_prediction_is_finite_and_interval_is_ordered(code, horizon, real):
    f = predict.forecast(real, code, horizon, root=ART)
    for v in (f.point, f.lo_80, f.hi_80, f.origin_level):
        assert np.isfinite(v) and v > 0
    assert f.lo_80 <= f.point <= f.hi_80, \
        f"{code} h={horizon}: {f.lo_80} <= {f.point} <= {f.hi_80} violated"
    assert 0.0 <= f.forecast_quality_score <= 1.0


@pytest.mark.parametrize("code,horizon", MATRIX, ids=lambda v: str(v))
def test_validation_and_provenance_are_recorded(code, horizon):
    p = predict.load(code, horizon, ART)["provenance"]
    for key in ("model_version", "selected_model", "selection_rule", "trained_at",
                "trained_through", "dataset_sha256", "feature_spec_sha256",
                "n_train_real", "n_calibration", "augmentation_used",
                "data_provenance", "environment", "validation", "interval"):
        assert key in p, f"{code} h={horizon} provenance is missing {key}"
    assert len(p["dataset_sha256"]) == 64
    assert p["environment"]["packages"]["lightgbm"]
    v = p["validation"]
    assert {"mase", "skill_vs_naive_pct", "directional_accuracy"} <= set(v)
    assert v["mase"] > 0


@pytest.mark.parametrize("code,horizon", MATRIX, ids=lambda v: str(v))
def test_interval_records_empirical_coverage_not_just_nominal(code, horizon):
    """An "80% interval" is a claim; the empirical number is the evidence."""
    iv = predict.load(code, horizon, ART)["provenance"]["interval"]
    assert iv["nominal_coverage_pct"] == 80.0
    assert 0 < iv["empirical_coverage_pct"] <= 100
    assert iv["n_origins"] > 100


@pytest.mark.parametrize("code,horizon", MATRIX, ids=lambda v: str(v))
def test_drivers_are_features_not_ensemble_weights(code, horizon, real):
    """Explanations must name real features (item 15)."""
    f = predict.forecast(real, code, horizon, root=ART)
    assert f.drivers, f"{code} h={horizon} produced no drivers"
    known = set(predict.load(code, horizon, ART)["features"])
    for d in f.drivers:
        assert d["feature"] in known
        assert not d["feature"].startswith("ensemble_weight")
        assert d["group"] != "other"
        assert np.isfinite(d["contribution_logret"])


@pytest.mark.parametrize("code,horizon", MATRIX, ids=lambda v: str(v))
def test_attribution_reconstructs_the_prediction(code, horizon, real):
    from forecast_v2 import explain
    from forecast_v2.dataset import FeatureSpec, build_features
    art = predict.load(code, horizon, ART)
    col = predict.CODE_TO_COL[code]
    x = build_features(real, col, FeatureSpec()).iloc[-1][art["features"]].to_numpy(float)
    assert explain.reconstructs(art["point"], x, art["features"], tol=1e-5)


def test_forecasts_are_deterministic(real):
    a = predict.forecast(real, "BPI", 28, root=ART)
    b = predict.forecast(real, "BPI", 28, root=ART)
    assert (a.point, a.lo_80, a.hi_80) == (b.point, b.lo_80, b.hi_80)


def test_production_artifacts_have_augmentation_off(real):
    """Item 8: augmentation stays off unless validation justifies it."""
    for code, horizon in MATRIX:
        p = predict.load(code, horizon, ART)["provenance"]
        assert p["augmentation_used"] is False
        assert p["data_provenance"].startswith("verified_real")


def test_no_synthetic_rows_reached_training(real):
    """Item 8: the training frame must end where the verified record ends."""
    for code, horizon in [("BPI", 7), ("BCI", 180)]:
        p = predict.load(code, horizon, ART)["provenance"]
        assert p["trained_through"] == "2019-07-31"
        assert p["dataset_path"].endswith("real_baltic_multivariate.csv")


# ───────────────────── graceful failure (item 19) ─────────────────────

def test_missing_artifact_raises_clearly(tmp_path):
    with pytest.raises(FileNotFoundError, match="No artifact"):
        predict.load("BPI", 999, tmp_path)


def test_corrupted_artifact_raises_clearly(tmp_path, real):
    bad = tmp_path / "bpi_h7.joblib"
    bad.write_bytes(b"not a joblib file at all")
    with pytest.raises(Exception) as e:
        predict.load("BPI", 7, tmp_path)
    assert not isinstance(e.value, SystemExit)


def test_artifact_missing_a_key_is_rejected(tmp_path):
    joblib.dump({"point": None}, tmp_path / "bpi_h7.joblib")
    with pytest.raises(ValueError, match="missing"):
        predict.load("BPI", 7, tmp_path)


def test_short_history_is_rejected_not_guessed(real):
    with pytest.raises(ValueError, match="at least"):
        predict.forecast(real.head(50), "BPI", 7, root=ART)


def test_unknown_index_is_rejected(real):
    with pytest.raises(ValueError, match="unknown index"):
        predict.forecast(real, "BDI", 7, root=ART)


def test_missing_columns_are_rejected(real):
    with pytest.raises(ValueError, match="missing columns"):
        predict.forecast(real.drop(columns=["bci_value"]), "BPI", 7, root=ART)
