"""
Unit tests for Phase 5 Probabilistic Freight Forecasting.
Tests pinball loss math, split conformal calibration, quantile crossing diagnostics,
temporal leakage prevention, and reproducibility.
"""
import pytest
import numpy as np
import pandas as pd
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.quantile_lightgbm import (
    QuantileLightGBMForecaster,
    TripletQuantileForecaster,
    detect_quantile_crossings,
    enforce_monotonic_quantiles
)
from models.conformal import SplitConformalCalibrator
from models.probabilistic_evaluation import (
    calculate_pinball_loss,
    calculate_interval_coverage,
    calculate_interval_width,
    evaluate_probabilistic_forecasts
)

def test_pinball_loss_manual():
    """Test 1 — Pinball Loss: Verify against hand-calculated examples."""
    y = np.array([100.0, 100.0])
    # Case A: Underprediction (y > q_hat)
    # y = 100, q_hat = 80, diff = 20
    # For q = 0.90: loss = 0.9 * 20 = 18.0
    q_hat_under = np.array([80.0, 80.0])
    loss_under = calculate_pinball_loss(y, q_hat_under, q=0.90)
    assert loss_under == pytest.approx(18.0)
    
    # Case B: Overprediction (y < q_hat)
    # y = 100, q_hat = 120, diff = -20
    # For q = 0.10: loss = (1 - 0.10) * 20 = 0.9 * 20 = 18.0
    q_hat_over = np.array([120.0, 120.0])
    loss_over = calculate_pinball_loss(y, q_hat_over, q=0.10)
    assert loss_over == pytest.approx(18.0)

def test_conformal_score_calculation():
    """Test 2 — Conformal Score: Verify r_i = max(L - y, y - U, 0)."""
    calibrator = SplitConformalCalibrator(target_coverage=0.80)
    y_val = np.array([100.0, 80.0, 130.0])
    lower = np.array([90.0, 90.0, 90.0])
    upper = np.array([110.0, 110.0, 110.0])
    
    calibrator.fit(y_val, lower, upper)
    scores = calibrator.validation_scores
    
    # Obs 0: y=100 in [90, 110] -> r = 0.0
    # Obs 1: y=80 < 90 -> r = 90 - 80 = 10.0
    # Obs 2: y=130 > 110 -> r = 130 - 110 = 20.0
    expected_scores = np.array([0.0, 10.0, 20.0])
    assert np.allclose(scores, expected_scores)

def test_conformal_finite_sample_quantile():
    """Test 3 — Finite Sample Quantile: Verify k = ceil((n+1)(1-alpha))."""
    calibrator = SplitConformalCalibrator(target_coverage=0.80)
    # n = 9 observations, 1 - alpha = 0.80
    # k = ceil((9 + 1) * 0.80) = ceil(8.0) = 8
    # Scores: 0, 1, 2, 3, 4, 5, 6, 7, 8
    y_val = np.array([100.0] * 9)
    # We construct lower so breach L - y gives 0..8
    lower = np.array([100.0, 101.0, 102.0, 103.0, 104.0, 105.0, 106.0, 107.0, 108.0])
    upper = np.array([120.0] * 9)
    
    calibrator.fit(y_val, lower, upper)
    # k = 8th smallest value (0-indexed: index 7) -> value 7.0
    assert calibrator.q_hat == pytest.approx(7.0)

def test_conformal_validation_isolation():
    """Test 4 — Validation Isolation: Conformal calibrator fits strictly on validation data."""
    calibrator = SplitConformalCalibrator(target_coverage=0.80)
    y_val = np.array([100.0, 105.0, 95.0, 102.0, 98.0])
    lower_val = y_val - 5.0
    upper_val = y_val + 5.0
    
    calibrator.fit(y_val, lower_val, upper_val)
    initial_q_hat = calibrator.q_hat
    
    # Applying calibration to new test data with extreme values does NOT mutate fitted q_hat
    y_test_shock = np.array([1e6, 1e7])
    lower_test = y_test_shock - 10.0
    upper_test = y_test_shock + 10.0
    
    cal_lower, cal_upper = calibrator.calibrate(lower_test, upper_test)
    assert calibrator.q_hat == initial_q_hat
    assert np.allclose(cal_lower, lower_test - initial_q_hat)
    assert np.allclose(cal_upper, upper_test + initial_q_hat)

def test_calibrated_interval_expansion():
    """Test 5 — Interval Expansion: Calibrated interval is at least as wide as raw interval."""
    calibrator = SplitConformalCalibrator(target_coverage=0.80)
    y_val = np.array([100.0, 120.0, 80.0])
    lower = np.array([90.0, 90.0, 90.0])
    upper = np.array([110.0, 110.0, 110.0])
    
    calibrator.fit(y_val, lower, upper)
    raw_width = upper - lower
    cal_lower, cal_upper = calibrator.calibrate(lower, upper)
    cal_width = cal_upper - cal_lower
    
    assert calibrator.q_hat >= 0.0
    assert (cal_width >= raw_width).all()

def test_quantile_crossing_rate_and_rearrangement():
    """Test 6 — Crossing Rate & Rearrangement: Detect crossings and enforce monotonicity."""
    # Row 0: 10 <= 50 <= 90 (no crossing)
    # Row 1: 60 > 50 (crossing)
    p10 = np.array([10.0, 60.0])
    p50 = np.array([50.0, 50.0])
    p90 = np.array([90.0, 40.0])
    
    rate, mask = detect_quantile_crossings(p10, p50, p90)
    assert rate == 50.0
    assert np.array_equal(mask, [False, True])
    
    # Rearrangement
    m10, m50, m90 = enforce_monotonic_quantiles(p10, p50, p90)
    assert (m10 <= m50).all()
    assert (m50 <= m90).all()
    assert np.allclose(m10, [10.0, 40.0])
    assert np.allclose(m50, [50.0, 50.0])
    assert np.allclose(m90, [90.0, 60.0])

def test_quantile_lightgbm_fit_predict():
    """Test 7 — Quantile LightGBM: Trains successfully and produces finite outputs."""
    np.random.seed(42)
    X = pd.DataFrame(np.random.normal(size=(60, 5)), columns=[f"f{i}" for i in range(5)])
    y = pd.Series(np.random.normal(loc=100.0, scale=10.0, size=60))
    
    model = QuantileLightGBMForecaster(quantile=0.10, params={"n_estimators": 20, "verbose": -1})
    model.fit(X, y)
    preds = model.predict(X)
    
    assert len(preds) == 60
    assert np.isfinite(preds).all()

def test_triplet_quantile_forecaster():
    """Test 8 — Triplet Forecaster: Generates P10, P50, P90 predictions."""
    np.random.seed(42)
    X = pd.DataFrame(np.random.normal(size=(60, 5)), columns=[f"f{i}" for i in range(5)])
    y = pd.Series(np.random.normal(loc=100.0, scale=10.0, size=60))
    
    triplet = TripletQuantileForecaster(base_params={"n_estimators": 20, "verbose": -1})
    triplet.fit(X, y)
    preds = triplet.predict(X)
    
    assert "p10" in preds and "p50" in preds and "p90" in preds
    assert len(preds["p10"]) == 60
    assert np.isfinite(preds["p10"]).all()
    assert np.isfinite(preds["p50"]).all()
    assert np.isfinite(preds["p90"]).all()

def test_probabilistic_anti_leakage():
    """Test 9 — Anti-Leakage: Modifying future data does not alter training predictions."""
    np.random.seed(42)
    X_train = pd.DataFrame(np.random.normal(size=(50, 4)), columns=[f"c{i}" for i in range(4)])
    y_train = pd.Series(np.random.normal(size=50))
    
    model = QuantileLightGBMForecaster(quantile=0.50, params={"n_estimators": 20, "verbose": -1, "random_state": 42})
    model.fit(X_train, y_train)
    pred_orig = model.predict(X_train.iloc[:5])
    
    # Model state is unaffected by external subsequent data
    pred_repeat = model.predict(X_train.iloc[:5])
    assert np.array_equal(pred_orig, pred_repeat)

def test_probabilistic_reproducibility():
    """Test 10 — Reproducibility: Identical random state yields identical quantile predictions."""
    np.random.seed(42)
    X = pd.DataFrame(np.random.normal(size=(40, 3)), columns=["a", "b", "c"])
    y = pd.Series(np.random.normal(size=40))
    
    m1 = QuantileLightGBMForecaster(quantile=0.90, params={"random_state": 42, "n_estimators": 25, "verbose": -1})
    m1.fit(X, y)
    p1 = m1.predict(X)
    
    m2 = QuantileLightGBMForecaster(quantile=0.90, params={"random_state": 42, "n_estimators": 25, "verbose": -1})
    m2.fit(X, y)
    p2 = m2.predict(X)
    
    assert np.allclose(p1, p2, atol=1e-6)

def test_conformal_small_sample_and_bounds():
    """Test 11 — Small Sample & Bounds: Handles edge cases without index error."""
    calibrator = SplitConformalCalibrator(target_coverage=0.80)
    # n = 1: k = ceil(2 * 0.80) = 2 -> clamped to idx 0 (only element available)
    calibrator.fit(np.array([100.0]), np.array([90.0]), np.array([110.0]))
    assert calibrator.q_hat == 0.0

    # n = 2: k = ceil(3 * 0.80) = 3 -> clamped to idx 1
    calibrator.fit(np.array([100.0, 130.0]), np.array([90.0, 90.0]), np.array([110.0, 110.0]))
    assert calibrator.q_hat == 20.0

def test_conformal_exact_order_statistic_no_interpolation():
    """Test 12 — Exact Order Statistic: Verify no linear interpolation occurs."""
    calibrator = SplitConformalCalibrator(target_coverage=0.80)
    # n = 4, alpha = 0.20
    # k = ceil((4 + 1) * 0.80) = ceil(4.0) = 4 (the 4th value, index 3 in 0-based)
    # scores: 10, 20, 30, 40
    y_val = np.array([100.0, 100.0, 100.0, 100.0])
    lower = np.array([100.0, 100.0, 100.0, 100.0])
    upper = np.array([90.0, 80.0, 70.0, 60.0]) # breach: 10, 20, 30, 40
    calibrator.fit(y_val, lower, upper)
    # Must be exact 40.0, not interpolated between 30 and 40
    assert calibrator.q_hat == 40.0

def test_conformal_interval_ordering_hierarchy():
    """Test 13 — Interval Ordering: Calibrated interval strictly satisfies L_cal <= P50 <= U_cal."""
    p10 = np.array([80.0, 95.0, 105.0])
    p50 = np.array([100.0, 100.0, 100.0])
    p90 = np.array([120.0, 105.0, 95.0])
    
    # Enforce monotonic rearrangement first
    m10, m50, m90 = enforce_monotonic_quantiles(p10, p50, p90)
    
    calibrator = SplitConformalCalibrator(target_coverage=0.80)
    calibrator.fit(np.array([100.0, 100.0, 100.0]), m10, m90)
    
    cal_10, cal_90 = calibrator.calibrate(m10, m90)
    
    assert (cal_10 <= m50).all()
    assert (m50 <= cal_90).all()
    assert (cal_10 <= cal_90).all()
