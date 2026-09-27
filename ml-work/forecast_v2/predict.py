"""Serving interface: load an artifact, build features from recent history, forecast.

Returns the same shape the backend's /api/v1/forecast contract expects, including
the calibrated 80% band and the provenance of the data behind it.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from forecast_v2.dataset import INDEX_COLS, FeatureSpec, build_features

ART = Path(__file__).resolve().parent.parent / "models" / "saved_models" / "v2"
CODE_TO_COL = {"BPI": "bpi_value", "BCI": "bci_value",
               "BSI": "bsi_value", "BHSI": "bhsi_value"}


@dataclass
class Forecast:
    index_code: str
    horizon_days: int
    as_of: str
    origin_level: float
    point: float
    lo_80: float
    hi_80: float
    point_logret: float
    trend: str
    confidence: float
    model: str
    weights: dict
    validation_mase: float | None
    skill_vs_naive_pct: float | None
    provenance: str
    augmented: bool


def _trend(point: float, origin: float) -> str:
    ch = point / origin - 1
    return "increasing" if ch > 0.02 else "decreasing" if ch < -0.02 else "stable"


def load(index_code: str, horizon: int, root: Path = ART) -> dict:
    path = root / f"{index_code.lower()}_h{horizon}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"No artifact for {index_code} h={horizon} at {path}")
    return joblib.load(path)


def forecast(history: pd.DataFrame, index_code: str, horizon: int,
             root: Path = ART) -> Forecast:
    """`history` must hold obs_date plus the four index columns, oldest first."""
    missing = {"obs_date", *INDEX_COLS} - set(history.columns)
    if missing:
        raise ValueError(f"history is missing columns: {sorted(missing)}")

    art = load(index_code, horizon, root)
    spec = FeatureSpec()
    if len(history) < spec.warmup + 5:
        raise ValueError(f"need at least {spec.warmup + 5} sessions of history, "
                         f"got {len(history)}")

    col = CODE_TO_COL[index_code.upper()]
    feats = build_features(history.sort_values("obs_date").reset_index(drop=True), col, spec)
    x = feats.iloc[[-1]][art["features"]].to_numpy(dtype=float)
    if not np.isfinite(x).all():
        raise ValueError("latest feature row contains non-finite values; "
                         "check the history for gaps")

    origin = float(history[col].to_numpy()[-1])
    point_lr = float(art["point"].predict(x)[0])
    q = np.sort([art["quantiles"]["lo"].predict(x)[0],
                 art["quantiles"]["mid"].predict(x)[0],
                 art["quantiles"]["hi"].predict(x)[0]])
    # A negative q_hat is legitimate — it means the raw quantiles were too wide on
    # the calibration window and CQR is tightening them — but it must never invert
    # the band, so the median is kept strictly inside.
    lo_lr = min(q[0] - art["q_hat"], q[1])
    hi_lr = max(q[2] + art["q_hat"], q[1])

    point_lv = origin * float(np.exp(point_lr))
    # The served band must contain the served point, or the card contradicts itself.
    lo_lr = min(lo_lr, point_lr)
    hi_lr = max(hi_lr, point_lr)

    meta = art["meta"]
    score = meta.get("rolling_origin_score") or {}
    width = (np.exp(hi_lr) - np.exp(lo_lr))
    skill = score.get("skill_vs_naive_pct")
    # Confidence blends band tightness with measured out-of-sample skill, so a
    # wide band on a horizon we forecast badly cannot read as confident.
    conf = 0.6 * max(0.0, 1 - min(1.0, width / 0.8)) + \
        0.4 * max(0.0, min(1.0, (skill or 0) / 20))

    return Forecast(
        index_code=index_code.upper(), horizon_days=horizon,
        as_of=str(pd.Timestamp(history["obs_date"].max()).date()),
        origin_level=round(origin, 2),
        point=round(origin * float(np.exp(point_lr)), 2),
        lo_80=round(origin * float(np.exp(lo_lr)), 2),
        hi_80=round(origin * float(np.exp(hi_lr)), 2),
        point_logret=round(point_lr, 5),
        trend=_trend(origin * float(np.exp(point_lr)), origin),
        confidence=round(float(conf), 3),
        model=meta["model"], weights=meta["weights"],
        validation_mase=score.get("mase"), skill_vs_naive_pct=skill,
        provenance=meta["data_provenance"], augmented=meta["augmented"],
    )


def to_dict(f: Forecast) -> dict:
    return asdict(f)
