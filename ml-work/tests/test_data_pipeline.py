import pytest
import pandas as pd
import numpy as np
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.config import PipelineConfig
from pipeline.cleaner import clean_dataset
from pipeline.validator import validate_series

def test_clean_dataset_basic():
    df = pd.DataFrame({
        "obs_date": ["2023-01-03", "2023-01-02", "2023-01-01"],
        "index_code": ["BPI", "BPI", "BPI"],
        "value": [1520.5, 1500.0, 1490.2],
        "tc_avg_usd_day": [13684.5, 13500.0, 13411.8]
    })
    cleaned_df, audit = clean_dataset(df)
    
    assert len(cleaned_df) == 3
    # Check chronological ordering
    assert list(cleaned_df["obs_date"]) == ["2023-01-01", "2023-01-02", "2023-01-03"]
    assert audit["exact_duplicates_removed"] == 0
    assert audit["invalid_dates_found"] == 0

def test_clean_dataset_removes_duplicates():
    df = pd.DataFrame({
        "obs_date": ["2023-01-01", "2023-01-01", "2023-01-02"],
        "index_code": ["BPI", "BPI", "BPI"],
        "value": [1500.0, 1500.0, 1510.0],
        "tc_avg_usd_day": [13500.0, 13500.0, 13590.0]
    })
    cleaned_df, audit = clean_dataset(df)
    assert len(cleaned_df) == 2
    assert audit["exact_duplicates_removed"] == 1
    assert list(cleaned_df["obs_date"]) == ["2023-01-01", "2023-01-02"]

def test_clean_dataset_flags_conflicting_dates():
    df = pd.DataFrame({
        "obs_date": ["2023-01-01", "2023-01-01"],
        "index_code": ["BPI", "BPI"],
        "value": [1500.0, 1800.0],  # Conflicting values on same date
        "tc_avg_usd_day": [13500.0, 16200.0]
    })
    with pytest.raises(ValueError, match="conflicting values"):
        clean_dataset(df)

def test_clean_dataset_flags_negative_values():
    df = pd.DataFrame({
        "obs_date": ["2023-01-01"],
        "index_code": ["BPI"],
        "value": [-100.0],  # Impossible negative freight rate
        "tc_avg_usd_day": [-900.0]
    })
    with pytest.raises(ValueError, match="Physical constraint violated"):
        clean_dataset(df)

def test_teammate_can_add_or_correct_observations():
    """
    Simulate teammate workflow:
    1. Base dataset with 3 dates.
    2. Teammate appends a 4th date (2023-01-04).
    3. Pipeline runs cleanly without any code modifications.
    """
    base_df = pd.DataFrame({
        "obs_date": ["2023-01-01", "2023-01-02", "2023-01-03"],
        "index_code": ["BPI", "BPI", "BPI"],
        "value": [1500.0, 1510.0, 1520.0],
        "tc_avg_usd_day": [13500.0, 13590.0, 13680.0]
    })
    cleaned_base, _ = clean_dataset(base_df)
    assert len(cleaned_base) == 3

    # Teammate adds new observation
    new_row = pd.DataFrame({
        "obs_date": ["2023-01-04"],
        "index_code": ["BPI"],
        "value": [1535.0],
        "tc_avg_usd_day": [13815.0]
    })
    updated_raw = pd.concat([base_df, new_row], ignore_index=True)
    
    cleaned_updated, audit = clean_dataset(updated_raw)
    assert len(cleaned_updated) == 4
    assert cleaned_updated.iloc[-1]["obs_date"] == "2023-01-04"
    assert cleaned_updated.iloc[-1]["bpi_value"] == 1535.0

def test_validation_outliers_and_jumps():
    # Construct series with one huge jump
    df = pd.DataFrame({
        "obs_date": ["2023-01-01", "2023-01-02", "2023-01-03"],
        "index_code": ["BPI", "BPI", "BPI"],
        "bpi_value": [1000.0, 1200.0, 1150.0],  # 20% jump on day 2
        "tc_avg_usd_day": [9000.0, 10800.0, 10350.0],
        "source_url": ["test", "test", "test"],
        "provenance_tag": ["test", "test", "test"]
    })
    metrics = validate_series(df)
    assert metrics["jump_events_count"] == 1
    assert metrics["jump_events"][0]["pct_change"] == 20.0

def test_clean_real_multivariate_dataset():
    """Test cleaning the real Mendeley Baltic sub-indices dataset."""
    config = PipelineConfig()
    real_csv = config.real_raw_path
    assert real_csv.exists(), f"Missing real raw dataset at {real_csv}"
    
    df_raw = pd.read_csv(real_csv)
    cleaned_df, audit = clean_dataset(df_raw, config)
    
    assert len(cleaned_df) == 1749
    assert list(cleaned_df.columns) == [
        "obs_date", "bpi_value", "bci_value", "bsi_value", "bhsi_value", "source_url", "provenance_tag"
    ]
    # Check strictly ascending dates
    dates = pd.to_datetime(cleaned_df["obs_date"])
    assert dates.is_monotonic_increasing
    assert str(dates.min().date()) == "2012-08-01"
    assert str(dates.max().date()) == "2019-07-31"
    # Zero nulls across all four sub-indices
    for col in ["bpi_value", "bci_value", "bsi_value", "bhsi_value"]:
        assert cleaned_df[col].isna().sum() == 0
        assert (cleaned_df[col] < 0).sum() == 0

def test_multivariate_column_mapping():
    """Verify that PI, CI, SI, HSI map correctly to standardized names."""
    df = pd.DataFrame({
        "Date": ["2019-07-31", "2019-07-30"],
        "PI": [1891, 1969],
        "CI": [3657, 3664],
        "SI": [982, 988],
        "HSI": [516, 516],
        "DTI": [621, 624],
        "CTI": [456.0, 455.0]
    })
    cleaned, audit = clean_dataset(df)
    assert "bpi_value" in cleaned.columns
    assert "bci_value" in cleaned.columns
    assert "bsi_value" in cleaned.columns
    assert "bhsi_value" in cleaned.columns
    assert "DTI" not in cleaned.columns  # Tanker indices excluded
    assert "CTI" not in cleaned.columns
    # Check values mapped accurately
    assert cleaned.loc[cleaned["obs_date"] == "2019-07-31", "bpi_value"].iloc[0] == 1891.0
    assert cleaned.loc[cleaned["obs_date"] == "2019-07-31", "bci_value"].iloc[0] == 3657.0

def test_synthetic_data_isolation():
    """Verify that real processed dataset has proper provenance tag and no demo mixing."""
    config = PipelineConfig()
    df_raw = pd.read_csv(config.real_raw_path)
    cleaned, audit = clean_dataset(df_raw, config)
    
    # Must have the real provenance tag
    assert (cleaned["provenance_tag"] == "verified_real_mendeley_cc_by_4.0").all()
    # Must not contain synthetic demo tags
    assert (cleaned["provenance_tag"] != "synthetic_calibrated_demo").all()
    # Must not contain post-July-2019 synthetic rows
    dates = pd.to_datetime(cleaned["obs_date"])
    assert (dates > pd.to_datetime("2019-07-31")).sum() == 0

def test_preservation_of_legitimate_crashes():
    """Verify that the historic 2016 shipping downturn lows are preserved."""
    config = PipelineConfig()
    df_raw = pd.read_csv(config.real_raw_path)
    cleaned, _ = clean_dataset(df_raw, config)
    
    # 2016 historic minimums must be preserved intact
    min_bpi = cleaned["bpi_value"].min()
    min_bci = cleaned["bci_value"].min()
    assert min_bpi == 282.0, f"Expected BPI min 282.0, got {min_bpi}"
    assert min_bci == 92.0, f"Expected BCI min 92.0, got {min_bci}"

