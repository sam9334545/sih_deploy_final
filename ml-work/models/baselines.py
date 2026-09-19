"""
Baseline forecasting models for SIH26006 Phase 4.
All baseline models use strictly historical information available at forecast origin t.
"""
from typing import Union, List, Optional
import numpy as np
import pandas as pd

class NaivePersistence:
    """
    Carries the latest observed level at forecast origin t forward across all horizons:
    y_hat(t+h) = Y(t)
    """
    def __init__(self):
        self.name = "naive_persistence"
        
    def predict(self, current_levels: np.ndarray, horizon: int) -> np.ndarray:
        return np.array(current_levels, dtype=float).copy()

class SeasonalNaive:
    """
    Seasonal Naive Forecast:
    y_hat(t+h) = Y(t + h - P)
    where P is the seasonal period (e.g. 250 trading sessions per calendar year).
    
    If the historical reference index (t + h - P) is negative (before series start),
    the forecast returns NaN to cleanly mark the observation unavailable rather than inventing data.
    """
    def __init__(self, seasonal_period: int = 250):
        self.name = "seasonal_naive"
        self.period = seasonal_period
        
    def predict_single(
        self,
        full_series: np.ndarray,
        origin_idx: int,
        horizon: int
    ) -> float:
        ref_idx = origin_idx + horizon - self.period
        if ref_idx < 0 or ref_idx >= len(full_series):
            return np.nan
        return float(full_series[ref_idx])
        
    def predict_series(
        self,
        full_series: np.ndarray,
        origin_indices: np.ndarray,
        horizon: int
    ) -> np.ndarray:
        preds = [self.predict_single(full_series, int(idx), horizon) for idx in origin_indices]
        return np.array(preds, dtype=float)

class MovingAverage:
    """
    Moving Average Forecast:
    Mean of the latest W observed trading sessions at origin t:
    y_hat(t+h) = (1 / W) * sum_{i=0}^{W-1} Y(t - i)
    """
    def __init__(self, window: int = 7):
        self.window = window
        self.name = f"moving_average_{window}"
        
    def predict_single(self, full_series: np.ndarray, origin_idx: int) -> float:
        if origin_idx < self.window - 1:
            return np.nan
        win = full_series[origin_idx - self.window + 1 : origin_idx + 1]
        return float(np.mean(win))
        
    def predict_series(
        self,
        full_series: np.ndarray,
        origin_indices: np.ndarray
    ) -> np.ndarray:
        preds = [self.predict_single(full_series, int(idx)) for idx in origin_indices]
        return np.array(preds, dtype=float)

class DampedDrift:
    """
    Damped Drift Forecast:
    Drift over lookback L:
    drift = (Y(t) - Y(t - L)) / L
    
    Damped projection over horizon h with damping factor phi in (0, 1):
    y_hat(t+h) = Y(t) + drift * sum_{i=1}^h phi^i
               = Y(t) + drift * phi * (1 - phi^h) / (1 - phi)
    """
    def __init__(self, lookback: int = 30, damping_factor: float = 0.95):
        self.lookback = lookback
        self.damping_factor = damping_factor
        self.name = "damped_drift"
        
    def predict_single(
        self,
        full_series: np.ndarray,
        origin_idx: int,
        horizon: int
    ) -> float:
        if origin_idx < self.lookback:
            return np.nan
            
        y_t = float(full_series[origin_idx])
        y_past = float(full_series[origin_idx - self.lookback])
        drift = (y_t - y_past) / float(self.lookback)
        
        # Cumulative damping: sum_{i=1}^h phi^i = phi * (1 - phi^h) / (1 - phi)
        phi = self.damping_factor
        cumulative_damping = phi * (1.0 - (phi ** horizon)) / (1.0 - phi)
        
        return float(y_t + drift * cumulative_damping)
        
    def predict_series(
        self,
        full_series: np.ndarray,
        origin_indices: np.ndarray,
        horizon: int
    ) -> np.ndarray:
        preds = [self.predict_single(full_series, int(idx), horizon) for idx in origin_indices]
        return np.array(preds, dtype=float)
