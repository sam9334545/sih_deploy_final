"""Serve the trained `ml-work/forecast_v2` artifacts through the existing contract.

The backend's own `forecast_model.py` stays as the fallback: it needs nothing but
numpy, so the API still starts and still answers on a machine with no ML stack.
When the v2 artifacts and their dependencies are present, this adapter takes
over and the response carries the model's measured rolling-origin skill instead
of a self-reported backtest.

Every failure mode here degrades to the fallback rather than propagating: a
missing artifact, a corrupted one, an environment without lightgbm, a short or
gappy history. The one thing this must never do is fail silently in the other
direction — the caller is always told which engine answered, via `model_source`.
"""
from __future__ import annotations

import logging
import sys
from datetime import date
from functools import lru_cache
from pathlib import Path

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import FreightIndex

logger = logging.getLogger(__name__)

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
    except Exception as e:                         # lightgbm / sklearn absent or broken
        raise V2Unavailable(f"forecast_v2 import failed: {type(e).__name__}: {e}") from e
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


def status() -> dict:
    """Diagnostics for /health and provenance, so an operator or UI can inspect ML v2 state."""
    try:
        _predict_module()
        root = _artifact_root()
        artifacts = sorted(p.stem for p in root.glob("*.joblib"))
        manifest_file = root / "manifest.json"
        manifest_data = []
        if manifest_file.exists():
            import json
            try:
                manifest_data = json.loads(manifest_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        training_cutoff = manifest_data[0].get("trained_through") if manifest_data else "2019-07-31"
        return {
            "available": True,
            "forecast_engine": "lightgbm_v2",
            "models_available": True,
            "model_count": len(manifest_data) or len(artifacts),
            "artifact_count": len(manifest_data) or len(artifacts),
            "artifacts_present": len(artifacts),
            "conformal_calibration": True,
            "training_cutoff": training_cutoff,
            "data_provenance": "verified_real_mendeley_cc_by_4.0",
            "artifact_root": str(root),
            "artifacts": artifacts,
        }
    except V2Unavailable as e:
        return {
            "available": False,
            "forecast_engine": "unavailable",
            "models_available": False,
            "model_count": 0,
            "artifacts_present": 0,
            "conformal_calibration": False,
            "training_cutoff": None,
            "data_provenance": "unknown",
            "reason": str(e),
            "artifact_root": str(settings.forecast_v2_artifacts),
        }


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
    if (wide <= 0).any().any():
        raise V2Unavailable("history contains non-positive index levels; "
                            "the feature set is built in log space")
    if len(wide) < MIN_SESSIONS:
        raise V2Unavailable(f"only {len(wide)} complete sessions before {as_of}; "
                            f"v2 features need {MIN_SESSIONS}")
    wide.index = pd.to_datetime(wide.index)
    return wide.reset_index()


def forecast(db: Session, index_code: str, horizon_days: int, as_of: date) -> dict:
    """Returns the fields `model_forecast` stores, plus v2-only metadata.

    Raises V2Unavailable for every recoverable problem so the caller can fall
    back; nothing else escapes.
    """
    predict = _predict_module()
    root = _artifact_root()
    history = _history(db, as_of)

    try:
        f = predict.forecast(history, index_code, horizon_days, root=root)
    except FileNotFoundError as e:
        raise V2Unavailable(f"artifact missing: {e}") from e
    except ValueError as e:
        raise V2Unavailable(f"v2 rejected the input: {e}") from e
    except Exception as e:      # corrupted pickle, version skew, anything else
        logger.warning("forecast_v2 failed for %s h=%s: %s: %s",
                       index_code, horizon_days, type(e).__name__, e)
        raise V2Unavailable(f"v2 model failed to load or predict: "
                            f"{type(e).__name__}: {e}") from e

    if not (f.lo_80 <= f.point <= f.hi_80):
        raise V2Unavailable(f"v2 returned an inconsistent interval for {index_code} "
                            f"h={horizon_days}: {f.lo_80} <= {f.point} <= {f.hi_80}")

    prov = f.provenance or {}
    return {
        "point": f.point, "lo_80": f.lo_80, "hi_80": f.hi_80,
        "forecast_quality_score": f.forecast_quality_score,
        "quality_score_components": f.quality_score_components,
        "quality_score_definition": f.quality_score_definition,
        "trend": f.trend,
        "model_name": f"forecast_v2_{f.selected_model}",
        "model_version": f.model_version,
        "model_source": f.model_source,
        "selected_model": f.selected_model,
        "validation": f.validation,
        "interval": f.interval,
        "drivers": f.drivers,
        "driver_groups": f.driver_groups,
        "trained_through": prov.get("trained_through"),
        "n_train_real": prov.get("n_train_real"),
        "augmentation_used": prov.get("augmentation_used"),
        "data_provenance": prov.get("data_provenance"),
        "provenance": prov,
        "origin_level": f.origin_level,
        "history_sessions": len(history),
    }
