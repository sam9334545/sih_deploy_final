"""Model ladder. Every model exposes fit(X, y) / predict(X) over *log returns*.

The rung above is only taken if it beats the rung below on rolling-origin MASE.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from sklearn.linear_model import Ridge, RidgeCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:                                   # pragma: no cover
    HAS_LGB = False


class BaseModel:
    name = "base"
    needs_features = True

    def fit(self, X: np.ndarray, y: np.ndarray, sample_weight=None, **kw) -> "BaseModel":
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        raise NotImplementedError


class NaiveFlat(BaseModel):
    """The forecast that says nothing changes. MASE is measured against this family."""
    name = "naive_flat"
    needs_features = False

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.zeros(len(X))


class DriftMean(BaseModel):
    """Unconditional mean h-step drift from the training window — the constant-drift rung."""
    name = "drift_mean"
    needs_features = False

    def fit(self, X, y, sample_weight=None, **kw):
        self.mu_ = float(np.average(y, weights=sample_weight))
        return self

    def predict(self, X):
        return np.full(len(X), self.mu_)


class DampedMomentum(BaseModel):
    """Damped continuation of recent momentum.

    An assessed index moves in runs, so the last 21 sessions of drift carry real
    information; the damping factor is fitted, not assumed.
    """
    name = "damped_momentum"

    def __init__(self, feature_names: list[str], source: str = "mom_21"):
        self.idx_ = feature_names.index(source)
        self.source = source

    def fit(self, X, y, sample_weight=None, **kw):
        x = X[:, self.idx_]
        w = np.ones_like(y) if sample_weight is None else np.asarray(sample_weight)
        denom = float(np.dot(w * x, x))
        self.phi_ = float(np.dot(w * x, y) / denom) if denom > 0 else 0.0
        return self

    def predict(self, X):
        return self.phi_ * X[:, self.idx_]


class RidgeModel(BaseModel):
    """Ridge on standardised stationary features, penalty chosen per fold.

    The penalty matters more than the feature list: with 74 collinear predictors
    and ~1,000 rows, a weak penalty reproduces the training window's drift. The
    alpha grid is deliberately wide and the top end is heavy.
    """
    name = "ridge"

    ALPHAS = (100.0, 300.0, 1000.0, 3000.0, 10000.0, 30000.0)

    def __init__(self, alpha: float | None = None):
        self.alpha = alpha

    def fit(self, X, y, X_val=None, y_val=None, sample_weight=None, **kw):
        # Alpha is chosen on the chronological validation tail, never by LOO/K-fold
        # CV: with overlapping targets and serial correlation, shuffled CV leaks the
        # neighbouring observation and picks an alpha two orders of magnitude too
        # small. (Measured: RidgeCV's GCV choice scored 62% WORSE than persistence
        # at h=7, while validation-chosen alpha scores ~10% better.)
        if self.alpha is not None:
            self.alpha_ = self.alpha
        elif X_val is not None and len(X_val) >= 30:
            best, self.alpha_ = np.inf, self.ALPHAS[1]
            for a in self.ALPHAS:
                pipe = Pipeline([("sc", StandardScaler()), ("m", Ridge(alpha=a))])
                pipe.fit(X, y, m__sample_weight=sample_weight)
                err = float(np.mean(np.abs(pipe.predict(X_val) - y_val)))
                if err < best:
                    best, self.alpha_ = err, a
        else:
            self.alpha_ = 1000.0
        self.pipe_ = Pipeline([("sc", StandardScaler()), ("m", Ridge(alpha=self.alpha_))])
        self.pipe_.fit(X, y, m__sample_weight=sample_weight)
        return self

    def predict(self, X):
        return self.pipe_.predict(X)


@dataclass
class LgbParams:
    n_estimators: int = 600
    learning_rate: float = 0.03
    num_leaves: int = 15
    max_depth: int = 4
    min_child_samples: int = 40
    subsample: float = 0.8
    subsample_freq: int = 1
    colsample_bytree: float = 0.6
    reg_alpha: float = 0.5
    reg_lambda: float = 5.0


class LgbModel(BaseModel):
    """Gradient boosting, regularised hard.

    With ~1,200 training origins and 74 correlated features, an unconstrained GBM
    memorises the training window — which is exactly what the previous benchmark
    showed (LightGBM scoring worse than persistence). Shallow trees, strong L2,
    feature subsampling and early stopping are what make it competitive.
    """
    name = "lightgbm"

    def __init__(self, params: LgbParams | None = None, objective: str = "regression",
                 alpha: float | None = None, seed: int = 0):
        self.p = params or LgbParams()
        self.objective = objective
        self.alpha = alpha
        self.seed = seed

    def fit(self, X, y, X_val=None, y_val=None, sample_weight=None, **kw):
        kwargs = dict(
            objective=self.objective, n_estimators=self.p.n_estimators,
            learning_rate=self.p.learning_rate, num_leaves=self.p.num_leaves,
            max_depth=self.p.max_depth, min_child_samples=self.p.min_child_samples,
            subsample=self.p.subsample, subsample_freq=self.p.subsample_freq,
            colsample_bytree=self.p.colsample_bytree, reg_alpha=self.p.reg_alpha,
            reg_lambda=self.p.reg_lambda, random_state=self.seed, n_jobs=2, verbose=-1,
        )
        if self.objective == "quantile":
            kwargs["alpha"] = self.alpha
        self.m_ = lgb.LGBMRegressor(**kwargs)
        if X_val is not None and len(X_val) > 30:
            self.m_.fit(X, y, sample_weight=sample_weight, eval_X=X_val, eval_y=y_val,
                        callbacks=[lgb.early_stopping(60, verbose=False)])
        else:
            self.m_.fit(X, y, sample_weight=sample_weight)
        return self

    def predict(self, X):
        return self.m_.predict(X)


class Ensemble(BaseModel):
    """Convex blend whose weights are fitted on a held-out slice of the training window.

    Blending a linear model with a tree model and a damped-momentum rule is the
    single most reliable way to gain skill here: the components fail on different
    days, so the average is steadier than any of them.
    """
    name = "ensemble"

    def __init__(self, members: list[BaseModel], ridge_floor: float = 0.0):
        self.members = members
        self.ridge_floor = ridge_floor

    def fit(self, X, y, X_val=None, y_val=None, sample_weight=None, **kw):
        if X_val is None or len(X_val) < 40:
            cut = int(len(X) * 0.85)
            X, X_val = X[:cut], X[cut:]
            y, y_val = y[:cut], y[cut:]
            if sample_weight is not None:
                sample_weight = sample_weight[:cut]
        preds = []
        for m in self.members:
            m.fit(X, y, X_val=X_val, y_val=y_val, sample_weight=sample_weight)
            preds.append(m.predict(X_val))
        P = np.column_stack(preds)

        # Non-negative weights on a simplex, by grid search over the error surface.
        # Closed-form least squares would happily put −0.7 on a member.
        best, best_w = np.inf, np.ones(P.shape[1]) / P.shape[1]
        for w in _simplex_grid(P.shape[1], step=0.1):
            err = float(np.mean(np.abs(P @ w - y_val)))
            if err < best:
                best, best_w = err, w
        self.w_ = best_w
        full_w = None
        if sample_weight is not None:
            full_w = np.concatenate([sample_weight, np.ones(len(X_val))])
        for m in self.members:                       # refit on everything we have
            m.fit(np.vstack([X, X_val]), np.concatenate([y, y_val]), sample_weight=full_w)
        return self

    def predict(self, X):
        return np.column_stack([m.predict(X) for m in self.members]) @ self.w_

    @property
    def weights(self) -> dict[str, float]:
        return {m.name: round(float(w), 3) for m, w in zip(self.members, self.w_)}


def _simplex_grid(k: int, step: float = 0.1):
    from itertools import product
    n = int(round(1 / step))
    for combo in product(range(n + 1), repeat=k - 1):
        s = sum(combo)
        if s <= n:
            yield np.array([*combo, n - s], dtype=float) / n
