"""Feature-level attribution for the forecast models.

Ensemble weights are not explanations. A weight of 0.7 on ridge says which model
was trusted, not which feature moved the forecast, and presenting one as the
other invites a decision-maker to read meaning that is not there.

What this module produces instead, per forecast:
  * LightGBM — exact TreeSHAP contributions via `pred_contrib=True`. This is
    LightGBM's own implementation of the same algorithm the `shap` package uses
    for tree models, so it needs no extra dependency and cannot drift from the
    booster that produced the prediction.
  * Ridge — the exact linear contribution, coef_j * (x_j - mean_j) / scale_j,
    which is the Shapley value for a linear model with independent features.
  * Damped momentum — the single feature it uses, by construction.
  * Ensemble — the blend weight times each member's contribution, which is exact
    because the ensemble is a linear combination of its members.

Every contribution is in log-return units and sums (with the base value) to the
model's prediction. That identity is asserted in the test suite: an attribution
that does not reconstruct the prediction is decoration.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from forecast_v2 import models as M

# Feature-name prefixes → the group a reader actually thinks in.
GROUPS: tuple[tuple[str, str], ...] = (
    ("logret_lag_", "lag"),
    ("mom_", "momentum"),
    ("ret1_ma_", "momentum"),
    ("dev_ma_", "rolling_trend"),
    ("slope_", "rolling_trend"),
    ("vol_ratio", "volatility"),
    ("vol_pctile_", "volatility"),
    ("vol_", "volatility"),
    ("drawdown_", "extremes"),
    ("runup_", "extremes"),
    ("range_pos_", "extremes"),
    ("spread_", "cross_index_spread"),
    ("breadth_", "market_breadth"),
    ("sin_", "calendar"),
    ("cos_", "calendar"),
    ("dow", "calendar"),
    ("month", "calendar"),
)
_CROSS_SUFFIXES = ("_ret_5", "_ret_21", "_vol_21")


def feature_group(name: str) -> str:
    for prefix, group in GROUPS:
        if name.startswith(prefix):
            return group
    if any(name.endswith(s) for s in _CROSS_SUFFIXES):
        return "cross_index_return"
    return "other"


@dataclass(slots=True)
class Attribution:
    feature: str
    group: str
    contribution: float          # log-return units, signed
    direction: str               # "up" | "down"
    value: float                 # the feature's value at this origin


def _ridge_contributions(model: M.RidgeModel, x: np.ndarray) -> np.ndarray:
    scaler = model.pipe_["sc"]
    ridge = model.pipe_["m"]
    z = (x - scaler.mean_) / scaler.scale_
    return ridge.coef_ * z


def _lgb_contributions(model: M.LgbModel, x: np.ndarray) -> tuple[np.ndarray, float]:
    """Exact TreeSHAP. The last column LightGBM returns is the base value."""
    contrib = model.m_.predict(x.reshape(1, -1), pred_contrib=True)[0]
    return np.asarray(contrib[:-1], dtype=float), float(contrib[-1])


def attribute(model, x: np.ndarray, feature_names: list[str]) -> tuple[list[Attribution], float]:
    """Per-feature contributions and the base value, for one origin."""
    x = np.asarray(x, dtype=float).ravel()
    contrib = np.zeros(len(feature_names))
    base = 0.0

    if isinstance(model, M.Ensemble):
        for member, w in zip(model.members, model.w_):
            if w == 0:
                continue
            sub, sub_base = attribute(member, x, feature_names)
            for a in sub:
                contrib[feature_names.index(a.feature)] += w * a.contribution
            base += w * sub_base
    elif isinstance(model, M.LgbModel):
        contrib, base = _lgb_contributions(model, x)
    elif isinstance(model, M.RidgeModel):
        contrib = _ridge_contributions(model, x)
        base = float(model.pipe_["m"].intercept_)
    elif isinstance(model, M.DampedMomentum):
        contrib[model.idx_] = model.phi_ * x[model.idx_]
    elif isinstance(model, M.DriftMean):
        base = model.mu_
    elif isinstance(model, M.NaiveFlat):
        base = 0.0
    else:                                                  # pragma: no cover
        raise TypeError(f"no attribution implemented for {type(model).__name__}")

    out = [
        Attribution(feature=n, group=feature_group(n), contribution=float(c),
                    direction="up" if c > 0 else "down", value=float(v))
        for n, c, v in zip(feature_names, contrib, x)
    ]
    return out, float(base)


def top_drivers(model, x: np.ndarray, feature_names: list[str], k: int = 6) -> list[dict]:
    attrs, _ = attribute(model, x, feature_names)
    ranked = sorted(attrs, key=lambda a: -abs(a.contribution))[:k]
    return [{"feature": a.feature, "group": a.group, "direction": a.direction,
             "contribution_logret": round(a.contribution, 6),
             "feature_value": round(a.value, 6)} for a in ranked]


def group_drivers(model, x: np.ndarray, feature_names: list[str]) -> list[dict]:
    """Contributions aggregated to the groups a reader thinks in."""
    attrs, _ = attribute(model, x, feature_names)
    totals: dict[str, float] = {}
    for a in attrs:
        totals[a.group] = totals.get(a.group, 0.0) + a.contribution
    ordered = sorted(totals.items(), key=lambda kv: -abs(kv[1]))
    return [{"group": g, "direction": "up" if v > 0 else "down",
             "contribution_logret": round(v, 6)} for g, v in ordered]


def reconstructs(model, x: np.ndarray, feature_names: list[str],
                 tol: float = 1e-6) -> bool:
    """Do the contributions plus the base value equal the model's prediction?"""
    attrs, base = attribute(model, x, feature_names)
    total = base + sum(a.contribution for a in attrs)
    pred = float(model.predict(np.asarray(x, dtype=float).reshape(1, -1))[0])
    return abs(total - pred) <= tol * max(1.0, abs(pred))
