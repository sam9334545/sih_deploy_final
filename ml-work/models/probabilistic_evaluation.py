"""
Probabilistic Evaluation Metrics for SIH26006 Phase 5.
Computes pinball losses, empirical interval coverage, interval widths, and crossing rates.
"""
from typing import Dict, Any, Tuple
import numpy as np

def calculate_pinball_loss(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    q: float
) -> float:
    """
    Standard Quantile (Pinball) Loss:
    L_q(y, q_hat) = q * (y - q_hat) if y >= q_hat else (1 - q) * (q_hat - y)
    """
    diff = y_true - y_pred
    loss = np.where(diff >= 0, q * diff, (1.0 - q) * (-diff))
    return float(np.mean(loss))

def calculate_interval_coverage(
    y_true: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray
) -> float:
    """
    Empirical coverage percentage of prediction interval [lower, upper].
    """
    covered = (y_true >= lower) & (y_true <= upper)
    return float(np.mean(covered) * 100.0)

def calculate_interval_width(
    lower: np.ndarray,
    upper: np.ndarray
) -> Tuple[float, float]:
    """
    Compute mean and median interval width (upper - lower).
    """
    widths = upper - lower
    return float(np.mean(widths)), float(np.median(widths))

def evaluate_probabilistic_forecasts(
    y_true: np.ndarray,
    p10: np.ndarray,
    p50: np.ndarray,
    p90: np.ndarray,
    p10_cal: np.ndarray,
    p90_cal: np.ndarray,
    target_coverage: float = 80.0
) -> Dict[str, Any]:
    """
    Compute full probabilistic evaluation dictionary for raw and calibrated intervals.
    """
    n = len(y_true)
    if n == 0:
        return {}
        
    # Pinball losses
    loss_p10 = calculate_pinball_loss(y_true, p10, 0.10)
    loss_p50 = calculate_pinball_loss(y_true, p50, 0.50)
    loss_p90 = calculate_pinball_loss(y_true, p90, 0.90)
    
    # Raw Interval Diagnostics
    raw_coverage = calculate_interval_coverage(y_true, p10, p90)
    raw_mean_w, raw_med_w = calculate_interval_width(p10, p90)
    
    # Conformal Calibrated Diagnostics
    cal_coverage = calculate_interval_coverage(y_true, p10_cal, p90_cal)
    cal_mean_w, cal_med_w = calculate_interval_width(p10_cal, p90_cal)
    
    # Quantile crossing check
    crossing_mask = (p10 > p50) | (p50 > p90)
    crossing_rate = float(np.mean(crossing_mask) * 100.0)
    
    return {
        "n_predictions": n,
        "pinball_loss_p10": round(loss_p10, 4),
        "pinball_loss_p50": round(loss_p50, 4),
        "pinball_loss_p90": round(loss_p90, 4),
        "target_coverage_pct": target_coverage,
        "raw_coverage_pct": round(raw_coverage, 2),
        "raw_mean_width": round(raw_mean_w, 2),
        "raw_median_width": round(raw_med_w, 2),
        "calibrated_coverage_pct": round(cal_coverage, 2),
        "calibrated_mean_width": round(cal_mean_w, 2),
        "calibrated_median_width": round(cal_med_w, 2),
        "coverage_error_raw": round(raw_coverage - target_coverage, 2),
        "coverage_error_calibrated": round(cal_coverage - target_coverage, 2),
        "crossing_rate_pct": round(crossing_rate, 2)
    }
