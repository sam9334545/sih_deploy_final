"""Serve the trained `ml-work/forecast_v2` artifacts through the existing contract.

The backend's own `forecast_model.py` stays as the fallback: it needs nothing but
numpy, so the API still starts on a machine with no ML stack and still answers
every request. When the v2 artifacts and their dependencies are present, this
adapter takes over and the response carries the measured rolling-origin skill of
the model that produced it instead of a self-reported backtest.

Two hard requirements the fallback does not have:
  * the four indices must all be present in `fact_freight_index`, because the v2
    feature set reads cross-index spreads;
  * at least ~260 sessions of history before `as_of`, for the 252-session
    extreme-window features.
Either one missing means we fall back rather than guess.
"""
from __future__ import annotations

import sys
from datetime import date
from functools import lru_cache
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import FreightIndex

V2_INDEX_COLS = {"BPI": "bpi_value", "BCI": "bci_value",
                 "BSI": "bsi_value", "BHSI": "bhsi_value"}
MIN_SESSIONS = 300


class V2Unavailable(RuntimeError):
    """Raised when the v2 stack cannot serve this request; callers fall back."""


@lru_cache(maxsize=1)
def _predict_module():
    root = Path(settings.forecast_v2_root).expanduser()
    if not (root / "forecast_v2" / "predict.py").exists():
        raise V2Unavailable(f"forecast_v2 package not found under {root}")
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    try:
        from forecast_v2 import predict            # noqa: PLC0415
    except ImportError as e:                       # lightgbm / sklearn absent
        raise V2Unavailable(f"forecast_v2 dependencies missing: {e}") from e
    return predict


@lru_cache(maxsize=1)
def _artifact_root() -> Path:
    root = Path(settings.forecast_v2_artifacts).expanduser()
    if not root.exists():
        raise V2Unavailable(f"no v2 artifacts at {root}")
    return root


def available() -> bool:
    try:
        _predict_module()
        _artifact_root()
        return True
    except V2Unavailable:
        return False


def _history(db: Session, as_of: date) -> pd.DataFrame:
    rows = db.execute(
        select(FreightIndex.obs_date, FreightIndex.index_code, FreightIndex.value)
        .where(FreightIndex.obs_date <= as_of,
               FreightIndex.index_code.in_(list(V2_INDEX_COLS)))
        .order_by(FreightIndex.obs_date)
    ).all()
    if not rows:
        raise V2Unavailable("no freight index history in the database")

    wide = (pd.DataFrame(rows, columns=["obs_date", "index_code", "value"])
            .pivot(index="obs_date", columns="index_code", values="value")
            .rename(columns=V2_INDEX_COLS)
            .sort_index())
    missing = set(V2_INDEX_COLS.values()) - set(wide.columns)
    if missing:
        raise V2Unavailable(f"missing indices for cross-index features: {sorted(missing)}")

    wide = wide.dropna()
    if len(wide) < MIN_SESSIONS:
        raise V2Unavailable(f"only {len(wide)} complete sessions before {as_of}; "
                            f"v2 features need {MIN_SESSIONS}")
    wide.index = pd.to_datetime(wide.index)
    return wide.reset_index()


def forecast(db: Session, index_code: str, horizon_days: int, as_of: date) -> dict:
    """Returns the fields `model_forecast` stores, plus v2-only metadata."""
    predict = _predict_module()
    root = _artifact_root()
    history = _history(db, as_of)

    try:
        f = predict.forecast(history, index_code, horizon_days, root=root)
    except FileNotFoundError as e:
        raise V2Unavailable(str(e)) from e
    except ValueError as e:
        raise V2Unavailable(f"v2 could not build features: {e}") from e

    meta = predict.load(index_code, horizon_days, root)["meta"]
    return {
        "trained_through": meta.get("trained_on"),
        "n_train_real": meta.get("n_train_real"),
        "point": f.point, "lo_80": f.lo_80, "hi_80": f.hi_80,
        "confidence": f.confidence, "trend": f.trend,
        "model_name": "forecast_v2_ensemble", "model_version": "v2",
        "validation_mase": f.validation_mase,
        "skill_vs_naive_pct": f.skill_vs_naive_pct,
        "weights": f.weights,
        "data_provenance": f.provenance,
        "augmented": f.augmented,
        "origin_level": f.origin_level,
        "history_sessions": len(history),
    }
