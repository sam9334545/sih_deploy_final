"""clean_bpi.py — Reproducible cleaning and preparation pipeline for Baltic Panamax Index (BPI) data.

Author: SIH26006 ML Pipeline Team
Project: Intelligent Freight Forecasting System (SIH26006)
Reference: SIH26006_Blueprint (1).md (§9.1, §17.1, §22, §44)
Input:  data/raw/original_dataset.csv
Output: data/processed/bpi_cleaned.csv

Guiding Principles:
1. Strict Data Provenance: Never fabricate or inject artificial values. Clearly track lineage.
2. Immutability: Never modify or overwrite data/raw/original_dataset.csv.
3. Temporal Integrity: Strictly sort chronologically; never introduce lookahead bias or shuffle.
4. Minimal Destructive Edits: Do not arbitrarily delete statistical outliers that represent legitimate market volatility.
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("clean_bpi")


def clean_bpi_dataset(
    raw_path: Path,
    output_path: Path,
    target_index: str = "BPI",
) -> dict:
    """Clean and standardize the BPI dataset from raw CSV.
    
    Returns a dictionary summary of cleaning statistics.
    """
    logger.info("Starting BPI data cleaning process.")
    logger.info(f"Source raw path: {raw_path.resolve()}")
    logger.info(f"Target output path: {output_path.resolve()}")

    if not raw_path.exists():
        raise FileNotFoundError(f"Raw dataset not found at {raw_path}")

    # Ensure output parent directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # 1. Load raw dataset
    df_raw = pd.read_csv(raw_path)
    raw_row_count = len(df_raw)
    raw_col_count = len(df_raw.columns)
    logger.info(f"Raw dataset loaded: {raw_row_count} rows, {raw_col_count} columns.")
    logger.info(f"Raw columns: {list(df_raw.columns)}")

    # 2. Filter for target index
    if "index_code" not in df_raw.columns:
        raise ValueError("Raw dataset missing required column: 'index_code'")

    available_codes = df_raw["index_code"].unique().tolist()
    logger.info(f"Available index codes in raw dataset: {available_codes}")

    if target_index not in available_codes:
        raise ValueError(f"Target index '{target_index}' not found in raw dataset.")

    df_target = df_raw[df_raw["index_code"] == target_index].copy()
    initial_target_rows = len(df_target)
    logger.info(f"Filtered for '{target_index}': {initial_target_rows} rows.")

    # 3. Duplicate row check
    exact_duplicates = df_target.duplicated().sum()
    logger.info(f"Exact duplicate rows detected: {exact_duplicates}")
    if exact_duplicates > 0:
        df_target = df_target.drop_duplicates().copy()
        logger.info(f"Removed {exact_duplicates} exact duplicate rows.")

    # 4. Date parsing and validation
    if "obs_date" not in df_target.columns:
        raise ValueError("Missing required column: 'obs_date'")

    # Parse dates explicitly
    parsed_dates = pd.to_datetime(df_target["obs_date"], format="%Y-%m-%d", errors="coerce")
    invalid_date_count = parsed_dates.isna().sum()
    if invalid_date_count > 0:
        logger.warning(f"Found {invalid_date_count} invalid/unparseable dates! Dropping invalid rows.")
        df_target = df_target[parsed_dates.notna()].copy()
        df_target["parsed_date"] = parsed_dates[parsed_dates.notna()]
    else:
        df_target["parsed_date"] = parsed_dates
        logger.info("All dates parsed successfully to ISO-8601 (YYYY-MM-DD).")

    # 5. Check duplicate dates
    duplicate_dates_count = df_target["parsed_date"].duplicated().sum()
    logger.info(f"Duplicate dates count: {duplicate_dates_count}")
    if duplicate_dates_count > 0:
        logger.warning(f"Handling {duplicate_dates_count} duplicate dates by keeping the first observation.")
        df_target = df_target.drop_duplicates(subset=["parsed_date"], keep="first").copy()

    # 6. Chronological sorting (CRITICAL for time series)
    df_target = df_target.sort_values(by="parsed_date", ascending=True).reset_index(drop=True)
    logger.info("Dataset chronologically sorted by date (ascending).")

    # 7. Data type conversions & validation
    # Convert 'value' to float64
    df_target["value"] = pd.to_numeric(df_target["value"], errors="coerce")
    val_nulls = df_target["value"].isna().sum()
    if val_nulls > 0:
        logger.warning(f"Found {val_nulls} non-numeric/null values in 'value' column.")

    # Convert 'tc_avg_usd_day' to float64
    if "tc_avg_usd_day" in df_target.columns:
        df_target["tc_avg_usd_day"] = pd.to_numeric(df_target["tc_avg_usd_day"], errors="coerce")
        tc_nulls = df_target["tc_avg_usd_day"].isna().sum()
        if tc_nulls > 0:
            logger.warning(f"Found {tc_nulls} non-numeric/null values in 'tc_avg_usd_day'.")
    else:
        df_target["tc_avg_usd_day"] = np.nan
        tc_nulls = len(df_target)

    # 8. Physical domain bounds check
    negative_values = (df_target["value"] < 0).sum()
    zero_values = (df_target["value"] == 0).sum()
    logger.info(f"Negative values: {negative_values}, Zero values: {zero_values}")

    if negative_values > 0:
        raise ValueError(f"Found impossible negative freight index values: {negative_values}")

    # 9. Calendar and missing date analysis
    earliest_date = df_target["parsed_date"].min()
    latest_date = df_target["parsed_date"].max()
    expected_bday_range = pd.date_range(start=earliest_date, end=latest_date, freq="B")
    observed_dates = set(df_target["parsed_date"])
    missing_bdays = expected_bday_range.difference(observed_dates)
    weekend_obs = df_target[df_target["parsed_date"].dt.weekday >= 5]

    logger.info(f"Date Range: {earliest_date.strftime('%Y-%m-%d')} to {latest_date.strftime('%Y-%m-%d')}")
    logger.info(f"Total calendar days: {(latest_date - earliest_date).days + 1}")
    logger.info(f"Expected Monday-Friday business days: {len(expected_bday_range)}")
    logger.info(f"Observed business days: {len(observed_dates)}")
    logger.info(f"Missing business days: {len(missing_bdays)}")
    logger.info(f"Weekend observations: {len(weekend_obs)}")

    # 10. Outlier and volatility analysis (Documented, NOT blindly deleted)
    q25 = df_target["value"].quantile(0.25)
    q75 = df_target["value"].quantile(0.75)
    iqr = q75 - q25
    lower_bound = q25 - 1.5 * iqr
    upper_bound = q75 + 1.5 * iqr
    outliers_iqr = df_target[(df_target["value"] < lower_bound) | (df_target["value"] > upper_bound)]
    logger.info(f"Outliers identified via 1.5*IQR [{lower_bound:.2f}, {upper_bound:.2f}]: {len(outliers_iqr)} rows.")
    logger.info("Preserving all outlier observations as legitimate market events.")

    # Check 1-day rate of change
    df_target["daily_return"] = df_target["value"].pct_change()
    jumps_10pct = df_target[df_target["daily_return"].abs() > 0.10]
    logger.info(f"Observations with 1-day price movement > 10%: {len(jumps_10pct)} rows.")

    # 11. Format final clean schema
    # Standardize column naming for downstream ML ingestion
    df_cleaned = pd.DataFrame()
    df_cleaned["obs_date"] = df_target["parsed_date"].dt.strftime("%Y-%m-%d")
    df_cleaned["index_code"] = df_target["index_code"].astype(str)
    df_cleaned["bpi_value"] = df_target["value"].round(2)
    df_cleaned["tc_avg_usd_day"] = df_target["tc_avg_usd_day"].round(2)
    
    # Provenance tracking column
    if "source_url" in df_target.columns:
        df_cleaned["source_url"] = df_target["source_url"]
    else:
        df_cleaned["source_url"] = "Unknown"

    # Flag indicating whether data is official or synthetic demo
    df_cleaned["provenance_tag"] = df_cleaned["source_url"].apply(
        lambda x: "simulated_demo" if "simulated demo" in str(x).lower() else "unverified"
    )

    # 12. Save cleaned dataset
    df_cleaned.to_csv(output_path, index=False)
    logger.info(f"Cleaned dataset saved successfully to {output_path.resolve()}.")
    logger.info(f"Cleaned dataset rows: {len(df_cleaned)}, columns: {len(df_cleaned.columns)}.")

    summary = {
        "raw_total_rows": raw_row_count,
        "raw_bpi_rows": initial_target_rows,
        "cleaned_rows": len(df_cleaned),
        "exact_duplicates_removed": int(exact_duplicates),
        "duplicate_dates_removed": int(duplicate_dates_count),
        "invalid_dates_removed": int(invalid_date_count),
        "missing_values_in_value": int(val_nulls),
        "missing_values_in_tc": int(tc_nulls),
        "earliest_date": earliest_date.strftime("%Y-%m-%d"),
        "latest_date": latest_date.strftime("%Y-%m-%d"),
        "iqr_outliers_preserved": len(outliers_iqr),
        "extreme_jumps_preserved": len(jumps_10pct),
        "missing_business_days": len(missing_bdays),
        "columns": list(df_cleaned.columns),
    }
    return summary


def main():
    parser = argparse.ArgumentParser(description="Clean Baltic Panamax Index (BPI) data.")
    parser.add_argument(
        "--raw",
        type=Path,
        default=Path("data/raw/original_dataset.csv"),
        help="Path to original raw dataset",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("data/processed/bpi_cleaned.csv"),
        help="Path to cleaned output CSV",
    )
    args = parser.parse_args()

    summary = clean_bpi_dataset(args.raw, args.output)
    print("\n" + "=" * 50)
    print("CLEANING SUMMARY:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print("=" * 50)


if __name__ == "__main__":
    main()
