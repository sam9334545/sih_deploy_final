import math
import pytest
import pandas as pd
import numpy as np
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from features.config import FeatureConfig
from features.builder import build_features_for_row, build_feature_matrix
from features.targets import create_supervised_forecasting_dataset
from features.validation import verify_anti_leakage, get_time_aware_splits, walk_forward_folds

@pytest.fixture
def sample_real_df():
    config = FeatureConfig()
    real_csv = config.input_processed_path
    assert real_csv.exists(), f"Processed real dataset missing at {real_csv}"
    return pd.read_csv(real_csv)

def test_lag_correctness(sample_real_df):
    """Verify that lag_1, lag_2, lag_7 match exact historical values."""
    config = FeatureConfig()
    idx = 100
    row_feats = build_features_for_row(sample_real_df, idx, "bpi_value", config)
    
    # Assert current known level matches df.iloc[idx]
    assert row_feats["current_known_level"] == sample_real_df.iloc[idx]["bpi_value"]
    # Assert lag_1 matches df.iloc[idx - 1]
    assert row_feats["lag_1"] == sample_real_df.iloc[idx - 1]["bpi_value"]
    # Assert lag_7 matches df.iloc[idx - 7]
    assert row_feats["lag_7"] == sample_real_df.iloc[idx - 7]["bpi_value"]
    # Assert lag_60 matches df.iloc[idx - 60]
    assert row_feats["lag_60"] == sample_real_df.iloc[idx - 60]["bpi_value"]

def test_rolling_window_correctness(sample_real_df):
    """Verify that rolling_mean_7 and rolling_std_7 use strictly the last 7 sessions."""
    config = FeatureConfig()
    idx = 120
    row_feats = build_features_for_row(sample_real_df, idx, "bpi_value", config)
    
    window_vals = sample_real_df.iloc[idx - 6 : idx + 1]["bpi_value"].values
    expected_mean = round(float(window_vals.mean()), 2)
    expected_std = round(float(window_vals.std()), 2)
    
    assert row_feats["rolling_mean_7"] == expected_mean
    assert row_feats["rolling_std_7"] == expected_std

def test_return_calculation(sample_real_df):
    """Verify log_return_1 and log_return_7 mathematical definitions."""
    config = FeatureConfig()
    idx = 150
    row_feats = build_features_for_row(sample_real_df, idx, "bpi_value", config)
    
    curr = sample_real_df.iloc[idx]["bpi_value"]
    prev1 = sample_real_df.iloc[idx - 1]["bpi_value"]
    prev7 = sample_real_df.iloc[idx - 7]["bpi_value"]
    
    expected_ret1 = round(math.log(curr) - math.log(prev1), 5)
    expected_ret7 = round(math.log(curr) - math.log(prev7), 5)
    
    assert row_feats["log_return_1"] == expected_ret1
    assert row_feats["log_return_7"] == expected_ret7

def test_cross_index_lag_correctness(sample_real_df):
    """Verify that cross-index features strictly reference past sibling values."""
    config = FeatureConfig()
    idx = 200
    row_feats = build_features_for_row(sample_real_df, idx, "bpi_value", config)
    
    # Check BCI cross features
    assert row_feats["bci_lag_0"] == sample_real_df.iloc[idx]["bci_value"]
    assert row_feats["bci_lag_1"] == sample_real_df.iloc[idx - 1]["bci_value"]
    assert row_feats["bci_lag_7"] == sample_real_df.iloc[idx - 7]["bci_value"]

def test_fourier_feature_correctness(sample_real_df):
    """Verify Fourier sine and cosine seasonal features are bounded in [-1, 1]."""
    config = FeatureConfig()
    row_feats = build_features_for_row(sample_real_df, 100, "bpi_value", config)
    
    for k in (1, 2):
        assert -1.0 <= row_feats[f"fourier_sin_{k}"] <= 1.0
        assert -1.0 <= row_feats[f"fourier_cos_{k}"] <= 1.0
        # sin^2 + cos^2 = 1.0
        ss = row_feats[f"fourier_sin_{k}"] ** 2 + row_feats[f"fourier_cos_{k}"] ** 2
        assert math.isclose(ss, 1.0, abs_tol=1e-4)

def test_target_alignment_7d(sample_real_df):
    """Verify 7-session target alignment."""
    config = FeatureConfig()
    ds = create_supervised_forecasting_dataset(sample_real_df, "bpi_value", horizon=7, config=config)
    
    warmup = max(max(config.lags), max(config.rolling_windows))
    # Row 0 in ds corresponds to origin at index warmup
    origin_date = ds.iloc[0]["origin_date"]
    target_date = ds.iloc[0]["target_date"]
    
    assert origin_date == sample_real_df.iloc[warmup]["obs_date"]
    assert target_date == sample_real_df.iloc[warmup + 7]["obs_date"]
    assert ds.iloc[0]["target_value"] == sample_real_df.iloc[warmup + 7]["bpi_value"]

def test_target_alignment_14d_and_180d(sample_real_df):
    """Verify 14-session and 180-session target alignment."""
    config = FeatureConfig()
    warmup = max(max(config.lags), max(config.rolling_windows))
    
    ds_14 = create_supervised_forecasting_dataset(sample_real_df, "bpi_value", horizon=14, config=config)
    assert ds_14.iloc[0]["target_value"] == sample_real_df.iloc[warmup + 14]["bpi_value"]
    
    ds_180 = create_supervised_forecasting_dataset(sample_real_df, "bpi_value", horizon=180, config=config)
    assert ds_180.iloc[0]["target_value"] == sample_real_df.iloc[warmup + 180]["bpi_value"]
    assert ds_180.iloc[-1]["target_date"] == sample_real_df.iloc[-1]["obs_date"]

def test_no_future_leakage_perturbation(sample_real_df):
    """Automated anti-leakage perturbation test."""
    res = verify_anti_leakage(sample_real_df, "bpi_value", horizon=7, test_origin_idx=600)
    assert res["status"] == "PASSED"
    assert res["future_perturbation_impact"] == "ZERO (100% Leakage Safe)"

def test_missing_future_target_handling(sample_real_df):
    """Verify that unobserved future rows at end of series are cleanly dropped."""
    config = FeatureConfig()
    warmup = max(max(config.lags), max(config.rolling_windows)) # 90
    total_len = len(sample_real_df) # 1749
    
    for h in [7, 14, 28, 60, 90, 180]:
        ds = create_supervised_forecasting_dataset(sample_real_df, "bpi_value", horizon=h, config=config)
        expected_rows = total_len - warmup - h
        assert len(ds) == expected_rows, f"Horizon {h}: expected {expected_rows} rows, got {len(ds)}"

def test_chronological_ordering_and_separation(sample_real_df):
    """Verify monotonic ordering and zero train/val/test overlap."""
    config = FeatureConfig()
    ds = create_supervised_forecasting_dataset(sample_real_df, "bpi_value", horizon=28, config=config)
    
    # Dates monotonically increasing
    assert pd.to_datetime(ds["origin_date"]).is_monotonic_increasing
    assert pd.to_datetime(ds["target_date"]).is_monotonic_increasing
    
    train, val, test = get_time_aware_splits(ds)
    assert len(train) > 0
    assert len(val) > 0
    assert len(test) > 0
    assert train["origin_date"].max() < val["origin_date"].min()
    assert val["origin_date"].max() < test["origin_date"].min()

def test_walk_forward_evaluation_folds(sample_real_df):
    """Verify walk-forward evaluation folding generator."""
    config = FeatureConfig()
    ds = create_supervised_forecasting_dataset(sample_real_df, "bpi_value", horizon=7, config=config)
    
    folds = list(walk_forward_folds(ds, initial_train_size=1000, step_size=100, val_window_size=50))
    assert len(folds) >= 5
    
    for train_fold, val_fold in folds:
        assert len(val_fold) == 50
        assert train_fold["origin_date"].max() < val_fold["origin_date"].min()
        assert len(train_fold) >= 1000
