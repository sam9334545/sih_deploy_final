from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import resolve_as_of
from app.errors import NotFound
from app.repositories import series as series_repo
from app.schemas.responses import MarketResponse
from app.services import forecast_service, idle_service
from app.services.constants import CLASS_INDEX, INDEX_CODES, VESSEL_CLASSES

router = APIRouter(tags=["market"])

COMMODITY_LABELS = {
    "COAL_AU_NEWC": "Australian thermal coal (Newcastle)",
    "COAL_ZA_RB": "South African thermal coal (Richards Bay)",
    "COAL_COKING_AU_PHCC": "Australian premium hard coking coal",
    "IRON_ORE_CFR62": "Iron ore 62% Fe CFR China",
    "BRENT": "Brent crude",
}


@router.get("/market", response_model=MarketResponse, summary="Market dashboard")
def market(request: Request, as_of=Query(None), db: Session = Depends(get_db)):
    as_of_d = resolve_as_of(as_of)

    indices = {}
    for code in INDEX_CODES:
        dates, values, tc, _ = series_repo.index_history(db, code, as_of_d, 800)
        if len(values) == 0:
            continue
        indices[code] = {
            "value": round(float(values[-1]), 2),
            "obs_date": dates[-1].isoformat(),
            "tc_avg_usd_day": (round(float(tc[-1]), 2) if len(tc) and tc[-1] == tc[-1] else None),
            "change_1d_pct": series_repo.pct_change(values, 1),
            "change_7d_pct": series_repo.pct_change(values, 5),
            "change_30d_pct": series_repo.pct_change(values, 21),
            "realised_vol_20d": round(series_repo.realised_vol(values), 4),
            "volatility_percentile": round(series_repo.vol_percentile(values), 3),
            "distance_from_52w_high_pct": round(
                float(values[-1] / values[-252:].max() - 1) * 100, 2) if len(values) > 252 else None,
        }

    bunker_date, bunker = series_repo.latest_value(db, "BUNKER_VLSFO_SG", as_of_d)
    _, bunker_hist = series_repo.series_history(db, "BUNKER_VLSFO_SG", as_of_d, 400)
    fx_date, fx = series_repo.latest_value(db, "USD_INR", as_of_d)

    commodities = {}
    for code, label in COMMODITY_LABELS.items():
        d, v = series_repo.latest_value(db, code, as_of_d)
        if v is None:
            continue
        _, hist = series_repo.series_history(db, code, as_of_d, 200)
        commodities[code] = {"label": label, "value": round(v, 2),
                             "obs_date": d.isoformat() if d else None,
                             "change_30d_pct": series_repo.pct_change(hist, 21)}

    availability = {}
    for cls in VESSEL_CLASSES:
        code = CLASS_INDEX[cls]
        _, values, _, _ = series_repo.index_history(db, code, as_of_d, 1200)
        if len(values) < 120:
            continue
        level_z = float((values[-1] - values[-500:].mean()) / (values[-500:].std() or 1))
        mom = float(values[-1] / values[-21] - 1)
        proxy = -(0.6 * level_z + 0.4 * np.clip(mom / 0.08, -3, 3))
        availability[cls] = {
            "signal": "TIGHT" if proxy < -0.43 else "LOOSE" if proxy > 0.43 else "NORMAL",
            "proxy_z": round(float(proxy), 2),
            "note": "Derived indicator from fleet and index signals — not a live position list",
        }

    generic = {}
    for cls in VESSEL_CLASSES:
        code = CLASS_INDEX[cls]
        _, values, _, _ = series_repo.index_history(db, code, as_of_d, 1200)
        if len(values) < 300:
            continue
        fc = forecast_service.get_or_build(db, code, 28, as_of_d)
        pctl = float((values[-756:] <= fc.point).mean()) if len(values) > 100 else 0.5
        generic[cls] = {
            "score": round(100 * (1 - pctl), 1),
            "forecast_28d": fc.point, "interval_80": [fc.lo_80, fc.hi_80],
            "trend": fc.trend, "confidence": fc.confidence,
            "note": ("Market-wide reading only: the decision-relative Charter Opportunity Score "
                     "needs a cargo, a deadline and ports — see POST /opportunity-score"),
        }

    return MarketResponse(
        as_of=as_of_d, indices=indices,
        bunker={"series": "BUNKER_VLSFO_SG", "value": round(bunker, 2) if bunker else None,
                "obs_date": bunker_date.isoformat() if bunker_date else None,
                "realised_vol_90d": round(series_repo.realised_vol(bunker_hist, 90), 4)
                if len(bunker_hist) > 95 else None},
        commodities=commodities,
        fx={"pair": "USD/INR", "rate": round(fx, 4) if fx else settings.fx_usd_inr,
            "obs_date": fx_date.isoformat() if fx_date else None},
        availability_signal=availability,
        charter_opportunity_score_generic=generic,
        provenance={"indices": "simulated_demo" if settings.demo_mode else "measured",
                    "commodities": "simulated_demo" if settings.demo_mode else "measured",
                    "forecast": "derived"},
        request_id=request.state.request_id)


@router.get("/market/low-demand", summary="Six-month demand-regime strip for a vessel class")
def low_demand(vessel_class: str = Query("Supramax"), months: int = Query(6, ge=1, le=12),
               as_of=Query(None), db: Session = Depends(get_db)):
    if vessel_class not in VESSEL_CLASSES:
        raise NotFound(f"Unknown vessel class '{vessel_class}'", field="vessel_class",
                       allowed=VESSEL_CLASSES)
    return idle_service.low_demand_strip(db, vessel_class, resolve_as_of(as_of), months)


@router.get("/market/ballast-matrix", summary="Ballast cost matrix and the premium owners price in")
def ballast_matrix(vessel_class: str = Query("Supramax"), from_port: str | None = None,
                   as_of=Query(None), db: Session = Depends(get_db)):
    if vessel_class not in VESSEL_CLASSES:
        raise NotFound(f"Unknown vessel class '{vessel_class}'", field="vessel_class",
                       allowed=VESSEL_CLASSES)
    try:
        return idle_service.ballast_matrix(db, vessel_class, resolve_as_of(as_of),
                                           from_port.upper() if from_port else None)
    except LookupError as e:
        raise NotFound(str(e)) from e


@router.get("/market/backhaul", summary="Backhaul insight for a lane")
def backhaul(origin_port: str, destination_port: str, vessel_class: str = "Supramax",
             as_of=Query(None), db: Session = Depends(get_db)):
    try:
        return idle_service.backhaul_insight(db, origin_port.upper(), destination_port.upper(),
                                             vessel_class, resolve_as_of(as_of))
    except LookupError as e:
        raise NotFound(str(e), field="route") from e
