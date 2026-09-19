#!/usr/bin/env python
"""
CLI Runner: Generate Supervised Forecasting Datasets from Real Baltic Data.
"""

import sys
from pathlib import Path
import pandas as pd

# Add ml-work to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from features.config import FeatureConfig
from features.targets import generate_all_forecasting_datasets
from features.validation import verify_anti_leakage

def main():
    config = FeatureConfig()
    print("==================================================")
    print("  SIH26006 Supervised Feature Dataset Generation")
    print("==================================================")
    print(f"Input Real Dataset: {config.input_processed_path}")
    print(f"Target Indices:     {config.target_indices}")
    print(f"Forecast Horizons:  {config.horizons} trading sessions")
    print(f"Output Directory:   {config.output_features_dir}")
    print("--------------------------------------------------")

    if not config.input_processed_path.exists():
        raise FileNotFoundError(f"Missing input dataset at {config.input_processed_path}")

    df_real = pd.read_csv(config.input_processed_path)
    print(f"Loaded {len(df_real):,} real Baltic trading sessions ({df_real['obs_date'].min()} to {df_real['obs_date'].max()})")

    # 1. Anti-Leakage Verification Check
    print("\nRunning Automated Anti-Leakage Verification...")
    leak_res = verify_anti_leakage(df_real, target_col="bpi_value", horizon=7)
    print(f"  Leakage Check Status:       {leak_res['status']}")
    print(f"  Future Perturbation Impact: {leak_res['future_perturbation_impact']}")
    print(f"  Target Ordering:            {leak_res['chronological_target_order']}")
    print(f"  Feature Columns Audited:    {leak_res['features_checked_count']}")

    # 2. Generate Supervised Datasets
    print("\nGenerating supervised datasets across all targets and horizons...")
    datasets = generate_all_forecasting_datasets(df_real, config)

    # 3. Print Dataset Statistics Summary
    print("\n--------------------------------------------------")
    print("Dataset Summary Manifest:")
    print("Target | Horizon | Usable Rows | Train | Val | Test | Dropped (Lookback+Horizon)")
    print("-------|---------|-------------|-------|-----|------|---------------------------")
    warmup = max(max(config.lags), max(config.rolling_windows))
    for key, ds in datasets.items():
        n_train = (ds["split_set"] == "train").sum()
        n_val = (ds["split_set"] == "val").sum()
        n_test = (ds["split_set"] == "test").sum()
        h = ds["horizon_sessions"].iloc[0]
        dropped = warmup + h
        print(f"{key:6} | {h:3}d     | {len(ds):11,} | {n_train:5} | {n_val:3} | {n_test:4} | {dropped:3} rows")

    print("==================================================")
    print("Successfully generated all supervised feature datasets!")

if __name__ == "__main__":
    main()
