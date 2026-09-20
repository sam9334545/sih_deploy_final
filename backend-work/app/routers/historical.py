"""
Historical Backtest & Route-Aware Forecasting Router for SIH26006.
Exposes real ML inference from Phase 5 Quantile LightGBM models,
conformal calibration, verified historical backtest actuals,
route-specific voyage economics, and optimizer payloads.

STRICT INTEGRITY:
  - Data mode: HISTORICAL_DEVELOPMENT (Coverage: 2012-08-01 -> 2019-07-31).
  - Post-2020 target data status: NOT_AVAILABLE.
  - Zero synthetic market observations.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

# Ensure ml-work is on Python path
ML_WORK_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml-work"
if str(ML_WORK_DIR) not in sys.path:
    sys.path.insert(0, str(ML_WORK_DIR))

from models.inference import MLInferenceService, HistoricalForecastResult
from route.vessel_mapping import VESSEL_INDEX_MAP, INDEX_VESSEL_MAP, get_index_for_vessel
from route.route_config import SUPPORTED_ROUTES, get_route, list_supported_routes
from route.forecast_object import MarketForecast, VALID_HORIZONS
from route.bunker_interface import DemoBunkerDataProvider
from route.charter_estimator import estimate_route_charter, RouteCharterEstimate
from route.optimizer_adapter import adapt_charter_estimate_for_optimizer

router = APIRouter(prefix="/historical", tags=["historical-backtest"])

# Initialize ML inference service singleton
_inference_service: Optional[MLInferenceService] = None

def get_ml_service() -> MLInferenceService:
    global _inference_service
    if _inference_service is None:
        _inference_service = MLInferenceService()
    return _inference_service


class HistoricalForecastRequest(BaseModel):
    target: str = Field(..., description="Baltic sub-index code (BCI, BPI, BSI, BHSI)")
    origin_date: str = Field(..., description="Forecast origin date YYYY-MM-DD (<= 2019-07-31)")
    horizon_sessions: int = Field(28, description="Trading-session horizon (7, 14, 28, 60, 90, 180)")
    vessel_type: Optional[str] = Field(None, description="Optional vessel class (e.g. Panamax)")


class RouteEstimateRequest(BaseModel):
    target: str = Field(..., description="Baltic sub-index code (BCI, BPI, BSI, BHSI)")
    origin_date: str = Field(..., description="Forecast origin date YYYY-MM-DD (<= 2019-07-31)")
    horizon_sessions: int = Field(28, description="Trading-session horizon (7, 14, 28, 60, 90, 180)")
    route_id: str = Field(..., description="Verified route identifier (e.g. AUHPT-INPRT)")
    cargo_type: str = Field("coking_coal", description="Cargo commodity type")
    desired_cargo_tonnes: Optional[float] = Field(None, description="Optional payload lift request")
    risk_aversion: float = Field(0.50, ge=0.0, le=1.0, description="Risk aversion lambda in [0, 1]")
    bunker_location: str = Field("Singapore", description="Bunkering port")


@router.get("/dates", summary="Get all valid historical forecast origin dates")
def get_available_dates():
    """Returns all trading sessions in the verified 2012-2019 Baltic dataset with complete features."""
    svc = get_ml_service()
    dates = svc.get_available_dates()
    return {
        "data_mode": "HISTORICAL_DEVELOPMENT",
        "data_cutoff": "2019-07-31",
        "count": len(dates),
        "min_date": dates[0],
        "max_date": dates[-1],
        "dates": dates,
    }


@router.post("/forecast", summary="Generate real ML probabilistic forecast and backtest evaluation")
def post_historical_forecast(req: HistoricalForecastRequest):
    """
    Executes Quantile LightGBM models with split conformal calibration
    using verified historical Baltic data up to origin_date.
    Evaluates forecast against actual target observation when available.
    """
    svc = get_ml_service()
    try:
        res = svc.forecast(
            target=req.target,
            origin_date=req.origin_date,
            horizon_sessions=req.horizon_sessions,
            vessel_type=req.vessel_type
        )
        return res.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML Inference error: {str(e)}")


@router.get("/routes", summary="List all verified dry-bulk freight routes to East Coast India")
def get_routes_list():
    """Returns verified route corridors with distances, passages, and caveats."""
    routes = list_supported_routes()
    return {
        "count": len(routes),
        "provenance": "great_circle_constrained_searoute_v1",
        "routes": [
            {
                "route_id": r.route_id,
                "origin_port": r.origin_port,
                "destination_port": r.destination_port,
                "origin_port_name": r.origin_port_name,
                "destination_port_name": r.destination_port_name,
                "origin_country": r.origin_country,
                "destination_country": r.destination_country,
                "distance_nm": r.distance_nm,
                "via_passages": r.via_passages,
                "backhaul_index": r.backhaul_index,
                "baltic_reference_route": r.baltic_reference_route,
                "caveat": r.caveat
            }
            for r in routes
        ]
    }


@router.post("/route-estimate", summary="Translate market forecast to route-specific voyage economics")
def post_route_estimate(req: RouteEstimateRequest):
    """
    Combines market forecast, verified route specs, bunker fuel pricing,
    and port compatibility to generate P10/P50/P90 route charter scenarios.
    """
    svc = get_ml_service()
    try:
        # 1. Generate market forecast
        fc_res = svc.forecast(
            target=req.target,
            origin_date=req.origin_date,
            horizon_sessions=req.horizon_sessions
        )

        # 2. Construct MarketForecast contract
        forecast_obj = MarketForecast(
            target=fc_res.target,
            vessel_type=fc_res.vessel_type,
            origin_date=fc_res.origin_date,
            target_date=fc_res.target_date,
            horizon_sessions=fc_res.horizon_sessions,
            p10_raw=fc_res.p10_raw,
            p50_raw=fc_res.p50_raw,
            p90_raw=fc_res.p90_raw,
            p10_calibrated=fc_res.p10_calibrated,
            p50=fc_res.p50,
            p90_calibrated=fc_res.p90_calibrated,
            raw_width=fc_res.raw_width,
            calibrated_width=fc_res.calibrated_width,
            model_version=fc_res.model_version,
            data_version="mendeley_verified_2012_2019",
            data_cutoff=fc_res.data_cutoff,
        )

        # 3. Retrieve route
        route_obj = SUPPORTED_ROUTES.get(req.route_id)
        if not route_obj:
            raise HTTPException(status_code=400, detail=f"Unknown route_id '{req.route_id}'")

        # 4. Bunker provider (clearly badged as TEST_ONLY)
        bunker_provider = DemoBunkerDataProvider()

        # 5. Estimate route charter economics
        charter_estimate = estimate_route_charter(
            market_forecast=forecast_obj,
            route=route_obj,
            bunker_provider=bunker_provider,
            bunker_location=req.bunker_location,
            cargo_type=req.cargo_type,
            desired_cargo_tonnes=req.desired_cargo_tonnes,
            risk_aversion=req.risk_aversion,
        )

        # 6. Adapt for optimizer payload
        optimizer_payload = adapt_charter_estimate_for_optimizer(charter_estimate)

        out = charter_estimate.to_dict()
        out["optimizer_payload"] = {
            "freight_p50_usd_t": optimizer_payload.freight_p50_usd_t,
            "freight_lo80_usd_t": optimizer_payload.freight_lo80_usd_t,
            "freight_hi80_usd_t": optimizer_payload.freight_hi80_usd_t,
            "risk_adjusted_freight_usd_t": optimizer_payload.risk_adjusted_freight_usd_t,
            "total_voyage_days": optimizer_payload.total_voyage_days,
            "feasible": optimizer_payload.feasible,
        }
        return out

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Route calculation error: {str(e)}")


@router.get("/market-summary", summary="Get latest verified Baltic market observations")
def get_market_summary():
    """
    Returns verified historical Baltic index levels at data cutoff (2019-07-31).
    Explicitly labeled as Historical Development Dataset.
    """
    svc = get_ml_service()
    last_row = svc.df.iloc[-1]
    prev_30_row = svc.df.iloc[-31]
    
    indices = [
        {"target": "BCI", "name": "Baltic Capesize Index", "vessel_class": "Capesize", "col": "bci_value"},
        {"target": "BPI", "name": "Baltic Panamax Index", "vessel_class": "Panamax", "col": "bpi_value"},
        {"target": "BSI", "name": "Baltic Supramax Index", "vessel_class": "Supramax", "col": "bsi_value"},
        {"target": "BHSI", "name": "Baltic Handysize Index", "vessel_class": "Handysize", "col": "bhsi_value"},
    ]
    
    summary = []
    for item in indices:
        curr_val = float(last_row[item["col"]])
        prev_val = float(prev_30_row[item["col"]])
        change_30d = round(curr_val - prev_val, 2)
        pct_change_30d = round((change_30d / prev_val) * 100.0, 2)
        
        summary.append({
            "target": item["target"],
            "name": item["name"],
            "vessel_class": item["vessel_class"],
            "latest_value": curr_val,
            "obs_date": last_row["obs_date"],
            "change_30d": change_30d,
            "pct_change_30d": pct_change_30d,
            "provenance": "OBSERVED",
            "source": "Mendeley Data DOI 10.17632/mcm7ycmjtt.1",
            "data_status": "Historical Development Dataset (2012–2019)"
        })
        
    return {
        "data_mode": "HISTORICAL_DEVELOPMENT",
        "data_cutoff": "2019-07-31",
        "post_2020_status": "NOT_AVAILABLE (Awaiting legitimate post-2020 acquisition)",
        "indices": summary
    }


@router.get("/status", summary="Get data mode, versions, and current forecast readiness")
def get_system_status():
    """
    Returns live machine-readable forecast readiness per Section 34.
    Dynamically reports whether system is in HISTORICAL_DEVELOPMENT or PRODUCTION_CURRENT.
    """
    from pipeline.readiness_checker import check_forecast_readiness
    report = check_forecast_readiness()
    return report.to_dict()


@router.get("/series", summary="Get verified historical Baltic time-series observations")
def get_historical_series(
    target: str = Query("BPI", description="Baltic sub-index code (BCI, BPI, BSI, BHSI)"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD filter"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD filter"),
    limit: Optional[int] = Query(None, ge=1, le=2000, description="Max observations to return (most recent)")
):
    """
    Returns verified historical Baltic observations strictly up to 2019-07-31 cutoff.
    Zero synthetic or fabricated data.
    """
    svc = get_ml_service()
    col_map = {
        "BCI": "bci_value",
        "BPI": "bpi_value",
        "BSI": "bsi_value",
        "BHSI": "bhsi_value"
    }
    target_clean = target.upper().strip()
    if target_clean not in col_map:
        raise HTTPException(status_code=400, detail=f"Unknown target index '{target}'. Must be one of BCI, BPI, BSI, BHSI")
    
    col = col_map[target_clean]
    df = svc.df[["obs_date", col]].copy()
    
    if start_date:
        df = df[df["obs_date"] >= start_date]
    if end_date:
        df = df[df["obs_date"] <= end_date]
        
    if limit is not None and len(df) > limit:
        df = df.iloc[-limit:]
        
    records = []
    for _, row in df.iterrows():
        val = float(row[col])
        records.append({
            "obs_date": row["obs_date"],
            "date": row["obs_date"],
            "value": round(val, 2),
            "target": target_clean
        })
        
    return {
        "target": target_clean,
        "data_mode": "HISTORICAL_DEVELOPMENT",
        "data_cutoff": "2019-07-31",
        "provenance": "OBSERVED",
        "source": "Mendeley Data DOI 10.17632/mcm7ycmjtt.1",
        "count": len(records),
        "start_date": records[0]["obs_date"] if records else None,
        "end_date": records[-1]["obs_date"] if records else None,
        "observations": records,
        "data": records
    }

