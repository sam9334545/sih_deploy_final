"""Forecast orchestration: train/cache into `model_forecast`, serve from it."""
from __future__ import annotations

import json
import logging
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ModelForecast
from app.repositories import series as series_repo
from app.services import forecast_model, forecast_v2_adapter
from app.services.constants import CLASS_INDEX, HORIZONS

logger = logging.getLogger(__name__)

MODEL_VERSION = "v1"          # built-in numpy fallback
V2_VERSION = "v2"             # trained ml-work/forecast_v2 ensemble


class NoModelError(Exception):
    pass


class StaleDataError(Exception):
    def __init__(self, as_of: date, age_days: int):
        self.as_of, self.age_days = as_of, age_days
        super().__init__(f"Latest index data is {age_days} days old")


def index_for_class(vessel_class: str) -> str:
    return CLASS_INDEX[vessel_class]


def get_or_build(db: Session, index_code: str, horizon_days: int, as_of: date,
                 refresh: bool = False) -> ModelForecast:
    if horizon_days not in HORIZONS:
        raise NoModelError(f"No trained model for horizon {horizon_days}")

    if not refresh:
        # Prefer a cached v2 row; the fallback's row only wins if v2 never ran.
        for version in (V2_VERSION, MODEL_VERSION):
            cached = db.execute(
                select(ModelForecast).where(
                    ModelForecast.as_of == as_of,
                    ModelForecast.index_code == index_code,
                    ModelForecast.horizon_days == horizon_days,
                    ModelForecast.model_version == version,
                )
            ).scalars().first()
            if cached:
                return cached

    if settings.forecast_v2_enabled:
        try:
            return _build_v2(db, index_code, horizon_days, as_of)
        except forecast_v2_adapter.V2Unavailable as e:
            # Not an error: the service is designed to run without the ML stack.
            logger.info("forecast_v2 unavailable for %s h=%s (%s); using built-in model",
                        index_code, horizon_days, e)

    dates, values, _tc, t = series_repo.index_history(db, index_code, as_of)
    if len(values) < 300:
        raise NoModelError(f"Insufficient history for {index_code} (have {len(values)} points)")

    f = forecast_model.forecast(values, t, horizon_days)
    row = ModelForecast(
        as_of=as_of, index_code=index_code, horizon_days=horizon_days,
        point=f.point, lo_80=f.lo_80, hi_80=f.hi_80, confidence=f.confidence, trend=f.trend,
        model_name=f.model_name, model_version=MODEL_VERSION,
        validation_mase=f.backtest.mase, interval_coverage_80=f.backtest.coverage_80,
        trained_on=dates[-1], drivers_json=json.dumps(f.drivers),
        created_at=datetime.now(UTC),
    )
    return _replace(db, row, MODEL_VERSION)


def _build_v2(db: Session, index_code: str, horizon_days: int,
              as_of: date) -> ModelForecast:
    out = forecast_v2_adapter.forecast(db, index_code, horizon_days, as_of)
    drivers = [
        {"feature": f"ensemble_weight_{k}", "direction": "up", "contribution_log": v}
        for k, v in (out["weights"] or {}).items() if v
    ]
    row = ModelForecast(
        as_of=as_of, index_code=index_code, horizon_days=horizon_days,
        point=out["point"], lo_80=out["lo_80"], hi_80=out["hi_80"],
        confidence=out["confidence"], trend=out["trend"],
        model_name=out["model_name"], model_version=V2_VERSION,
        validation_mase=out["validation_mase"],
        interval_coverage_80=None,      # measured per horizon in the v2 interval report
        # The artifact's real training cutoff, not today: quoting `as_of` here would
        # imply the model has seen data it has never seen.
        trained_on=(date.fromisoformat(out["trained_through"])
                    if out.get("trained_through") else None),
        drivers_json=json.dumps(drivers),
        created_at=datetime.now(UTC),
    )
    return _replace(db, row, V2_VERSION)


def _replace(db: Session, row: ModelForecast, version: str) -> ModelForecast:
    existing = db.execute(
        select(ModelForecast).where(
            ModelForecast.as_of == row.as_of, ModelForecast.index_code == row.index_code,
            ModelForecast.horizon_days == row.horizon_days,
            ModelForecast.model_version == version)
    ).scalars().first()
    if existing:
        db.delete(existing)
        db.flush()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def check_freshness(db: Session, index_code: str, as_of: date, max_age_days: int) -> None:
    latest = series_repo.latest_index(db, index_code, as_of)
    if latest is None:
        raise NoModelError(f"No index data for {index_code}")
    age = (as_of - latest.obs_date).days
    if age > max_age_days:
        raise StaleDataError(latest.obs_date, age)


def tc_from_index(db: Session, index_code: str, index_value: float, as_of: date) -> float:
    """Map an index level to class TC average $/day using the observed local ratio."""
    dates, values, tc, _ = series_repo.index_history(db, index_code, as_of, lookback_days=400)
    pairs = [(v, c) for v, c in zip(values, tc) if c == c and v > 0]
    if not pairs:
        return 0.0
    ratio = sum(c / v for v, c in pairs[-60:]) / len(pairs[-60:])
    return round(index_value * ratio, 2)


def history_points(db: Session, index_code: str, as_of: date, days: int = 180) -> list[dict]:
    dates, values, _tc, _t = series_repo.index_history(db, index_code, as_of, lookback_days=days)
    return [{"date": d.isoformat(), "value": round(float(v), 2)}
            for d, v in zip(dates, values)]


def forecast_path(db: Session, index_code: str, as_of: date,
                  horizons: list[int] | None = None) -> list[ModelForecast]:
    return [get_or_build(db, index_code, h, as_of) for h in (horizons or HORIZONS)]
