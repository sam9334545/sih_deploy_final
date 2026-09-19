"""
Evaluation metrics for Phase 4 forecasting benchmarks.
All metrics enforce mathematical precision, safe denominators, and rigorous directional auditing.
"""
from typing import Dict, Any, Union, Tuple
import numpy as np
import pandas as pd

def calculate_mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Error."""
    return float(np.mean(np.abs(y_true - y_pred)))

def calculate_rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Root Mean Squared Error."""
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1e-5) -> float:
    """
    Mean Absolute Percentage Error (in percent).
    Uses a safe positive denominator to prevent division by zero.
    """
    safe_denom = np.maximum(np.abs(y_true), eps)
    return float(np.mean(np.abs((y_true - y_pred) / safe_denom)) * 100.0)

def calculate_naive_scale(y_train: np.ndarray) -> float:
    """
    Compute in-sample one-step naive mean absolute error on training series:
    scale = (1 / (N - 1)) * sum_{i=2}^N |y_i - y_{i-1}|
    
    STRICT RULE:
    The scale must be computed strictly on the training partition.
    Never calculate or update the scale using validation or test observations.
    """
    diffs = np.abs(np.diff(y_train))
    scale = float(np.mean(diffs))
    return max(scale, 1e-5)

def calculate_mase(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    training_naive_scale: float
) -> float:
    """
    Mean Absolute Scaled Error (Hyndman & Koehler, 2006).
    Scales MAE by the in-sample naive persistence error of the training set.
    """
    mae = calculate_mae(y_true, y_pred)
    return float(mae / training_naive_scale)

def calculate_directional_metrics(
    y_origin: np.ndarray,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    tol: float = 1e-4
) -> Dict[str, float]:
    """
    Directional Accuracy Audit with Neutral Rate Decomposition.
    
    IMPORTANT SCIENTIFIC CONTEXT:
    Persistence forecasts carry the latest level forward (y_hat = y_origin), 
    producing a predicted change of zero (neutral). Comparing sign(0) against 
    sign(actual_move != 0) yields 0.0% raw accuracy, not because persistence 
    predicted the wrong direction, but because it made no directional bet.
    
    This function reports:
      - predicted_neutral_rate: Percentage of forecasts with |y_hat - y_origin| <= tol
      - actual_neutral_rate: Percentage of actual moves with |y_true - y_origin| <= tol
      - directional_accuracy_all: Raw match rate across all observations
      - directional_accuracy_non_neutral: Accuracy computed ONLY when model predicted a non-zero move
    """
    pred_change = y_pred - y_origin
    actual_change = y_true - y_origin
    
    pred_neutral = np.abs(pred_change) <= tol
    actual_neutral = np.abs(actual_change) <= tol
    
    pred_dir = np.where(pred_neutral, 0, np.sign(pred_change))
    actual_dir = np.where(actual_neutral, 0, np.sign(actual_change))
    
    # 1. Neutral Rates
    n_total = len(y_origin)
    if n_total == 0:
        return {
            "directional_accuracy_all": np.nan,
            "directional_accuracy_non_neutral": np.nan,
            "predicted_neutral_rate": np.nan,
            "actual_neutral_rate": np.nan
        }
        
    p_neutral_rate = float(np.mean(pred_neutral) * 100.0)
    a_neutral_rate = float(np.mean(actual_neutral) * 100.0)
    
    # 2. Raw directional accuracy (all observations)
    acc_all = float(np.mean(pred_dir == actual_dir) * 100.0)
    
    # 3. Non-neutral directional accuracy (only when model predicted a movement)
    non_neutral_mask = ~pred_neutral
    if np.sum(non_neutral_mask) > 0:
        acc_non_neutral = float(np.mean(pred_dir[non_neutral_mask] == actual_dir[non_neutral_mask]) * 100.0)
    else:
        # e.g. for Naive Persistence, 100% of predictions are neutral
        acc_non_neutral = np.nan
        
    return {
        "directional_accuracy_all": round(acc_all, 2),
        "directional_accuracy_non_neutral": round(acc_non_neutral, 2) if not np.isnan(acc_non_neutral) else np.nan,
        "predicted_neutral_rate": round(p_neutral_rate, 2),
        "actual_neutral_rate": round(a_neutral_rate, 2)
    }

def calculate_directional_accuracy(
    y_origin: np.ndarray,
    y_true: np.ndarray,
    y_pred: np.ndarray
) -> float:
    """Backward compatibility wrapper returning directional_accuracy_all."""
    metrics = calculate_directional_metrics(y_origin, y_true, y_pred)
    return metrics["directional_accuracy_all"]

def evaluate_predictions(
    y_origin: np.ndarray,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    training_naive_scale: float
) -> Dict[str, Any]:
    """
    Compute full metric dictionary for a set of predictions.
    Filters out any NaN predictions (e.g. from unavailable seasonal naive).
    """
    mask = ~(np.isnan(y_true) | np.isnan(y_pred) | np.isnan(y_origin))
    if np.sum(mask) == 0:
        return {
            "mae": np.nan,
            "rmse": np.nan,
            "mape": np.nan,
            "mase": np.nan,
            "directional_accuracy": np.nan,
            "directional_accuracy_all": np.nan,
            "directional_accuracy_non_neutral": np.nan,
            "predicted_neutral_rate": np.nan,
            "actual_neutral_rate": np.nan,
            "n_predictions": 0
        }
        
    y_o = y_origin[mask]
    y_t = y_true[mask]
    y_p = y_pred[mask]
    
    dir_metrics = calculate_directional_metrics(y_o, y_t, y_p)
    
    return {
        "mae": round(calculate_mae(y_t, y_p), 4),
        "rmse": round(calculate_rmse(y_t, y_p), 4),
        "mape": round(calculate_mape(y_t, y_p), 4),
        "mase": round(calculate_mase(y_t, y_p, training_naive_scale), 4),
        "directional_accuracy": dir_metrics["directional_accuracy_all"],
        "directional_accuracy_all": dir_metrics["directional_accuracy_all"],
        "directional_accuracy_non_neutral": dir_metrics["directional_accuracy_non_neutral"],
        "predicted_neutral_rate": dir_metrics["predicted_neutral_rate"],
        "actual_neutral_rate": dir_metrics["actual_neutral_rate"],
        "n_predictions": int(np.sum(mask))
    }
