"""Rolling-origin evaluation.

A single train/val/test cut on 1,749 sessions gives ~250 test origins inside one
market regime, and the previous benchmark's conclusions flipped between horizons
because of it. This harness instead refits on an expanding window and scores every
origin in the evaluation span, so a model has to be right across regimes, not lucky
in one.

Overlapping targets: at h=28 consecutive origins share 27 of 28 days, so the
effective sample is far smaller than the origin count. Metrics stay honest, but
significance is judged with a block bootstrap, never a naive t-test.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


@dataclass
class FoldPrediction:
    origin_date: pd.Timestamp
    target_date: pd.Timestamp
    origin_level: float
    actual_level: float
    pred_logret: float

    @property
    def pred_level(self) -> float:
        return self.origin_level * np.exp(self.pred_logret)


@dataclass
class EvalResult:
    model: str
    target: str
    horizon: int
    frame: pd.DataFrame
    metrics: dict[str, float] = field(default_factory=dict)
    extra: dict = field(default_factory=dict)


def walk_forward(
    data: pd.DataFrame, feature_cols: list[str], make_model, *,
    min_train: int = 500, step: int = 21, val_frac: float = 0.15,
    start_date: str | None = None, augment: tuple[np.ndarray, np.ndarray] | None = None,
    augment_weight: float = 0.3, augment_ratio: float = 3.0,
) -> pd.DataFrame:
    """Expanding-window predictions for every origin at or after `min_train`.

    `augment` is an optional (X, y) block of synthetic rows prepended to each
    training window. Synthetic rows are capped at `augment_ratio` times the real
    row count and carry `augment_weight`, so they inform the fit without
    outvoting the real market. They never enter validation or scoring.
    """
    X_all = data[feature_cols].to_numpy(dtype=float)
    y_all = data["target_logret"].to_numpy(dtype=float)
    dates = data["obs_date"].to_numpy()

    first = min_train
    if start_date is not None:
        mask = data["obs_date"] >= pd.Timestamp(start_date)
        if mask.any():
            first = max(min_train, int(np.argmax(mask.to_numpy())))

    rows = []
    for block_start in range(first, len(data), step):
        block_end = min(block_start + step, len(data))
        tr_X, tr_y = X_all[:block_start], y_all[:block_start]

        n_val = max(30, int(len(tr_X) * val_frac))
        fit_X, fit_y = tr_X[:-n_val], tr_y[:-n_val]
        val_X, val_y = tr_X[-n_val:], tr_y[-n_val:]
        weights = None
        if augment is not None:
            aug_X, aug_y = augment
            cap = int(len(fit_X) * augment_ratio)
            if len(aug_X) > cap:
                sel = np.linspace(0, len(aug_X) - 1, cap).astype(int)
                aug_X, aug_y = aug_X[sel], aug_y[sel]
            weights = np.concatenate([np.full(len(aug_X), augment_weight),
                                      np.ones(len(fit_X))])
            fit_X = np.vstack([aug_X, fit_X])
            fit_y = np.concatenate([aug_y, fit_y])

        model = make_model()
        model.fit(fit_X, fit_y, X_val=val_X, y_val=val_y, sample_weight=weights)
        preds = model.predict(X_all[block_start:block_end])

        for i, p in zip(range(block_start, block_end), preds):
            rows.append({
                "origin_date": dates[i], "target_date": data["target_date"].to_numpy()[i],
                "origin_level": data["origin_level"].to_numpy()[i],
                "actual_level": data["target_level"].to_numpy()[i],
                "actual_logret": y_all[i], "pred_logret": float(p),
            })

    out = pd.DataFrame(rows)
    out["pred_level"] = out["origin_level"] * np.exp(out["pred_logret"])
    return out


def scale_denominator(data: pd.DataFrame, upto_index: int) -> float:
    """MASE denominator: in-sample mean absolute 1-session change of the level."""
    lv = data["origin_level"].to_numpy(dtype=float)[:upto_index]
    return float(np.mean(np.abs(np.diff(lv)))) if len(lv) > 2 else 1.0


def metrics(pred: pd.DataFrame, denom: float) -> dict[str, float]:
    err = pred["pred_level"] - pred["actual_level"]
    ae = np.abs(err)
    act_dir = np.sign(pred["actual_level"] - pred["origin_level"])
    pred_dir = np.sign(pred["pred_level"] - pred["origin_level"])
    moved = act_dir != 0
    return {
        "mae": round(float(ae.mean()), 4),
        "rmse": round(float(np.sqrt((err ** 2).mean())), 4),
        "mape": round(float((ae / pred["actual_level"]).mean() * 100), 4),
        "mase": round(float(ae.mean() / denom), 4),
        "directional_accuracy": round(float((act_dir[moved] == pred_dir[moved]).mean() * 100), 2),
        "n": int(len(pred)),
    }


def skill_vs(pred: pd.DataFrame, baseline: pd.DataFrame) -> float:
    """Percent reduction in MAE against a baseline scored on identical origins."""
    a = np.abs(pred["pred_level"] - pred["actual_level"]).to_numpy()
    b = np.abs(baseline["pred_level"] - baseline["actual_level"]).to_numpy()
    n = min(len(a), len(b))
    return round(float((1 - a[:n].mean() / b[:n].mean()) * 100), 2)


def block_bootstrap_pvalue(pred: pd.DataFrame, baseline: pd.DataFrame, horizon: int,
                           n_boot: int = 2000, seed: int = 7) -> float:
    """Is the MAE gain real, given that neighbouring targets overlap?

    Moving-block bootstrap on the paired absolute-error difference, block length
    set to the horizon so one block spans one independent target window.
    """
    a = np.abs(pred["pred_level"].to_numpy() - pred["actual_level"].to_numpy())
    b = np.abs(baseline["pred_level"].to_numpy() - baseline["actual_level"].to_numpy())
    n = min(len(a), len(b))
    d = b[:n] - a[:n]                       # positive = model better
    if n < horizon * 3:
        return float("nan")
    rng = np.random.default_rng(seed)
    L = max(2, horizon)
    n_blocks = int(np.ceil(n / L))
    starts_pool = np.arange(0, n - L + 1)
    means = np.empty(n_boot)
    for i in range(n_boot):
        starts = rng.choice(starts_pool, size=n_blocks, replace=True)
        sample = np.concatenate([d[s:s + L] for s in starts])[:n]
        means[i] = sample.mean()
    return round(float((means <= 0).mean()), 4)
