import math
from typing import Dict, Any, List
import numpy as np
import pandas as pd
from .config import FeatureConfig

def build_features_for_row(
    df: pd.DataFrame,
    row_idx: int,
    target_col: str,
    config: FeatureConfig = None
) -> Dict[str, Any]:
    """
    Generate all feature values for a single forecast origin at row_idx.
    
    STRICT ANTI-LEAKAGE GUARANTEE:
    This function accesses ONLY rows at or before row_idx (df.iloc[:row_idx + 1]).
    It never reads, slices, or references any row at index > row_idx.
    """
    if config is None:
        config = FeatureConfig()
        
    warmup = max(max(config.lags), max(config.rolling_windows))
    if row_idx < warmup:
        raise ValueError(
            f"Row index {row_idx} is within the warmup period (< {warmup}). "
            f"Cannot compute full 90-day rolling features."
        )
        
    # Strictly truncate the history available up to the forecast origin
    history = df.iloc[:row_idx + 1]
    origin_row = history.iloc[-1]
    origin_date = pd.to_datetime(origin_row["obs_date"])
    
    y_history = history[target_col].values
    current_val = float(y_history[-1])
    current_log = math.log(current_val)
    
    feats: Dict[str, Any] = {
        "origin_date": origin_row["obs_date"],
        "target_index": target_col,
        "current_known_level": round(current_val, 2),
        "log_level": round(current_log, 5),
    }
    
    # 1. Target Lag Features (Values observed at t - lag)
    for l in config.lags:
        lag_val = float(y_history[-1 - l])
        feats[f"lag_{l}"] = round(lag_val, 2)
        
    # 2. Rolling Window Features (Statistics of last w sessions strictly ending at t)
    for w in config.rolling_windows:
        win = y_history[-w:]
        feats[f"rolling_mean_{w}"] = round(float(win.mean()), 2)
        feats[f"rolling_std_{w}"] = round(float(win.std()), 2)
        
    # 3. Momentum & Log Returns (Past price changes ending at t)
    for r in config.return_lookbacks:
        past_log = math.log(float(y_history[-1 - r]))
        feats[f"log_return_{r}"] = round(current_log - past_log, 5)
        
    # 4. Cross-Index Features (Sibling Baltic sub-indices known at or before t)
    other_indices = [col for col in config.target_indices if col != target_col and col in df.columns]
    for other_col in other_indices:
        other_hist = history[other_col].values
        col_prefix = other_col.replace("_value", "")
        for cl in config.cross_index_lags:
            feats[f"{col_prefix}_lag_{cl}"] = round(float(other_hist[-1 - cl]), 2)
            
    # 5. Annual Fourier Seasonality (Derived strictly from calendar day of year of origin_date)
    doy = origin_date.dayofyear
    for k in range(1, config.fourier_harmonics + 1):
        angle = 2.0 * math.pi * k * doy / 365.25
        feats[f"fourier_sin_{k}"] = round(math.sin(angle), 5)
        feats[f"fourier_cos_{k}"] = round(math.cos(angle), 5)
        
    return feats

def build_feature_matrix(
    df: pd.DataFrame,
    target_col: str,
    config: FeatureConfig = None
) -> pd.DataFrame:
    """
    Build the complete feature matrix across all valid forecast origins in df.
    Omits rows during the initial warmup period to ensure 100% complete features.
    """
    if config is None:
        config = FeatureConfig()
        
    warmup = max(max(config.lags), max(config.rolling_windows))
    feature_rows: List[Dict[str, Any]] = []
    
    for i in range(warmup, len(df)):
        row_feats = build_features_for_row(df, i, target_col, config)
        feature_rows.append(row_feats)
        
    feat_df = pd.DataFrame(feature_rows)
    return feat_df
