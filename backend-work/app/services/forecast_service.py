"""Forecast orchestration: train/cache into `model_forecast`, serve from it."""
from __future__ import annotations

import json
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ModelForecast
from app.repositories import series as series_repo
from app.services import forecast_model
from app.services.constants import CLASS_INDEX, HORIZONS

MODEL_VERSION = "v1"


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
        cached = db.execute(
            select(ModelForecast).where(
                ModelForecast.as_of == as_of,
                ModelForecast.index_code == index_code,
                ModelForecast.horizon_days == horizon_days,
                ModelForecast.model_version == MODEL_VERSION,
            )
        ).scalars().first()
        if cached:
            return cached

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
    existing = db.execute(
        select(ModelForecast).where(
            ModelForecast.as_of == as_of, ModelForecast.index_code == index_code,
            ModelForecast.horizon_days == horizon_days,
            ModelForecast.model_version == MODEL_VERSION)
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
