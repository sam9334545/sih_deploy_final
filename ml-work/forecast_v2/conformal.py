"""Calibrated prediction intervals via conformalized quantile regression (CQR).

The previous pipeline produced 80% intervals that covered 50% of outcomes, and
quantile curves that crossed (p90 below p10) on up to 38% of origins. Both are
fixed here, and neither fix is cosmetic:

  * Crossing is removed at the source by sorting the three quantile predictions
    per origin. A crossed triple is not a forecast, and rank-sorting is the
    standard, distribution-free repair.
  * Coverage is repaired by CQR (Romano, Patterson & Candès, 2019) rather than by
    scaling the width until it looks right. We fit q_lo/q_hi, measure the
    conformity score E = max(q_lo − y, y − q_hi) on a calibration window the model
    never trained on, and widen by its (1−α) empirical quantile. That gives
    finite-sample marginal coverage under exchangeability alone.
  * The calibration window is the most recent block before the origin, never a
    random sample, because freight volatility regimes persist.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from forecast_v2 import models as M


@dataclass
class IntervalResult:
    frame: pd.DataFrame
    coverage: float
    mean_width: float
    pinball: float
    crossing_rate: float
    q_hat: float


def _pinball(y: np.ndarray, q: np.ndarray, tau: float) -> float:
    d = y - q
    return float(np.mean(np.maximum(tau * d, (tau - 1) * d)))


def walk_forward_intervals(
    data: pd.DataFrame, feature_cols: list[str], *, alpha: float = 0.20,
    min_train: int = 500, step: int = 21, cal_frac: float = 0.25,
    augment: tuple[np.ndarray, np.ndarray] | None = None,
    augment_weight: float = 0.3, augment_ratio: float = 3.0,
) -> IntervalResult:
    lo_q, hi_q = alpha / 2, 1 - alpha / 2
    X_all = data[feature_cols].to_numpy(dtype=float)
    y_all = data["target_logret"].to_numpy(dtype=float)
    rows = []

    for block_start in range(min_train, len(data), step):
        block_end = min(block_start + step, len(data))
        X_tr, y_tr = X_all[:block_start], y_all[:block_start]

        n_cal = max(60, int(len(X_tr) * cal_frac))
        X_fit, y_fit = X_tr[:-n_cal], y_tr[:-n_cal]
        X_cal, y_cal = X_tr[-n_cal:], y_tr[-n_cal:]

        w = None
        if augment is not None:
            aug_X, aug_y = augment
            cap = int(len(X_fit) * augment_ratio)
            if len(aug_X) > cap:
                sel = np.linspace(0, len(aug_X) - 1, cap).astype(int)
                aug_X, aug_y = aug_X[sel], aug_y[sel]
            w = np.concatenate([np.full(len(aug_X), augment_weight), np.ones(len(X_fit))])
            X_fit = np.vstack([aug_X, X_fit])
            y_fit = np.concatenate([aug_y, y_fit])

        qs = {}
        for tau, tag in ((lo_q, "lo"), (0.5, "mid"), (hi_q, "hi")):
            m = M.LgbModel(objective="quantile", alpha=tau)
            m.fit(X_fit, y_fit, X_val=X_cal, y_val=y_cal, sample_weight=w)
            qs[tag] = m

        cal_lo, cal_hi = qs["lo"].predict(X_cal), qs["hi"].predict(X_cal)
        cal_lo, cal_hi = np.minimum(cal_lo, cal_hi), np.maximum(cal_lo, cal_hi)
        scores = np.maximum(cal_lo - y_cal, y_cal - cal_hi)
        n = len(scores)
        k = min(n - 1, int(np.ceil((n + 1) * (1 - alpha))) - 1)   # finite-sample order statistic
        q_hat = float(np.sort(scores)[max(k, 0)])

        Xb = X_all[block_start:block_end]
        pred = np.column_stack([qs["lo"].predict(Xb), qs["mid"].predict(Xb),
                                qs["hi"].predict(Xb)])
        crossed = (pred[:, 0] > pred[:, 2]) | (pred[:, 1] < pred[:, 0]) | (pred[:, 1] > pred[:, 2])
        pred = np.sort(pred, axis=1)                              # enforce monotone quantiles

        for j, i in enumerate(range(block_start, block_end)):
            origin = float(data["origin_level"].to_numpy()[i])
            rows.append({
                "origin_date": data["obs_date"].to_numpy()[i],
                "target_date": data["target_date"].to_numpy()[i],
                "origin_level": origin,
                "actual_level": float(data["target_level"].to_numpy()[i]),
                "actual_logret": y_all[i],
                "p10_raw": pred[j, 0], "p50": pred[j, 1], "p90_raw": pred[j, 2],
                "p10_cal": min(pred[j, 0] - q_hat, pred[j, 1]),
                "p90_cal": max(pred[j, 2] + q_hat, pred[j, 1]),
                "q_hat": q_hat, "crossed_before_sort": bool(crossed[j]),
            })

    f = pd.DataFrame(rows)
    for col in ("p10_raw", "p50", "p90_raw", "p10_cal", "p90_cal"):
        f[col.replace("p", "lvl_p", 1) if col.startswith("p") else col] = \
            f["origin_level"] * np.exp(f[col])
    f["covered_raw"] = ((f["actual_logret"] >= f["p10_raw"])
                        & (f["actual_logret"] <= f["p90_raw"]))
    f["covered_cal"] = ((f["actual_logret"] >= f["p10_cal"])
                        & (f["actual_logret"] <= f["p90_cal"]))

    y = f["actual_logret"].to_numpy()
    pin = np.mean([_pinball(y, f["p10_cal"].to_numpy(), 0.10),
                   _pinball(y, f["p50"].to_numpy(), 0.50),
                   _pinball(y, f["p90_cal"].to_numpy(), 0.90)])
    width_lvl = (f["lvl_p90_cal"] - f["lvl_p10_cal"]).mean()

    return IntervalResult(
        frame=f,
        coverage=round(float(f["covered_cal"].mean() * 100), 2),
        mean_width=round(float(width_lvl), 2),
        pinball=round(float(pin), 6),
        crossing_rate=round(float(f["crossed_before_sort"].mean() * 100), 2),
        q_hat=round(float(f["q_hat"].mean()), 5),
    )
