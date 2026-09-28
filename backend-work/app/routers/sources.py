from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Berth, DataSource, Port, PortTariff, VesselClass
from app.schemas.responses import SourceOut

router = APIRouter(tags=["provenance"])


@router.get("/sources", response_model=list[SourceOut],
            summary="Live data-lineage registry")
def sources(rating: str | None = Query(None, pattern="^[GYOR]$"),
            db: Session = Depends(get_db)):
    stmt = select(DataSource).order_by(DataSource.availability_rating, DataSource.source_name)
    if rating:
        stmt = stmt.where(DataSource.availability_rating == rating)
    return db.execute(stmt).scalars().all()


@router.get("/sources/coverage", summary="Verification status of every constraint record")
def coverage(db: Session = Depends(get_db)):
    def tally(rows, attr="verification"):
        out: dict[str, int] = {}
        for r in rows:
            out[getattr(r, attr)] = out.get(getattr(r, attr), 0) + 1
        return out

    berths = db.execute(select(Berth)).scalars().all()
    return {
        "ports": tally(db.execute(select(Port)).scalars().all()),
        "berths": tally(berths),
        "tariffs": tally(db.execute(select(PortTariff)).scalars().all()),
        "vessel_classes": {"baltic_standard_description":
                           len(db.execute(select(VesselClass)).scalars().all())},
        "unverified_berths": [
            {"berth_id": b.berth_id, "port_id": b.port_id, "source_url": b.source_url}
            for b in berths if b.verification == "unverified"],
        "note": ("Every constraint carries source_url, retrieved_at and a verification state. "
                 "A change to a port's published limits is an INSERT with a new effective_from, "
                 "never an UPDATE, so past recommendations stay explainable."),
    }


@router.get("/sources/model-provenance", summary="ML Forecasting model lineage and artifact status")
def model_provenance():
    from app.services import forecast_v2_adapter
    st = forecast_v2_adapter.status()
    models_ok = st.get("models_available", False)
    return {
        "engine": {
            "name": "LightGBM v2 + Split-Conformal Quantiles" if models_ok else "Statistical Fallback Engine",
            "status": "active" if models_ok else ("unavailable" if st.get("reason") else "fallback"),
            "forecast_engine": st.get("forecast_engine", "unavailable"),
            "models_available": models_ok,
            "model_count": st.get("model_count", 0),
            "artifacts_present": st.get("artifacts_present", 0),
            "conformal_calibration": st.get("conformal_calibration", False),
            "training_cutoff": st.get("training_cutoff", "2019-07-31"),
            "data_provenance": st.get("data_provenance", "verified_real_mendeley_cc_by_4.0"),
            "artifact_root": st.get("artifact_root"),
            "reason": st.get("reason"),
        }
    }
