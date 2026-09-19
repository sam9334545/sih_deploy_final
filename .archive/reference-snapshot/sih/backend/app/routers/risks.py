from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_port, require_vessel_class, resolve_as_of
from app.schemas.responses import RiskResponse
from app.services import risk_engine

router = APIRouter(tags=["risk"])


@router.get("/risks", response_model=RiskResponse, summary="Explainable risk assessment")
def risks(request: Request,
          port_id: str = Query(..., description="Discharge port"),
          vessel_class: str = Query("Supramax"),
          month: int | None = Query(None, ge=1, le=12),
          as_of=Query(None),
          db: Session = Depends(get_db)):
    as_of_d = resolve_as_of(as_of)
    port = require_port(db, port_id)
    require_vessel_class(vessel_class)
    assessment = risk_engine.assess(db, port_id=port.port_id, vessel_class=vessel_class,
                                    month=month or as_of_d.month, as_of=as_of_d)
    return RiskResponse(
        overall=assessment.overall, overall_raw=assessment.overall_raw,
        components=[{"name": c.name, "level": c.level, "score": c.score, "signal_z": c.signal,
                     "detail": c.detail, "weight": c.weight,
                     "contribution_pct": c.contribution_pct} for c in assessment.components],
        main_driver=assessment.main_driver,
        what_would_change=assessment.what_would_change,
        alerts=assessment.alerts,
        weights_method=assessment.weights_method,
        as_of=as_of_d, request_id=request.state.request_id)
