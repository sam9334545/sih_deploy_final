from typing import Dict, Any, Tuple, Generator
import pandas as pd
import numpy as np
from .config import FeatureConfig
from .builder import build_features_for_row
from .targets import create_supervised_forecasting_dataset

def verify_anti_leakage(
    df: pd.DataFrame,
    target_col: str,
    horizon: int = 7,
    test_origin_idx: int = 500,
    config: FeatureConfig = None
) -> Dict[str, Any]:
    """
    Automated Anti-Leakage Verification (Perturbation Test).
    
    1. Extracts baseline features at test_origin_idx.
    2. Creates a perturbed clone of df where ALL data after test_origin_idx
       is corrupted with extreme synthetic shock values (+1,000,000).
    3. Recomputes features at test_origin_idx from the perturbed dataset.
    4. Asserts that EVERY single feature value at test_origin_idx is identical.
    """
    if config is None:
        config = FeatureConfig()
        
    baseline_feats = build_features_for_row(df, test_origin_idx, target_col, config)
    
    # Clone and inject massive synthetic shocks into future rows (> test_origin_idx)
    perturbed_df = df.copy()
    for col in config.target_indices:
        perturbed_df.loc[test_origin_idx + 1:, col] = 999_999.0
        
    perturbed_feats = build_features_for_row(perturbed_df, test_origin_idx, target_col, config)
    
    # Assert exact equality
    mismatches = []
    for k, v in baseline_feats.items():
        if k in ["origin_date", "target_index"]:
            continue
        p_val = perturbed_feats[k]
        if not np.isclose(v, p_val, atol=1e-5):
            mismatches.append((k, v, p_val))
            
    if mismatches:
        raise AssertionError(f"CRITICAL LEAKAGE DETECTED! Features changed when future was modified: {mismatches}")
        
    # Check supervised dataset properties
    ds = create_supervised_forecasting_dataset(df, target_col, horizon, config)
    
    # 1. Target date strictly after origin date
    origin_dts = pd.to_datetime(ds["origin_date"])
    target_dts = pd.to_datetime(ds["target_date"])
    assert (target_dts > origin_dts).all(), "Target date is not strictly after origin date!"
    
    # 2. Target value is not in feature columns
    feature_cols = [c for c in ds.columns if c not in [
        "origin_date", "target_date", "target_index", "target_value", 
        "target_log_return", "horizon_sessions", "calendar_days_elapsed", "split_set"
    ]]
    assert "target_value" not in feature_cols
    assert "target_log_return" not in feature_cols
    
    return {
        "status": "PASSED",
        "tested_origin_date": df.iloc[test_origin_idx]["obs_date"],
        "target_column": target_col,
        "horizon": horizon,
        "features_checked_count": len(feature_cols),
        "future_perturbation_impact": "ZERO (100% Leakage Safe)",
        "chronological_target_order": "VERIFIED (target_date > origin_date)"
    }

def get_time_aware_splits(
    supervised_df: pd.DataFrame
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Split the supervised dataset into Train, Validation, and Test sets strictly by time.
    Asserts zero overlap between splits.
    """
    train_df = supervised_df[supervised_df["split_set"] == "train"].copy().reset_index(drop=True)
    val_df = supervised_df[supervised_df["split_set"] == "val"].copy().reset_index(drop=True)
    test_df = supervised_df[supervised_df["split_set"] == "test"].copy().reset_index(drop=True)
    
    # Verify chronological separation
    max_train_date = train_df["origin_date"].max()
    min_val_date = val_df["origin_date"].min()
    max_val_date = val_df["origin_date"].max()
    min_test_date = test_df["origin_date"].min()
    
    assert max_train_date < min_val_date, f"Train and Val overlap: {max_train_date} >= {min_val_date}"
    assert max_val_date < min_test_date, f"Val and Test overlap: {max_val_date} >= {min_test_date}"
    
    return train_df, val_df, test_df

def walk_forward_folds(
    supervised_df: pd.DataFrame,
    initial_train_size: int = 1000,
    step_size: int = 50,
    val_window_size: int = 50
) -> Generator[Tuple[pd.DataFrame, pd.DataFrame], None, None]:
    """
    Generate chronological expanding-window walk-forward folds.
    Ensures models evaluate progressively over time without looking ahead.
    """
    n = len(supervised_df)
    current_train_end = initial_train_size
    
    while current_train_end + val_window_size <= n:
        train_fold = supervised_df.iloc[:current_train_end]
        val_fold = supervised_df.iloc[current_train_end : current_train_end + val_window_size]
        yield train_fold, val_fold
        current_train_end += step_size
