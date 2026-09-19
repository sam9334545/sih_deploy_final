"""
Split Conformal Prediction Interval Calibrator for SIH26006 Phase 5.
Calibrates empirical P10/P90 prediction intervals using validation nonconformity residuals.
Guarantees zero test set leakage.
"""
from typing import Tuple, Dict, Any, Optional
import math
import numpy as np

class SplitConformalCalibrator:
    """
    Split Conformal Calibrator for central prediction intervals [L, U].
    
    Calibration procedure (Validation partition only):
      1. Nonconformity score for each validation observation i:
         r_i = max(L_i - y_i, y_i - U_i, 0)
         Notice: r_i = 0 if y_i in [L_i, U_i]; r_i > 0 is the extent of boundary breach.
      2. Finite-sample conformal quantile:
         k = ceil((n_val + 1) * (1 - alpha))
         q_hat = sorted(r)[k - 1] (clamped to max(r) if k > n_val)
      3. Calibrated interval on new observations:
         L_cal = L - q_hat
         U_cal = U + q_hat
    """
    def __init__(self, target_coverage: float = 0.80):
        self.target_coverage = target_coverage
        self.alpha = 1.0 - target_coverage
        self.q_hat: Optional[float] = None
        self.n_calibration: int = 0
        self.validation_scores: Optional[np.ndarray] = None
        
    def fit(
        self,
        y_val: np.ndarray,
        lower_val: np.ndarray,
        upper_val: np.ndarray
    ):
        """
        Fit conformal adjustment strictly on validation partition.
        NEVER pass test data to this method.
        """
        n = len(y_val)
        if n == 0:
            raise ValueError("Validation set cannot be empty for conformal calibration.")
            
        self.n_calibration = n
        # Compute nonconformity scores
        breach_lower = lower_val - y_val
        breach_upper = y_val - upper_val
        scores = np.maximum(np.maximum(breach_lower, breach_upper), 0.0)
        self.validation_scores = scores
        
        # Finite-sample quantile selection
        # Level: ceil((n + 1) * (1 - alpha)) / n
        k = math.ceil((n + 1) * (1.0 - self.alpha))
        sorted_scores = np.sort(scores)
        
        # Guard against index exceeding sample size
        idx = min(k - 1, n - 1)
        self.q_hat = float(sorted_scores[idx])
        return self
        
    def calibrate(
        self,
        lower: np.ndarray,
        upper: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Apply frozen validation conformal adjustment to raw intervals.
        """
        if self.q_hat is None:
            raise RuntimeError("Calibrator must be fitted on validation data before calibrate() is called.")
            
        lower_cal = lower - self.q_hat
        upper_cal = upper + self.q_hat
        return lower_cal, upper_cal
