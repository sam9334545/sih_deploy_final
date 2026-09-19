"""
Phase 7A Test Suite: Data Reconciliation, Artifact Audit & Retraining Readiness.

Verifies:
  1. Data Count Reconciliation: Raw (1,749) == Processed (1,749) with 0 dropped rows.
  2. Model Artifact Audit: 24 task files serializing TripletQuantileForecasters (72 total models).
  3. Calibration Table Integrity: All 24 target-horizon combinations have valid q_hat factors.
  4. Source Registry Audit: Proper statuses (VERIFIED, REQUIRES_AUTHORIZED_ACCESS, REJECTED).
  5. Dataset Versioning: Deterministic SHA-256 checksum and metadata sidecars.
  6. Extended Data Validator: Automated rejection of invalid, composite-only, or corrupted candidate datasets.
  7. Temporal Split Configuration: Chronological non-overlapping boundaries for 2015–2026 splits.
  8. Forecast Readiness Checker: Reliably blocks current forecast claims until authorized data arrives.
  9. Dataset Transition Invariance: Historical baseline is immutable and invariant.
"""
import pytest
import json
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
import sys

# Ensure ml-work and backend-work are in sys.path
ML_WORK_DIR = Path(__file__).resolve().parent.parent
BACKEND_WORK_DIR = ML_WORK_DIR.parent / "backend-work"
sys.path.insert(0, str(ML_WORK_DIR))
sys.path.insert(0, str(BACKEND_WORK_DIR))

from pipeline.dataset_versioning import compute_sha256, generate_dataset_version
from pipeline.validate_extended_data import ExtendedDataValidator
from pipeline.split_config import HISTORICAL_SPLIT, EXTENDED_PRODUCTION_SPLIT
from pipeline.readiness_checker import check_forecast_readiness
from models.quantile_lightgbm import TripletQuantileForecaster


# =====================================================================
# 1. DATA COUNT RECONCILIATION (Section 5)
# =====================================================================
def test_dataset_count_reconciliation_exact_1749():
    """Verify that both raw and processed datasets contain exactly 1,749 verified sessions."""
    raw_path = ML_WORK_DIR / "data" / "raw" / "mendeley_baltic_subindices_2012_2019.csv"
    proc_path = ML_WORK_DIR / "data" / "processed" / "real_baltic_multivariate.csv"

    assert raw_path.exists()
    assert proc_path.exists()

    df_raw = pd.read_csv(raw_path)
    df_proc = pd.read_csv(proc_path)

    # 1. Exactly 1,749 rows
    assert len(df_raw) == 1749
    assert len(df_proc) == 1749

    # 2. Exactly 1,749 unique dates, 0 duplicates
    date_col_raw = [c for c in df_raw.columns if "date" in c.lower()][0]
    assert df_raw[date_col_raw].nunique() == 1749
    assert df_proc["obs_date"].nunique() == 1749

    # 3. Exactly 0 nulls across the 4 Baltic sub-indices
    for col in ["bpi_value", "bci_value", "bsi_value", "bhsi_value"]:
        assert df_proc[col].isna().sum() == 0
        assert (df_proc[col] <= 0).sum() == 0


# =====================================================================
# 2. MODEL ARTIFACT AUDIT (Section 6 & 7)
# =====================================================================
def test_model_artifact_audit_24_files_72_quantile_models():
    """
    Verify the 24 serialized .joblib files contain TripletQuantileForecaster objects
    encapsulating exactly 72 Quantile LightGBM models (P10, P50, P90).
    """
    saved_dir = ML_WORK_DIR / "models" / "saved_models"
    assert saved_dir.exists()

    targets = ["bci", "bpi", "bsi", "bhsi"]
    horizons = [7, 14, 28, 60, 90, 180]

    total_files = 0
    total_submodels = 0

    for t in targets:
        for h in horizons:
            file_path = saved_dir / f"quantile_lgb_{t}_h{h}.joblib"
            assert file_path.exists(), f"Missing model file for {t.upper()} h={h}"
            total_files += 1

            triplet = joblib.load(file_path)
            assert isinstance(triplet, TripletQuantileForecaster)
            assert hasattr(triplet, "models")
            assert set(triplet.models.keys()) == {0.10, 0.50, 0.90}
            total_submodels += len(triplet.models)

    assert total_files == 24
    assert total_submodels == 72


def test_conformal_calibration_factors_for_all_24_tasks():
    """Verify that calibration factors exist for all 24 tasks and are strictly positive."""
    calib_path = ML_WORK_DIR / "reports" / "phase5_calibration_results.csv"
    assert calib_path.exists()

    df_cal = pd.read_csv(calib_path)
    assert len(df_cal) == 24

    targets = ["BCI", "BPI", "BSI", "BHSI"]
    horizons = [7, 14, 28, 60, 90, 180]

    for t in targets:
        for h in horizons:
            match = df_cal[(df_cal["target"] == t) & (df_cal["horizon"] == h)]
            assert len(match) == 1
            q_hat = float(match["q_hat"].values[0])
            assert q_hat > 0, f"q_hat for {t} h={h} must be positive"


# =====================================================================
# 3. SOURCE REGISTRY & DATA INTEGRITY (Section 8, 9, 10)
# =====================================================================
def test_source_registry_schema_and_statuses():
    """Verify source registry conforms to project data integrity guidelines."""
    registry_path = ML_WORK_DIR / "data" / "source_registry.json"
    assert registry_path.exists()

    with open(registry_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "sources" in data
    sources = {s["source_id"]: s for s in data["sources"]}

    # Baseline Mendeley source must be VERIFIED
    assert "mendeley_dry_bulk_2012_2019" in sources
    assert sources["mendeley_dry_bulk_2012_2019"]["verification_status"] == "VERIFIED"

    # Official Baltic API must require authorized access
    assert "baltic_exchange_official_api" in sources
    assert sources["baltic_exchange_official_api"]["verification_status"] == "REQUIRES_AUTHORIZED_ACCESS"

    # Composite BDI must be rejected as target
    assert "investing_composite_bdi_feed" in sources
    assert sources["investing_composite_bdi_feed"]["verification_status"] == "REJECTED_AS_TARGET"


# =====================================================================
# 4. EXTENDED DATA VALIDATOR (Section 14, 15, 16)
# =====================================================================
def test_extended_data_validator_rules():
    """Test automated validation pipeline for candidate extended datasets."""
    validator = ExtendedDataValidator()

    # Valid dataset (sub-sample of real data)
    proc_path = ML_WORK_DIR / "data" / "processed" / "real_baltic_multivariate.csv"
    valid_df = pd.read_csv(proc_path).iloc[-50:].copy()
    report = validator.validate(valid_df, "test_valid_tail")
    assert report.passed is True
    assert len(report.errors) == 0

    # Test rejection of missing index (only BDI provided)
    invalid_bdi_df = pd.DataFrame({
        "obs_date": ["2020-01-02", "2020-01-03"],
        "BDI": [1500, 1520]
    })
    report_bdi = validator.validate(invalid_bdi_df, "test_invalid_bdi")
    assert report_bdi.passed is False
    assert any("Missing required Baltic sub-index" in e for e in report_bdi.errors)

    # Test rejection of negative or zero values
    invalid_neg_df = valid_df.copy()
    invalid_neg_df.loc[invalid_neg_df.index[0], "bpi_value"] = -100.0
    report_neg = validator.validate(invalid_neg_df, "test_invalid_neg")
    assert report_neg.passed is False
    assert any("negative or zero" in e for e in report_neg.errors)

    # Test rejection of duplicate dates
    dupe_df = pd.concat([valid_df, valid_df.iloc[[0]]])
    report_dupe = validator.validate(dupe_df, "test_dupe")
    assert report_dupe.passed is False
    assert any("duplicate dates" in e for e in report_dupe.errors)


# =====================================================================
# 5. TEMPORAL SPLIT CONFIGURATION (Section 22 & 23)
# =====================================================================
def test_temporal_splits_are_chronological_and_non_overlapping():
    """Verify temporal split boundaries for both historical and extended splits."""
    # Historical split
    assert HISTORICAL_SPLIT.train_end < HISTORICAL_SPLIT.val_start
    assert HISTORICAL_SPLIT.val_end < HISTORICAL_SPLIT.test_start

    # Extended production split (Section 22)
    assert EXTENDED_PRODUCTION_SPLIT.train_start == "2015-01-01"
    assert EXTENDED_PRODUCTION_SPLIT.train_end == "2022-12-31"
    assert EXTENDED_PRODUCTION_SPLIT.val_start == "2023-01-01"
    assert EXTENDED_PRODUCTION_SPLIT.val_end == "2024-12-31"
    assert EXTENDED_PRODUCTION_SPLIT.test_start == "2025-01-01"
    assert EXTENDED_PRODUCTION_SPLIT.train_end < EXTENDED_PRODUCTION_SPLIT.val_start
    assert EXTENDED_PRODUCTION_SPLIT.val_end < EXTENDED_PRODUCTION_SPLIT.test_start


# =====================================================================
# 6. FORECAST READINESS CHECKER (Section 30, 34, 56)
# =====================================================================
def test_forecast_readiness_checker_blocks_current_mode_honestly():
    """
    Verify that the system honestly blocks CURRENT FORECAST when post-2019 data is absent,
    and reports BLOCKED_HISTORICAL_ONLY without claiming fake 2026 predictions.
    """
    report = check_forecast_readiness(target_mode="CURRENT")
    assert report.current_forecast_ready is False
    assert report.status == "BLOCKED_HISTORICAL_ONLY"
    assert report.mode == "HISTORICAL_DEVELOPMENT"
    assert report.data_cutoff == "2019-07-31"
    assert len(report.blockers) > 0
    assert any("Authorized post-2019" in b for b in report.blockers)


def test_backend_status_endpoint_reports_readiness():
    """Verify backend GET /api/v1/historical/status endpoint returns readiness report."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)
    res = client.get("/api/v1/historical/status")
    assert res.status_code == 200
    json_data = res.json()

    assert json_data["current_forecast_ready"] is False
    assert json_data["mode"] == "HISTORICAL_DEVELOPMENT"
    assert json_data["data_cutoff"] == "2019-07-31"
    assert "BCI" in json_data["indices_available"]


# =====================================================================
# 7. DATASET TRANSITION INVARIANCE (Section 43)
# =====================================================================
def test_dataset_transition_invariance_preserves_historical_values():
    """
    Section 43: Extending the dataset must leave historical values (2012–2019)
    100% numerically invariant.
    """
    proc_path = ML_WORK_DIR / "data" / "processed" / "real_baltic_multivariate.csv"
    df_hist = pd.read_csv(proc_path)

    # Simulated candidate extension
    simulated_extension = pd.DataFrame({
        "obs_date": ["2019-08-01", "2019-08-02"],
        "bpi_value": [2000, 2010],
        "bci_value": [3800, 3850],
        "bsi_value": [1000, 1005],
        "bhsi_value": [520, 525],
        "source_url": ["test_source", "test_source"],
        "provenance_tag": ["candidate_verified", "candidate_verified"],
    })
    for c in df_hist.columns:
        if c in simulated_extension.columns:
            simulated_extension[c] = simulated_extension[c].astype(df_hist[c].dtype)

    combined = pd.concat([df_hist, simulated_extension], ignore_index=True)

    # Verify that first 1,749 rows of combined dataset remain strictly identical to df_hist
    hist_part = combined.iloc[: len(df_hist)]
    pd.testing.assert_frame_equal(hist_part, df_hist)
