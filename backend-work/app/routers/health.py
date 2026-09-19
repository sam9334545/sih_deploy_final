from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import Berth, Compatibility, FreightIndex, ModelForecast, Port, PortCall

router = APIRouter(tags=["meta"])


@router.get("/health", summary="Liveness and data-freshness check")
def health(db: Session = Depends(get_db)):
    def count(model):
        return db.execute(select(func.count()).select_from(model)).scalar_one()

    latest = db.execute(select(func.max(FreightIndex.obs_date))).scalar_one()
    as_of = settings.demo_as_of if settings.demo_mode else date.today()
    age = (as_of - latest).days if latest else None
    return {
        "status": "ok" if latest and age is not None and age <= settings.stale_data_days
                  else "degraded",
        "as_of": as_of.isoformat(),
        "latest_index_obs": latest.isoformat() if latest else None,
        "index_age_days": age,
        "demo_mode": settings.demo_mode,
        "counts": {"ports": count(Port), "berths": count(Berth),
                   "freight_index_rows": count(FreightIndex), "port_calls": count(PortCall),
                   "compatibility_rows": count(Compatibility),
                   "cached_forecasts": count(ModelForecast)},
    }
