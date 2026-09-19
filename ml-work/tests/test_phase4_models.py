"""
Unit tests for Phase 4 forecasting benchmarks, baselines, and models.
Verifies target alignment, mathematical correctness, anti-leakage scaling, and reproducibility.
"""
import pytest
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.config import ModelConfig
from models.baselines import (
    NaivePersistence,
    SeasonalNaive,
    MovingAverage,
    DampedDrift
)
from models.ridge_model import RidgeForecaster
from models.lightgbm_model import LightGBMForecaster
from models.evaluation import (
    calculate_mae,
    calculate_rmse,
    calculate_mase,
    calculate_directional_accuracy,
    calculate_naive_scale
)

RAW_DATA_PATH = "ml-work/data/processed/real_baltic_multivariate.csv"
FEATURE_DATA_PATH = "ml-work/data/features/dataset_bpi_h7.csv"

@pytest.fixture
def raw_df():
    return pd.read_csv(RAW_DATA_PATH)

@pytest.fixture
def feature_df_h7():
    return pd.read_csv(FEATURE_DATA_PATH)

def test_naive_persistence():
    """Test 1 — Naive: Verify prediction == origin_value across horizons."""
    model = NaivePersistence()
    origins = np.array([1200.0, 1450.5, 980.2])
    for h in [7, 14, 28, 60, 90, 180]:
        preds = model.predict(origins, horizon=h)
        assert np.array_equal(preds, origins), f"Persistence changed at horizon {h}"

def test_moving_average():
    """Test 2 — Moving average: Verify exact rolling calculation."""
    series = np.array([10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0])
    # W=7 at origin index 6 (items 0..6: 10..70, mean = 40.0)
    ma7 = MovingAverage(window=7)
    pred_idx6 = ma7.predict_single(series, origin_idx=6)
    assert pred_idx6 == pytest.approx(40.0)
    
    # W=7 at origin index 7 (items 1..7: 20..80, mean = 50.0)
    pred_idx7 = ma7.predict_single(series, origin_idx=7)
    assert pred_idx7 == pytest.approx(50.0)

def test_damped_drift():
    """Test 3 — Damped drift: Verify exact mathematical formula."""
    # Constant increase of 2.0 per step over lookback 30
    L = 30
    phi = 0.95
    series = np.arange(100, dtype=float) * 2.0  # y[t] = 2t, drift = (2t - 2(t-30))/30 = 2.0
    drift_model = DampedDrift(lookback=L, damping_factor=phi)
    
    origin_idx = 50
    h = 7
    # Expected: y[50] + drift * phi * (1 - phi^h) / (1 - phi)
    y_50 = 100.0
    drift_val = 2.0
    cum_damping = phi * (1.0 - (phi ** h)) / (1.0 - phi)
    expected = y_50 + drift_val * cum_damping
    
    actual = drift_model.predict_single(series, origin_idx, horizon=h)
    assert actual == pytest.approx(expected, rel=1e-5)

def test_target_alignment(raw_df, feature_df_h7):
    """Test 4 — Target alignment: Verify target_date == origin_date shifted h trading sessions."""
    raw_dates = raw_df["obs_date"].tolist()
    date_to_idx = {d: i for i, d in enumerate(raw_dates)}
    
    sample = feature_df_h7.sample(n=20, random_state=42)
    h = 7
    for _, row in sample.iterrows():
        o_date = row["origin_date"]
        t_date = row["target_date"]
        o_idx = date_to_idx[o_date]
        t_idx = date_to_idx[t_date]
        assert t_idx - o_idx == h, f"Target alignment error: {t_idx} - {o_idx} != {h}"
        assert t_date > o_date, f"target_date {t_date} <= origin_date {o_date}"

def test_chronological_order_no_shuffle(feature_df_h7):
    """Test 5 — No shuffle: Verify strict chronological order."""
    dates = pd.to_datetime(feature_df_h7["origin_date"])
    assert dates.is_monotonic_increasing, "Feature dataset origin dates are not monotonically increasing"

def test_train_test_separation(feature_df_h7):
    """Test 6 — Train/test separation: Verify max(train_origin) < min(test_origin)."""
    train_dates = feature_df_h7[feature_df_h7["split_set"] == "train"]["origin_date"]
    val_dates = feature_df_h7[feature_df_h7["split_set"] == "val"]["origin_date"]
    test_dates = feature_df_h7[feature_df_h7["split_set"] == "test"]["origin_date"]
    
    assert train_dates.max() < val_dates.min(), "Train overlaps with Validation"
    assert val_dates.max() < test_dates.min(), "Validation overlaps with Test"

def test_scaler_leakage():
    """Test 7 — Scaler leakage: Extreme future shocks do NOT affect training scaler."""
    np.random.seed(42)
    X_train = np.random.normal(loc=100.0, scale=10.0, size=(100, 5))
    X_test_normal = np.random.normal(loc=100.0, scale=10.0, size=(20, 5))
    X_test_shocked = X_test_normal.copy()
    X_test_shocked += 1e8  # Massive shock in future/test data
    
    scaler = StandardScaler()
    scaler.fit(X_train)
    
    # Pre-shock mean and scale
    mean_initial = scaler.mean_.copy()
    scale_initial = scaler.scale_.copy()
    
    # Transforming test does not mutate fitted train statistics
    _ = scaler.transform(X_test_shocked)
    
    assert np.array_equal(scaler.mean_, mean_initial), "Scaler mean was mutated by test transformation"
    assert np.array_equal(scaler.scale_, scale_initial), "Scaler scale was mutated by test transformation"

def test_model_output_shape(feature_df_h7):
    """Test 8 — Model output shape: Every prediction maps 1-to-1 to origin and target dates."""
    meta_cols = [
        "origin_date", "target_index", "horizon_sessions",
        "target_date", "calendar_days_elapsed", "target_value",
        "target_log_return", "split_set"
    ]
    feat_cols = [c for c in feature_df_h7.columns if c not in meta_cols]
    
    train_df = feature_df_h7[feature_df_h7["split_set"] == "train"]
    val_df = feature_df_h7[feature_df_h7["split_set"] == "val"]
    
    model = RidgeForecaster(alpha=1.0)
    model.fit(train_df[feat_cols], train_df["target_value"])
    preds = model.predict(val_df[feat_cols])
    
    assert len(preds) == len(val_df), f"Shape mismatch: {len(preds)} != {len(val_df)}"
    assert not np.isnan(preds).any(), "Found NaNs in predictions"

def test_no_nan_predictions(feature_df_h7):
    """Test 9 — No NaN predictions: Model predictions on valid rows are finite."""
    meta_cols = [
        "origin_date", "target_index", "horizon_sessions",
        "target_date", "calendar_days_elapsed", "target_value",
        "target_log_return", "split_set"
    ]
    feat_cols = [c for c in feature_df_h7.columns if c not in meta_cols]
    
    train_df = feature_df_h7[feature_df_h7["split_set"] == "train"]
    val_df = feature_df_h7[feature_df_h7["split_set"] == "val"]
    
    lgb_model = LightGBMForecaster(params={"n_estimators": 20, "verbose": -1})
    lgb_model.fit(train_df[feat_cols], train_df["target_value"])
    preds = lgb_model.predict(val_df[feat_cols])
    
    assert np.isfinite(preds).all(), "Predictions contain NaN or Inf values"

def test_reproducibility(feature_df_h7):
    """Test 10 — Reproducibility: Running deterministic model twice gives identical results."""
    meta_cols = [
        "origin_date", "target_index", "horizon_sessions",
        "target_date", "calendar_days_elapsed", "target_value",
        "target_log_return", "split_set"
    ]
    feat_cols = [c for c in feature_df_h7.columns if c not in meta_cols]
    
    train_df = feature_df_h7[feature_df_h7["split_set"] == "train"]
    val_df = feature_df_h7[feature_df_h7["split_set"] == "val"]
    
    model1 = LightGBMForecaster(params={"random_state": 42, "n_estimators": 30, "verbose": -1})
    model1.fit(train_df[feat_cols], train_df["target_value"])
    preds1 = model1.predict(val_df[feat_cols])
    
    model2 = LightGBMForecaster(params={"random_state": 42, "n_estimators": 30, "verbose": -1})
    model2.fit(train_df[feat_cols], train_df["target_value"])
    preds2 = model2.predict(val_df[feat_cols])
    
    assert np.allclose(preds1, preds2, atol=1e-6), "Non-deterministic predictions across identical runs"

def test_baseline_consistency(feature_df_h7):
    """Test 11 — Baseline consistency: Persistence predictions are identical regardless of horizon."""
    origins = feature_df_h7["current_known_level"].values[:10]
    p_model = NaivePersistence()
    
    pred_h7 = p_model.predict(origins, horizon=7)
    pred_h14 = p_model.predict(origins, horizon=14)
    pred_h180 = p_model.predict(origins, horizon=180)
    
    assert np.array_equal(pred_h7, pred_h14)
    assert np.array_equal(pred_h14, pred_h180)

def test_directional_neutral_decomposition():
    """Test 12 — Directional Neutral Decomposition: Verify persistence neutral rate and non-neutral metric."""
    from models.evaluation import calculate_directional_metrics
    
    y_origin = np.array([1000.0, 1000.0, 1000.0, 1000.0])
    y_true = np.array([1050.0, 950.0, 1020.0, 980.0])  # All non-zero movements
    
    # 1. Persistence prediction (y_pred == y_origin)
    y_pred_pers = np.array([1000.0, 1000.0, 1000.0, 1000.0])
    p_metrics = calculate_directional_metrics(y_origin, y_true, y_pred_pers)
    
    assert p_metrics["predicted_neutral_rate"] == 100.0, "Persistence should have 100% neutral prediction rate"
    assert p_metrics["directional_accuracy_all"] == 0.0, "Raw persistence accuracy against moves should be 0%"
    assert np.isnan(p_metrics["directional_accuracy_non_neutral"]), "Non-neutral accuracy for persistence should be NaN"
    
    # 2. Directional model that correctly predicts 3 out of 4 moves
    y_pred_dir = np.array([1020.0, 960.0, 1010.0, 1010.0]) # 4th is wrong direction
    d_metrics = calculate_directional_metrics(y_origin, y_true, y_pred_dir)
    assert d_metrics["predicted_neutral_rate"] == 0.0
    assert d_metrics["directional_accuracy_all"] == 75.0
    assert d_metrics["directional_accuracy_non_neutral"] == 75.0

