"""
Quantile LightGBM Forecaster for SIH26006 Phase 5.
Trains direct quantile regression models for P10, P50, and P90 uncertainty intervals.
Includes quantile crossing detection and monotonic rearrangement.
"""
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
import pandas as pd
import lightgbm as lgb

class QuantileLightGBMForecaster:
    """
    Direct Quantile LightGBM Regressor for predicting conditional quantiles.
    Operates on the 39 backward-looking Phase 3 features.
    """
    def __init__(
        self,
        quantile: float = 0.50,
        params: Optional[Dict[str, Any]] = None
    ):
        self.quantile = quantile
        self.name = f"lightgbm_q{int(quantile * 100):02d}"
        
        default_params = {
            "objective": "quantile",
            "alpha": quantile,
            "n_estimators": 300,
            "learning_rate": 0.03,
            "num_leaves": 15,
            "max_depth": 5,
            "min_child_samples": 20,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "random_state": 42,
            "n_jobs": 1,
            "verbose": -1
        }
        if params:
            default_params.update(params)
            default_params["objective"] = "quantile"
            default_params["alpha"] = quantile
            
        self.params = default_params
        self.model: Optional[lgb.LGBMRegressor] = None
        
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Fit quantile model on training data strictly."""
        self.model = lgb.LGBMRegressor(**self.params)
        self.model.fit(X_train, y_train)
        return self
        
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Generate quantile predictions."""
        if self.model is None:
            raise RuntimeError(f"Quantile model for q={self.quantile} must be fitted first.")
        return np.array(self.model.predict(X), dtype=float)

class TripletQuantileForecaster:
    """
    Container coordinating P10, P50, and P90 models for a single (target, horizon) task.
    """
    def __init__(
        self,
        quantiles: Tuple[float, float, float] = (0.10, 0.50, 0.90),
        base_params: Optional[Dict[str, Any]] = None
    ):
        self.quantiles = quantiles
        self.models = {
            q: QuantileLightGBMForecaster(quantile=q, params=base_params)
            for q in quantiles
        }
        
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        for q, model in self.models.items():
            model.fit(X_train, y_train)
        return self
        
    def predict(self, X: pd.DataFrame) -> Dict[str, np.ndarray]:
        """
        Generate raw predictions for P10, P50, P90.
        """
        return {
            "p10": self.models[0.10].predict(X),
            "p50": self.models[0.50].predict(X),
            "p90": self.models[0.90].predict(X)
        }

def detect_quantile_crossings(
    p10: np.ndarray,
    p50: np.ndarray,
    p90: np.ndarray
) -> Tuple[float, np.ndarray]:
    """
    Measure crossing rate where P10 > P50 or P50 > P90.
    Returns:
      crossing_rate_pct: Percentage of rows with at least one crossing
      crossing_mask: Boolean array indicating crossing rows
    """
    crossings = (p10 > p50) | (p50 > p90)
    crossing_rate = float(np.mean(crossings) * 100.0)
    return round(crossing_rate, 2), crossings

def enforce_monotonic_quantiles(
    p10: np.ndarray,
    p50: np.ndarray,
    p90: np.ndarray
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Apply Chernozhukov et al. (2010) quantile rearrangement to guarantee
    monotonicity (P10 <= P50 <= P90) without discarding models.
    """
    stacked = np.column_stack([p10, p50, p90])
    sorted_stacked = np.sort(stacked, axis=1)
    return sorted_stacked[:, 0], sorted_stacked[:, 1], sorted_stacked[:, 2]
