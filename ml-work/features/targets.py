import math
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from pathlib import Path
from .config import FeatureConfig
from .builder import build_feature_matrix

def create_supervised_forecasting_dataset(
    df: pd.DataFrame,
    target_col: str,
    horizon: int,
    config: FeatureConfig = None,
    base_features_df: pd.DataFrame = None
) -> pd.DataFrame:
    """
    Construct a supervised learning dataset for a specific target and horizon.
    
    Target definition:
    For origin at session i:
      - origin_date = df.iloc[i]['obs_date']
      - target_date = df.iloc[i + horizon]['obs_date']
      - target_value = df.iloc[i + horizon][target_col]
      - target_log_return = ln(target_value) - ln(current_known_level)
      
    Observations where i + horizon >= len(df) are excluded (no future leakage).
    """
    if config is None:
        config = FeatureConfig()
        
    warmup = max(max(config.lags), max(config.rolling_windows))
    total_len = len(df)
    
    # Compute base feature matrix if not provided
    if base_features_df is None:
        base_features_df = build_feature_matrix(df, target_col, config)
        
    # The base_features_df has origins starting at warmup index
    # We can form valid pairs for i in range(warmup, total_len - horizon)
    n_valid = total_len - warmup - horizon
    if n_valid <= 0:
        raise ValueError(f"Horizon {horizon} too long for dataset length {total_len} with warmup {warmup}")
        
    # Slice the origins that have a future target available
    supervised = base_features_df.iloc[:n_valid].copy()
    
    # Target indices in df are offset by warmup + horizon
    target_indices = np.arange(warmup + horizon, total_len)
    
    target_dates = df.iloc[target_indices]["obs_date"].values
    target_vals = df.iloc[target_indices][target_col].values.astype(float)
    
    origin_dts = pd.to_datetime(supervised["origin_date"])
    target_dts = pd.to_datetime(target_dates)
    calendar_days = (target_dts - origin_dts).dt.days.values
    
    current_vals = supervised["current_known_level"].values.astype(float)
    log_returns = np.log(target_vals) - np.log(current_vals)
    
    # Assign metadata and targets
    supervised["horizon_sessions"] = horizon
    supervised["target_date"] = target_dates
    supervised["calendar_days_elapsed"] = calendar_days
    supervised["target_value"] = np.round(target_vals, 2)
    supervised["target_log_return"] = np.round(log_returns, 5)
    
    # Time-aware split assignment
    origin_dates_series = supervised["origin_date"]
    split_col = np.where(
        origin_dates_series <= config.train_end_date, "train",
        np.where(origin_dates_series <= config.val_end_date, "val", "test")
    )
    supervised["split_set"] = split_col
    
    return supervised

def generate_all_forecasting_datasets(
    df: pd.DataFrame,
    config: FeatureConfig = None
) -> Dict[str, pd.DataFrame]:
    """
    Generate and save supervised datasets across all targets and horizons efficiently.
    """
    if config is None:
        config = FeatureConfig()
        
    config.output_features_dir.mkdir(parents=True, exist_ok=True)
    datasets: Dict[str, pd.DataFrame] = {}
    
    for target in config.target_indices:
        short_name = target.replace("_value", "").upper()
        print(f"Building base feature matrix for {short_name}...")
        base_df = build_feature_matrix(df, target, config)
        
        for h in config.horizons:
            key = f"{short_name}_h{h}"
            ds = create_supervised_forecasting_dataset(df, target, h, config, base_features_df=base_df)
            out_file = config.output_features_dir / f"dataset_{short_name.lower()}_h{h}.csv"
            ds.to_csv(out_file, index=False)
            datasets[key] = ds
            print(f"  Saved {key}: {len(ds)} rows -> {out_file.name}")
            
    return datasets
