"""
Production ML Inference Service for SIH26006.
Loads verified historical Baltic data and Phase 5 Quantile LightGBM models
to generate probabilistic forecasts (P10, P50, P90) with split conformal calibration.

STRICT ANTI-LEAKAGE GUARANTEE:
  - Accesses strictly observations on or before origin_date (t <= T).
  - Target value at T+h is used strictly for post-forecast backtest evaluation.
  - Data cutoff: 2019-07-31. Any query beyond cutoff marks actual as NOT_AVAILABLE.
"""
from __future__ import annotations

import math
import os
from dataclasses import dataclass, asdict
from datetime import datetime, date
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb

from features.config import FeatureConfig
from features.builder import build_features_for_row
from models.config import ModelConfig
from models.quantile_lightgbm import (
    TripletQuantileForecaster,
    enforce_monotonic_quantiles,
    detect_quantile_crossings
)
from models.conformal import SplitConformalCalibrator
from route.vessel_mapping import VESSEL_INDEX_MAP, INDEX_VESSEL_MAP
from route.forecast_object import MarketForecast, VALID_HORIZONS

ROOT_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DATA_PATH = ROOT_DIR / "data" / "processed" / "real_baltic_multivariate.csv"
CALIBRATION_RESULTS_PATH = ROOT_DIR / "reports" / "phase5_calibration_results.csv"
SAVED_MODELS_DIR = ROOT_DIR / "models" / "saved_models"


@dataclass(frozen=True)
class HistoricalForecastResult:
    """
    Standardized payload for historical forecast and backtest evaluation.
    """
    target: str
    vessel_type: str
    origin_date: str
    target_date: str
    horizon_sessions: int

    # Market Index Forecasts
    p10_raw: float
    p50_raw: float
    p90_raw: float
    p10_calibrated: float
    p50: float
    p90_calibrated: float
    conformal_q_hat: float
    raw_width: float
    calibrated_width: float

    # Historical Backtest Actual & Error Metrics (when target_date <= cutoff)
    actual_value: Optional[float]
    actual_status: str  # "OBSERVED" or "NOT_AVAILABLE"
    absolute_error: Optional[float]
    percentage_error: Optional[float]
    inside_raw_interval: Optional[bool]
    inside_calibrated_interval: Optional[bool]

    # Provenance & Metadata
    model_name: str
    model_version: str
    data_mode: str
    data_cutoff: str
    provenance: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_market_forecast(self) -> MarketForecast:
        """Convert to Phase 6A MarketForecast contract for downstream route/optimizer compatibility."""
        target_d = self.target_date if self.target_date != "OUT_OF_SAMPLE_POST_2019" else "2019-12-31"
        return MarketForecast(
            target=self.target,
            vessel_type=self.vessel_type,
            origin_date=self.origin_date,
            target_date=target_d,
            horizon_sessions=self.horizon_sessions,
            p10_raw=self.p10_raw,
            p50_raw=self.p50_raw,
            p90_raw=self.p90_raw,
            p10_calibrated=self.p10_calibrated,
            p50=self.p50,
            p90_calibrated=self.p90_calibrated,
            raw_width=self.raw_width,
            calibrated_width=self.calibrated_width,
            model_version=self.model_version,
            data_version="mendeley_verified_2012_2019",
            data_cutoff="2019-07-31",
            provenance="HISTORICAL_DEVELOPMENT",
        )


class MLInferenceService:
    """
    Inference service managing feature extraction, quantile LightGBM models,
    and split conformal calibration for all 4 Baltic targets and 6 horizons.
    """
    def __init__(self, data_path: Optional[Path] = None):
        self.data_path = data_path or PROCESSED_DATA_PATH
        if not self.data_path.exists():
            raise FileNotFoundError(f"Processed dataset missing at {self.data_path}")
            
        self.df = pd.read_csv(self.data_path)
        self.df["obs_date"] = pd.to_datetime(self.df["obs_date"]).dt.strftime("%Y-%m-%d")
        self.df = self.df.sort_values("obs_date").reset_index(drop=True)
        self.date_to_idx = {d: i for i, d in enumerate(self.df["obs_date"])}
        
        self.model_config = ModelConfig()
        self.feature_config = FeatureConfig()
        SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Load precomputed conformal adjustment factors q_hat
        self.conformal_adjustments: dict[tuple[str, int], float] = {}
        if CALIBRATION_RESULTS_PATH.exists():
            calib_df = pd.read_csv(CALIBRATION_RESULTS_PATH)
            for _, r in calib_df.iterrows():
                self.conformal_adjustments[(r["target"], int(r["horizon"]))] = float(r["q_hat"])
                
        # In-memory model cache
        self._model_cache: dict[tuple[str, int], TripletQuantileForecaster] = {}

    def get_available_dates(self) -> list[str]:
        """Return all valid forecast origin dates after feature warmup period (>= 90 sessions)."""
        warmup = max(max(self.feature_config.lags), max(self.feature_config.rolling_windows))
        return list(self.df["obs_date"].iloc[warmup:])

    def _get_or_train_model(self, target: str, horizon: int) -> TripletQuantileForecaster:
        """
        Retrieve cached model or load from disk; if absent, train on development partition.
        """
        cache_key = (target, horizon)
        if cache_key in self._model_cache:
            return self._model_cache[cache_key]

        model_path = SAVED_MODELS_DIR / f"quantile_lgb_{target.lower()}_h{horizon}.joblib"
        if model_path.exists():
            try:
                triplet = joblib.load(model_path)
                self._model_cache[cache_key] = triplet
                return triplet
            except Exception:
                pass

        # Load feature dataset from data/features/
        feat_file = ROOT_DIR / "data" / "features" / f"dataset_{target.lower()}_h{horizon}.csv"
        if not feat_file.exists():
            raise FileNotFoundError(f"Feature dataset not found: {feat_file}")
            
        feat_df = pd.read_csv(feat_file)
        meta_cols = [
            "origin_date", "target_index", "horizon_sessions",
            "target_date", "calendar_days_elapsed", "target_value",
            "target_log_return", "split_set"
        ]
        feat_cols = [c for c in feat_df.columns if c not in meta_cols]
        
        # Train on train+val partition (development partition prior to test)
        tr_df = feat_df[feat_df["split_set"].isin(["train", "val"])].copy().reset_index(drop=True)
        X_tr = tr_df[feat_cols]
        y_tr = tr_df["target_value"]
        
        triplet = TripletQuantileForecaster(base_params=self.model_config.lgb_params)
        triplet.fit(X_tr, y_tr)
        
        # Save to disk for sub-millisecond future queries
        try:
            joblib.dump(triplet, model_path)
        except Exception:
            pass
            
        self._model_cache[cache_key] = triplet
        return triplet

    def forecast(
        self,
        target: str,
        origin_date: str,
        horizon_sessions: int,
        vessel_type: Optional[str] = None
    ) -> HistoricalForecastResult:
        """
        Generate probabilistic market forecast for a specific origin and horizon.
        
        Parameters:
          - target: Baltic index code ("BCI", "BPI", "BSI", "BHSI")
          - origin_date: YYYY-MM-DD trading session date (must be in verified dataset)
          - horizon_sessions: Trading sessions in (7, 14, 28, 60, 90, 180)
          - vessel_type: Optional vessel class name (auto-mapped if not supplied)
        """
        target = target.upper().strip()
        if target not in INDEX_VESSEL_MAP:
            raise ValueError(f"Unknown Baltic target '{target}'. Allowed: {list(INDEX_VESSEL_MAP.keys())}")
            
        if horizon_sessions not in VALID_HORIZONS:
            raise ValueError(f"Invalid horizon {horizon_sessions}. Allowed discrete horizons: {VALID_HORIZONS}")
            
        resolved_vessel = vessel_type or INDEX_VESSEL_MAP[target]
        expected_index = VESSEL_INDEX_MAP.get(resolved_vessel)
        if expected_index and expected_index != target:
            raise ValueError(f"Vessel '{resolved_vessel}' maps to '{expected_index}', not '{target}'.")
            
        if origin_date not in self.date_to_idx:
            raise ValueError(
                f"Origin date '{origin_date}' not found in verified historical Baltic trading sessions. "
                f"Coverage is 2012-08-01 through 2019-07-31."
            )
            
        origin_idx = self.date_to_idx[origin_date]
        warmup = max(max(self.feature_config.lags), max(self.feature_config.rolling_windows))
        if origin_idx < warmup:
            raise ValueError(f"Origin date '{origin_date}' is inside the initial warmup window (< {warmup} sessions).")

        # 1. Build backward-looking features strictly up to origin_idx (ANTI-LEAKAGE)
        target_col = self.model_config.target_column_map[target]
        features_dict = build_features_for_row(self.df, origin_idx, target_col, self.feature_config)
        
        # Load reference feature column names
        feat_file = ROOT_DIR / "data" / "features" / f"dataset_{target.lower()}_h{horizon_sessions}.csv"
        ref_df = pd.read_csv(feat_file, nrows=1)
        meta_cols = [
            "origin_date", "target_index", "horizon_sessions",
            "target_date", "calendar_days_elapsed", "target_value",
            "target_log_return", "split_set"
        ]
        feat_cols = [c for c in ref_df.columns if c not in meta_cols]
        
        # Prepare single-row feature DataFrame
        X_infer = pd.DataFrame([{c: features_dict.get(c, 0.0) for c in feat_cols}])

        # 2. Generate raw quantile predictions
        triplet = self._get_or_train_model(target, horizon_sessions)
        raw_preds = triplet.predict(X_infer)
        p10_raw = float(raw_preds["p10"][0])
        p50_raw = float(raw_preds["p50"][0])
        p90_raw = float(raw_preds["p90"][0])

        # 3. Monotonic Quantile Rearrangement
        mono_10, mono_50, mono_90 = enforce_monotonic_quantiles(
            np.array([p10_raw]), np.array([p50_raw]), np.array([p90_raw])
        )
        p10_mono = float(mono_10[0])
        p50_mono = float(mono_50[0])
        p90_mono = float(mono_90[0])

        # 4. Split Conformal Calibration Adjustment
        q_hat = self.conformal_adjustments.get((target, horizon_sessions), 0.0)
        p10_cal = round(p10_mono - q_hat, 2)
        p90_cal = round(p90_mono + q_hat, 2)
        p50_final = round(p50_mono, 2)

        # 5. Target Date & Historical Backtest Evaluation
        target_idx = origin_idx + horizon_sessions
        if target_idx < len(self.df):
            target_row = self.df.iloc[target_idx]
            target_date = target_row["obs_date"]
            actual_val = float(target_row[target_col])
            actual_status = "OBSERVED"
            abs_err = round(abs(actual_val - p50_final), 2)
            pct_err = round((abs_err / actual_val) * 100.0, 2)
            in_raw = bool((actual_val >= p10_mono) and (actual_val <= p90_mono))
            in_cal = bool((actual_val >= p10_cal) and (actual_val <= p90_cal))
        else:
            # Future target falls after 2019-07-31 cutoff
            target_date = "OUT_OF_SAMPLE_POST_2019"
            actual_val = None
            actual_status = "NOT_AVAILABLE"
            abs_err = None
            pct_err = None
            in_raw = None
            in_cal = None

        return HistoricalForecastResult(
            target=target,
            vessel_type=resolved_vessel,
            origin_date=origin_date,
            target_date=target_date,
            horizon_sessions=horizon_sessions,
            p10_raw=round(p10_raw, 2),
            p50_raw=round(p50_raw, 2),
            p90_raw=round(p90_raw, 2),
            p10_calibrated=p10_cal,
            p50=p50_final,
            p90_calibrated=p90_cal,
            conformal_q_hat=round(q_hat, 2),
            raw_width=round(p90_mono - p10_mono, 2),
            calibrated_width=round(p90_cal - p10_cal, 2),
            actual_value=actual_val,
            actual_status=actual_status,
            absolute_error=abs_err,
            percentage_error=pct_err,
            inside_raw_interval=in_raw,
            inside_calibrated_interval=in_cal,
            model_name="quantile_lightgbm_triplet",
            model_version="phase5_quantile_conformal_v1",
            data_mode="HISTORICAL_DEVELOPMENT",
            data_cutoff="2019-07-31",
            provenance="mendeley_verified_2012_2019",
        )


_default_inference_service: Optional[MLInferenceService] = None

def get_inference_service() -> MLInferenceService:
    """Return a shared singleton instance of MLInferenceService."""
    global _default_inference_service
    if _default_inference_service is None:
        _default_inference_service = MLInferenceService()
    return _default_inference_service

