"""Serving interface: history in, calibrated forecast with attribution out."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from forecast_v2 import explain
from forecast_v2.dataset import INDEX_COLS, FeatureSpec, build_features

ART = Path(__file__).resolve().parent.parent / "models" / "saved_models" / "v2"
CODE_TO_COL = {"BPI": "bpi_value", "BCI": "bci_value",
               "BSI": "bsi_value", "BHSI": "bhsi_value"}

QUALITY_SCORE_DEFINITION = (
    "forecast_quality_score is a 0-1 HEURISTIC describing how much weight this "
    "forecast deserves relative to others from the same system. It is NOT a "
    "probability, and it is NOT the chance the forecast is correct. It is the "
    "average of three measured quantities, each clipped to [0,1]: "
    "(a) band tightness, 1 - min(1, interval_width / origin_level / 0.8); "
    "(b) out-of-sample skill, min(1, max(0, skill_vs_naive_pct / 25)); "
    "(c) interval calibration, 1 - min(1, |empirical_coverage - 80| / 20). "
    "The probabilistic statement lives in the 80% interval, whose empirical "
    "coverage is reported alongside it."
)


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
    forecast_quality_score: float
    quality_score_components: dict
    quality_score_definition: str
    model_source: str
    selected_model: str
    model_version: str
    validation: dict
    interval: dict
    drivers: list[dict] = field(default_factory=list)
    driver_groups: list[dict] = field(default_factory=list)
    provenance: dict = field(default_factory=dict)


def _trend(point: float, origin: float) -> str:
    ch = point / origin - 1
    return "increasing" if ch > 0.02 else "decreasing" if ch < -0.02 else "stable"


def load(index_code: str, horizon: int, root: Path = ART) -> dict:
    path = Path(root) / f"{index_code.lower()}_h{horizon}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"No artifact for {index_code} h={horizon} at {path}")
    art = joblib.load(path)
    required = {"point", "quantiles", "q_hat", "features", "provenance"}
    missing = required - set(art)
    if missing:
        raise ValueError(f"artifact {path.name} is missing {sorted(missing)}; "
                         "retrain with forecast_v2/train_final.py")
    return art


def forecast(history: pd.DataFrame, index_code: str, horizon: int,
             root: Path = ART) -> Forecast:
    """`history` must hold obs_date plus the four index columns, oldest first."""
    missing = {"obs_date", *INDEX_COLS} - set(history.columns)
    if missing:
        raise ValueError(f"history is missing columns: {sorted(missing)}")
    code = index_code.upper()
    if code not in CODE_TO_COL:
        raise ValueError(f"unknown index {index_code}; expected one of "
                         f"{sorted(CODE_TO_COL)}")

    art = load(code, horizon, root)
    spec = FeatureSpec()
    if len(history) < spec.warmup + 5:
        raise ValueError(f"need at least {spec.warmup + 5} sessions of history, "
                         f"got {len(history)}")

    col = CODE_TO_COL[code]
    hist = history.sort_values("obs_date").reset_index(drop=True)
    feats = build_features(hist, col, spec)
    row = feats.iloc[[-1]]
    x = row[art["features"]].to_numpy(dtype=float)
    if not np.isfinite(x).all():
        bad = [f for f, v in zip(art["features"], x[0]) if not np.isfinite(v)]
        raise ValueError(f"latest feature row is non-finite for {bad[:5]}; "
                         "check the history for gaps or zero/negative levels")

    origin = float(hist[col].to_numpy()[-1])
    point_lr = float(art["point"].predict(x)[0])
    q = np.sort([art["quantiles"]["lo"].predict(x)[0],
                 art["quantiles"]["mid"].predict(x)[0],
                 art["quantiles"]["hi"].predict(x)[0]])
    # A negative q_hat is legitimate — the raw quantiles were too wide on the
    # calibration window and CQR tightens them — but it must never invert the band.
    lo_lr = min(q[0] - art["q_hat"], q[1])
    hi_lr = max(q[2] + art["q_hat"], q[1])
    # The served band must contain the served point. When the point head and the
    # quantile heads disagree, that disagreement is real extra uncertainty, so
    # widen past the point rather than pinning it to the edge.
    margin = 0.10 * max(hi_lr - lo_lr, 1e-4)
    lo_lr = min(lo_lr, point_lr - margin)
    hi_lr = max(hi_lr, point_lr + margin)

    p = art["provenance"]
    val, iv = p.get("validation", {}) or {}, p.get("interval", {}) or {}
    point_lv = origin * float(np.exp(point_lr))
    lo_lv, hi_lv = origin * float(np.exp(lo_lr)), origin * float(np.exp(hi_lr))

    tightness = 1.0 - min(1.0, ((hi_lv - lo_lv) / origin) / 0.8)
    skill = min(1.0, max(0.0, (val.get("skill_vs_naive_pct") or 0.0) / 25.0))
    cov = iv.get("empirical_coverage_pct")
    calib = 1.0 if cov is None else 1.0 - min(1.0, abs(cov - 80.0) / 20.0)
    quality = (tightness + skill + calib) / 3.0

    try:
        drivers = explain.top_drivers(art["point"], x[0], art["features"], k=6)
        groups = explain.group_drivers(art["point"], x[0], art["features"])
    except Exception as e:                       # attribution must never break serving
        drivers, groups = [], [{"group": "unavailable", "direction": "up",
                                "contribution_logret": 0.0, "error": str(e)}]

    return Forecast(
        index_code=code, horizon_days=horizon,
        as_of=str(pd.Timestamp(hist["obs_date"].max()).date()),
        origin_level=round(origin, 2),
        point=round(point_lv, 2), lo_80=round(lo_lv, 2), hi_80=round(hi_lv, 2),
        point_logret=round(point_lr, 5), trend=_trend(point_lv, origin),
        forecast_quality_score=round(float(quality), 3),
        quality_score_components={"band_tightness": round(tightness, 3),
                                  "out_of_sample_skill": round(skill, 3),
                                  "interval_calibration": round(calib, 3)},
        quality_score_definition=QUALITY_SCORE_DEFINITION,
        model_source="forecast_v2", selected_model=p.get("selected_model", "unknown"),
        model_version=p.get("model_version", "v2"),
        validation=val, interval=iv, drivers=drivers, driver_groups=groups,
        provenance={k: p.get(k) for k in (
            "trained_at", "trained_through", "dataset_sha256", "feature_spec_sha256",
            "artifact_sha256", "git_commit", "git_dirty", "environment",
            "n_train_real", "n_calibration", "augmentation_used", "data_provenance",
            "selection_rule", "feature_count", "dataset_rows")},
    )


def to_dict(f: Forecast) -> dict:
    return asdict(f)
