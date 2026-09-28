from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Berth, Compatibility, FreightIndex, ModelForecast, Port, PortCall
from app.services import forecast_v2_adapter

router = APIRouter(tags=["meta"])


@router.get("/health", summary="Liveness, data-freshness, and ML engine health check")
def health(db: Session = Depends(get_db)):
    def count(model):
        return db.execute(select(func.count()).select_from(model)).scalar_one()

    latest = db.execute(select(func.max(FreightIndex.obs_date))).scalar_one()
    as_of = settings.demo_as_of if settings.demo_mode else date.today()
    age = (as_of - latest).days if latest else None
    
    v2_stat = forecast_v2_adapter.status()
    is_healthy = bool(latest and age is not None and age <= settings.stale_data_days)
    if settings.require_v2_forecast and not v2_stat.get("models_available"):
        is_healthy = False

    payload = {
        "status": "ok" if is_healthy else "degraded",
        "as_of": as_of.isoformat(),
        "latest_index_obs": latest.isoformat() if latest else None,
        "index_age_days": age,
        "demo_mode": settings.demo_mode,
        "forecast_engine": v2_stat.get("forecast_engine", "unavailable"),
        "models_available": v2_stat.get("models_available", False),
        "model_count": v2_stat.get("model_count", 0),
        "conformal_calibration": v2_stat.get("conformal_calibration", False),
        "training_cutoff": v2_stat.get("training_cutoff"),
        "ml_v2_diagnostics": v2_stat,
        "counts": {
            "ports": count(Port),
            "berths": count(Berth),
            "freight_index_rows": count(FreightIndex),
            "port_calls": count(PortCall),
            "compatibility_rows": count(Compatibility),
            "cached_forecasts": count(ModelForecast),
        },
    }
    status_code = 200 if is_healthy else 503
    return JSONResponse(status_code=status_code, content=payload)


@router.get("/health/ready", summary="Readiness probe for container orchestration")
def readiness(db: Session = Depends(get_db)):
    def count(model):
        return db.execute(select(func.count()).select_from(model)).scalar_one()

    ports_count = count(Port)
    if ports_count == 0:
        return JSONResponse(status_code=503, content={"status": "not_ready", "ready": False, "reason": "database not seeded with reference ports"})
    
    v2_stat = forecast_v2_adapter.status()
    if settings.require_v2_forecast and not v2_stat.get("models_available"):
        return JSONResponse(status_code=503, content={"status": "not_ready", "ready": False, "reason": "authoritative LightGBM v2 models required but unavailable"})

    return {
        "status": "ready",
        "ready": True,
        "ports": ports_count,
        "forecast_engine": v2_stat.get("forecast_engine"),
        "models_available": v2_stat.get("models_available"),
    }


@router.get("/health/live", summary="Liveness probe")
def liveness():
    return {"status": "alive", "live": True}
