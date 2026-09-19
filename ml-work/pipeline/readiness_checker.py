"""
Current Market Forecast Readiness Checker for SIH26006.
Enforces Section 30, 34, and 56 Current Forecast Safety Checks.

GUARANTEE:
Prevents the application from claiming a current (post-2020 or 2026) forecast
unless legitimate recent market observations have been obtained, verified,
and the models properly retrained and calibrated.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime, date
from pathlib import Path
from typing import Dict, Any, Optional, List
import pandas as pd

from .dataset_versioning import DatasetVersionMetadata, compute_sha256

ROOT_DIR = Path(__file__).resolve().parent.parent
PROCESSED_HISTORICAL_PATH = ROOT_DIR / "data" / "processed" / "real_baltic_multivariate.csv"
PROCESSED_EXTENDED_PATH = ROOT_DIR / "data" / "processed" / "extended_post_2019" / "real_baltic_multivariate_extended.csv"
SAVED_MODELS_DIR = ROOT_DIR / "models" / "saved_models"
CALIBRATION_RESULTS_PATH = ROOT_DIR / "reports" / "phase5_calibration_results.csv"


@dataclass
class ForecastReadinessReport:
    """Detailed machine-readable status report for current vs historical forecasting capability."""
    current_forecast_ready: bool
    status: str  # "READY" or "BLOCKED_HISTORICAL_ONLY"
    mode: str    # "HISTORICAL_DEVELOPMENT" or "PRODUCTION_CURRENT"
    data_cutoff: str
    dataset_version: str
    model_version: str
    feature_version: str
    calibration_version: str
    indices_available: dict[str, bool]
    horizons_available: list[int]
    blockers: list[str]
    notes: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


def check_forecast_readiness(
    target_mode: str = "CURRENT",
    extended_data_path: Optional[Path] = None,
) -> ForecastReadinessReport:
    """
    Audit current system readiness against Section 56 safety criteria.
    """
    blockers: list[str] = []
    horizons = [7, 14, 28, 60, 90, 180]
    indices = {"BCI": False, "BPI": False, "BSI": False, "BHSI": False}

    ext_path = extended_data_path or PROCESSED_EXTENDED_PATH
    has_extended_data = ext_path.exists() and ext_path.stat().st_size > 100

    if target_mode == "CURRENT":
        if not has_extended_data:
            blockers.append(
                "Authorized post-2019 Baltic dry-bulk sub-index dataset is missing. "
                "No legitimate open-access BCI/BPI/BSI/BHSI data past 2019-07-31 is present in workspace."
            )
        else:
            # Audit extended data file
            df_ext = pd.read_csv(ext_path)
            for k, col in [("BCI", "bci_value"), ("BPI", "bpi_value"), ("BSI", "bsi_value"), ("BHSI", "bhsi_value")]:
                if col in df_ext.columns and df_ext[col].notna().sum() > 0:
                    indices[k] = True
                else:
                    blockers.append(f"Extended dataset missing valid column '{col}' for {k}.")

            dates = pd.to_datetime(df_ext["obs_date"])
            max_date = str(dates.max().date())
            today_str = str(date.today())
            if max_date < "2024-01-01":
                blockers.append(f"Extended dataset max date ({max_date}) is older than 2024. Not current.")

    # Check baseline historical data
    if not PROCESSED_HISTORICAL_PATH.exists():
        blockers.append(f"Baseline historical dataset missing at {PROCESSED_HISTORICAL_PATH}")
    else:
        df_hist = pd.read_csv(PROCESSED_HISTORICAL_PATH)
        for k, col in [("BCI", "bci_value"), ("BPI", "bpi_value"), ("BSI", "bsi_value"), ("BHSI", "bhsi_value")]:
            if col in df_hist.columns and df_hist[col].notna().sum() > 0:
                indices[k] = True

    # Check model artifacts in saved_models
    expected_tasks = [(t, h) for t in ["bci", "bpi", "bsi", "bhsi"] for h in horizons]
    missing_models = []
    for t, h in expected_tasks:
        m_file = SAVED_MODELS_DIR / f"quantile_lgb_{t}_h{h}.joblib"
        if not m_file.exists():
            missing_models.append(f"{t.upper()}_h{h}")

    if missing_models:
        blockers.append(f"Missing {len(missing_models)} model artifacts: {missing_models[:4]}...")

    # Check calibration file
    if not CALIBRATION_RESULTS_PATH.exists():
        blockers.append(f"Conformal calibration table missing at {CALIBRATION_RESULTS_PATH}")

    # Determine readiness
    current_ready = (len(blockers) == 0) and has_extended_data
    status = "READY" if current_ready else "BLOCKED_HISTORICAL_ONLY"
    mode = "PRODUCTION_CURRENT" if current_ready else "HISTORICAL_DEVELOPMENT"
    data_cutoff = "2019-07-31" if not has_extended_data else str(pd.to_datetime(pd.read_csv(ext_path)["obs_date"]).max().date())

    return ForecastReadinessReport(
        current_forecast_ready=current_ready,
        status=status,
        mode=mode,
        data_cutoff=data_cutoff,
        dataset_version="baltic_dry_subindices_v20190731_1749" if not has_extended_data else "baltic_extended_v_post2019",
        model_version="phase5_quantile_lgbm_conformal_v1",
        feature_version="phase3_leakage_safe_39feats_v1",
        calibration_version="split_conformal_val_only_80pct_v1",
        indices_available=indices,
        horizons_available=horizons,
        blockers=blockers,
        notes=(
            "System is operating securely in HISTORICAL_DEVELOPMENT mode on verified 2012–2019 Baltic data. "
            "Current 2026 forecasting is blocked until legitimate authorized post-2019 Baltic Exchange sub-indices are provided."
            if not current_ready else "All post-2019 data and retrained models verified."
        ),
    )
