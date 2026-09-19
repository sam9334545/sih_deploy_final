"""
LightGBM direct forecasting benchmark for SIH26006 Phase 4.
Uses conservative CPU parameters tailored for small time-series datasets.
"""
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
import lightgbm as lgb

class LightGBMForecaster:
    """
    Direct LightGBM gradient boosted decision tree regressor.
    Predicts target_value using the 39 backward-looking features.
    """
    def __init__(self, params: Optional[Dict[str, Any]] = None):
        self.name = "lightgbm"
        default_params = {
            "objective": "regression",
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
        self.params = default_params
        self.model: Optional[lgb.LGBMRegressor] = None
        
    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        eval_set: Optional[list] = None,
        callbacks: Optional[list] = None
    ):
        """Fit LightGBM model on training data."""
        self.model = lgb.LGBMRegressor(**self.params)
        if eval_set is not None:
            self.model.fit(
                X_train,
                y_train,
                eval_set=eval_set,
                callbacks=callbacks
            )
        else:
            self.model.fit(X_train, y_train)
        return self
        
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Generate predictions."""
        if self.model is None:
            raise RuntimeError("Model must be fitted before predict() is called.")
        return np.array(self.model.predict(X), dtype=float)
