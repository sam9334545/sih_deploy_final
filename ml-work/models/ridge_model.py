"""
Ridge Regression forecasting benchmark for SIH26006 Phase 4.
Employs sklearn Pipeline with StandardScaler fitted strictly on the training partition.
"""
from typing import List, Optional, Tuple, Dict
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from .evaluation import calculate_mae

class RidgeForecaster:
    """
    Direct supervised Ridge regression forecaster.
    Fits StandardScaler and Ridge strictly on training partition of each split.
    """
    def __init__(self, alpha: float = 1.0, random_state: int = 42):
        self.name = "ridge"
        self.alpha = alpha
        self.random_state = random_state
        self.pipeline: Optional[Pipeline] = None
        
    def fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        """Fit scaler and Ridge model on training data only."""
        self.pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("ridge", Ridge(alpha=self.alpha, random_state=self.random_state))
        ])
        self.pipeline.fit(X_train, y_train)
        return self
        
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Predict using the fitted pipeline."""
        if self.pipeline is None:
            raise RuntimeError("Model must be fitted before predict() is called.")
        return np.array(self.pipeline.predict(X), dtype=float)

def tune_ridge_alpha(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    alphas: List[float] = None,
    random_state: int = 42
) -> Tuple[float, Dict[float, float]]:
    """
    Select best alpha using Validation MAE only.
    Test set is completely isolated and never seen during tuning.
    """
    if alphas is None:
        alphas = [0.01, 0.1, 1.0, 10.0, 100.0]
        
    best_alpha = alphas[0]
    best_mae = float("inf")
    val_maes = {}
    
    for alpha in alphas:
        model = RidgeForecaster(alpha=alpha, random_state=random_state)
        model.fit(X_train, y_train)
        preds = model.predict(X_val)
        mae = calculate_mae(y_val.values, preds)
        val_maes[alpha] = round(mae, 4)
        if mae < best_mae:
            best_mae = mae
            best_alpha = alpha
            
    return best_alpha, val_maes
