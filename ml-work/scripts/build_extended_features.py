"""
Phase 7B Script 2: Build Extended Features.
Combines verified post-2019 data with 2012–2019 historical baseline,
generates unified real_baltic_multivariate_extended.csv,
and builds the 24 supervised feature datasets across discrete horizons (7, 14, 28, 60, 90, 180)
using the exact 39-feature leakage-safe Phase 3 builder and the SIH 2015–2026 split.
"""
from __future__ import annotations

import sys
from pathlib import Path
import pandas as pd
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from features.config import FeatureConfig
from features.builder import build_features_for_row
from pipeline.split_config import EXTENDED_PRODUCTION_SPLIT
from pipeline.dataset_versioning import generate_dataset_version, save_dataset_metadata

BASELINE_PATH = ROOT_DIR / "data" / "processed" / "real_baltic_multivariate.csv"
VERIFIED_RAW_DIR = ROOT_DIR / "data" / "raw" / "post_2019" / "verified"
EXTENDED_PROCESSED_DIR = ROOT_DIR / "data" / "processed" / "extended_post_2019"
EXTENDED_PROCESSED_FILE = EXTENDED_PROCESSED_DIR / "real_baltic_multivariate_extended.csv"
EXTENDED_FEATURES_DIR = ROOT_DIR / "data" / "features" / "extended"


def main():
    print("=" * 70)
    print("SIH26006 — Phase 7B: Extended Feature Dataset Generation")
    print("=" * 70)

    EXTENDED_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    EXTENDED_FEATURES_DIR.mkdir(parents=True, exist_ok=True)

    verified_files = list(VERIFIED_RAW_DIR.glob("*.csv"))
    if not verified_files:
        print("\n[BLOCKED] No verified post-2019 dataset found in:")
        print(f"  {VERIFIED_RAW_DIR}")
        print("Run validate_post_2019.py on incoming candidate data first.")
        return False

    verified_raw_file = verified_files[0]
    print(f"Loading verified post-2019 raw data from: {verified_raw_file.name}")
    df_post = pd.read_csv(verified_raw_file)
    df_base = pd.read_csv(BASELINE_PATH)

    print(f"Baseline rows: {len(df_base)} ({df_base['obs_date'].min()} to {df_base['obs_date'].max()})")
    
    # Standardize column names if needed
    col_map = {"CI": "bci_value", "PI": "bpi_value", "SI": "bsi_value", "HSI": "bhsi_value", "Date": "obs_date"}
    df_post = df_post.rename(columns=col_map)
    df_post["obs_date"] = pd.to_datetime(df_post["obs_date"]).dt.strftime("%Y-%m-%d")

    # Combine ensuring strictly chronological ordering and non-overlapping dates
    base_dates = set(df_base["obs_date"])
    df_post_new = df_post[~df_post["obs_date"].isin(base_dates)].copy()
    print(f"New non-overlapping post-2019 rows: {len(df_post_new)}")

    df_extended = pd.concat([df_base, df_post_new], ignore_index=True)
    df_extended = df_extended.sort_values("obs_date").reset_index(drop=True)
    print(f"Unified extended dataset: {len(df_extended)} rows ({df_extended['obs_date'].min()} to {df_extended['obs_date'].max()})")

    # Save extended processed CSV and metadata
    df_extended.to_csv(EXTENDED_PROCESSED_FILE, index=False)
    version_meta = generate_dataset_version(
        file_path=EXTENDED_PROCESSED_FILE,
        dataset_id="baltic_extended_multivariate",
        provenance_tag="mendeley_plus_authorized_post2019",
        is_extended=True,
    )
    save_dataset_metadata(version_meta, EXTENDED_PROCESSED_DIR / "metadata.json")
    print(f"Saved extended processed dataset to {EXTENDED_PROCESSED_FILE}")

    # Build features for all 24 tasks
    feature_config = FeatureConfig()
    horizons = [7, 14, 28, 60, 90, 180]
    targets = [("bci_value", "BCI"), ("bpi_value", "BPI"), ("bsi_value", "BSI"), ("bhsi_value", "BHSI")]

    warmup = max(max(feature_config.lags), max(feature_config.rolling_windows))
    n_rows = len(df_extended)

    for target_col, target_name in targets:
        for h in horizons:
            rows = []
            for i in range(warmup, n_rows - h):
                feats = build_features_for_row(df_extended, i, target_col, feature_config)
                # Future target observation (strictly t + h)
                target_row = df_extended.iloc[i + h]
                feats["horizon_sessions"] = h
                feats["target_date"] = target_row["obs_date"]
                feats["calendar_days_elapsed"] = (
                    pd.to_datetime(target_row["obs_date"]) - pd.to_datetime(feats["origin_date"])
                ).days
                target_val = float(target_row[target_col])
                feats["target_value"] = target_val
                feats["target_log_return"] = round(np.log(target_val) - feats["log_level"], 5)
                rows.append(feats)

            df_task = pd.DataFrame(rows)
            # Assign splits per EXTENDED_PRODUCTION_SPLIT
            df_task["split_set"] = EXTENDED_PRODUCTION_SPLIT.assign_split(df_task["origin_date"])

            out_path = EXTENDED_FEATURES_DIR / f"dataset_{target_name.lower()}_h{h}.csv"
            df_task.to_csv(out_path, index=False)
            print(f"Generated {out_path.name}: {len(df_task)} rows (splits: {df_task['split_set'].value_counts().to_dict()})")

    print("\n[SUCCESS] All 24 extended feature datasets generated successfully.")
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
