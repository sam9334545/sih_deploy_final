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
