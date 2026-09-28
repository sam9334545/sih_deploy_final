from __future__ import annotations

import json
from datetime import timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import require_port, resolve_as_of
from app.errors import InvalidInput, NoModel, NotFound, StaleData
from app.repositories import reference as ref_repo
from app.repositories import series as series_repo
from app.schemas.requests import ForecastRequest
from app.schemas.responses import ForecastResponse
from app.services import forecast_service, forecast_v2_adapter, shadow_freight
from app.services.constants import CLASS_INDEX, HORIZONS
from app.services.cost_model import port_charges
from app.services.scenario import _weather_fraction

router = APIRouter(prefix="/forecast", tags=["forecast"])

_METHOD = {
    "v1": ("Built-in fallback: ridge on stationary lag/rolling/momentum/Fourier features, "
           "selected against a damped-drift baseline by rolling-origin MASE; 80% bands are "
           "conformal quantiles of the backtest residuals."),
    "v2": ("ml-work/forecast_v2 ensemble (damped momentum + ridge + LightGBM), weights "
           "fitted on a chronological validation tail. Scored by expanding-origin "
           "rolling evaluation on the verified real Baltic record (2012-08 to 2019-07); "
           "80% bands are conformalized quantile regression with a finite-sample order "
           "statistic. Significance tested with a moving-block bootstrap."),
}


@router.post("", response_model=ForecastResponse, summary="Freight forecast for a vessel class")
def post_forecast(req: ForecastRequest, request: Request, db: Session = Depends(get_db)):
    as_of = resolve_as_of(req.as_of)
    index_code = CLASS_INDEX[req.vessel_class]

    if req.horizon_days not in HORIZONS:
        raise NoModel(f"No trained model for horizon {req.horizon_days}",
                      field="horizon_days", allowed=HORIZONS)

    try:
        forecast_service.check_freshness(db, index_code, as_of, settings.stale_data_days)
    except forecast_service.StaleDataError as e:
        raise StaleData(f"Latest index data is {e.age_days} days old", as_of=e.as_of,
                        hint="Run the ingestion job, or pass an earlier as_of") from e
    except forecast_service.NoModelError as e:
        raise NoModel(str(e), field="vessel_class") from e

    try:
        fc = forecast_service.get_or_build(db, index_code, req.horizon_days, as_of, req.refresh)
    except forecast_service.NoModelError as e:
        raise NoModel(str(e), field="horizon_days", allowed=HORIZONS) from e

    tc_point = forecast_service.tc_from_index(db, index_code, fc.point, as_of)
    tc = {"point": tc_point,
          "interval_80": [forecast_service.tc_from_index(db, index_code, fc.lo_80, as_of),
                          forecast_service.tc_from_index(db, index_code, fc.hi_80, as_of)]}

    usd_t = None
    hist_prov, hist_detail = series_repo.history_provenance(db, index_code, as_of)
    provenance = {"index_forecast": "derived", "history": hist_prov}

    if req.route:
        usd_t = _route_rate(db, req, as_of, index_code, fc, tc_point)
        provenance["usd_per_tonne"] = "derived"

    detail = forecast_service.v2_detail(as_of, index_code, req.horizon_days) or {}
    is_v2 = fc.model_version == forecast_service.V2_VERSION
    fallback_reason = None
    if not is_v2:
        fallback_reason = (
            "forecast_v2 disabled by configuration" if not settings.forecast_v2_enabled
            else forecast_v2_adapter.status().get("reason")
            or "forecast_v2 did not produce a forecast for this index/horizon")
        if settings.require_v2_forecast:
            raise NoModel(
                f"Production LightGBM v2 models required by configuration but unavailable: {fallback_reason}",
                field="vessel_class"
            )

    return ForecastResponse(
        vessel_class=req.vessel_class, index=index_code, as_of=as_of,
        horizon_days=req.horizon_days,
        target_date=as_of + timedelta(days=req.horizon_days),
        index_forecast={"point": fc.point, "interval_80": [fc.lo_80, fc.hi_80]},
        tc_avg_usd_day=tc, usd_per_tonne=usd_t,
        forecast_quality_score=fc.confidence,
        quality_score_components=detail.get("quality_score_components"),
        quality_score_definition=detail.get("quality_score_definition") or (
            None if is_v2 else
            "Heuristic 0-1 score from the built-in fallback model: band tightness "
            "blended with backtest MASE and interval coverage. Not a probability."),
        confidence=fc.confidence, trend=fc.trend or "stable",
        history=forecast_service.history_points(db, index_code, as_of, 180),
        model_meta={
            "name": fc.model_name, "version": fc.model_version, "trained_on": fc.trained_on,
            "validation_mase": fc.validation_mase,
            "interval_coverage_80": fc.interval_coverage_80,
            "method": _METHOD.get(fc.model_version, _METHOD["v1"]),
            "model_source": "forecast_v2" if is_v2 else "fallback_v1",
            "selected_model": detail.get("selected_model"),
            "fallback_reason": fallback_reason,
        },
        drivers=json.loads(fc.drivers_json or "[]"),
        driver_groups=detail.get("driver_groups"),
        validation=detail.get("validation"),
        interval=detail.get("interval"),
        model_provenance=detail.get("provenance"),
        provenance=provenance,
        provenance_detail={"history": hist_detail} if hist_detail else None,
        assumptions=[
            "The forecast is an uncertain input to a decision, not a price oracle",
            "TC average $/day is mapped from the index by the observed trailing ratio",
            (f"80% interval empirical coverage measured over "
             f"{(detail.get('interval') or {}).get('n_origins', 'n/a')} rolling origins: "
             f"{fc.interval_coverage_80}%" if fc.interval_coverage_80 is not None
             else "Interval coverage not measured for this model"),
            "forecast_quality_score is a heuristic ranking aid, not a probability",
        ],
        request_id=request.state.request_id,
    )


def _route_rate(db, req, as_of, index_code, fc, tc_point):
    origin = require_port(db, req.route.origin_port)
    dest = require_port(db, req.route.destination_port)
    route = ref_repo.get_route(db, origin.port_id, dest.port_id)
    if route is None:
        raise NotFound(f"No route in dim_route for {origin.port_id} → {dest.port_id}",
                       field="route",
                       hint="Add the pair to data/reference/routes.csv and reseed")

    vc = ref_repo.get_vessel_class(db, req.vessel_class)
    _, bunker = series_repo.latest_value(db, "BUNKER_VLSFO_SG", as_of)
    bunker = bunker or 550.0
    lc = port_charges(ref_repo.tariffs(db, origin.port_id, as_of), vc.grt)
    dc = port_charges(ref_repo.tariffs(db, dest.port_id, as_of), vc.grt)
    wx = _weather_fraction(db, [origin.port_id, dest.port_id], as_of.month)

    # Cargo is the draft-limited intake, so port constraints enter the freight number itself.
    from app.services.constraint_service import evaluate_port
    cargo_type = "coking_coal"
    fit_l = evaluate_port(db, vc, origin.port_id, cargo_type, as_of)
    fit_d = evaluate_port(db, vc, dest.port_id, cargo_type, as_of)
    if not (fit_l.feasible and fit_d.feasible):
        raise InvalidInput(
            f"{req.vessel_class} cannot serve {origin.port_name} → {dest.port_name}",
            field="route",
            hint=(fit_l.detail if not fit_l.feasible else fit_d.detail))
    cargo_t = min(fit_l.best.intake.max_intake_t, fit_d.best.intake.max_intake_t)
    load_days = cargo_t / (fit_l.best.berth.handling_rate_tpd or 20000)
    disch_days = cargo_t / (fit_d.best.berth.handling_rate_tpd or 20000)

    rate = shadow_freight.estimate(
        vc, tc_point, route.distance_nm, cargo_t, float(bunker), lc, dc,
        load_days, disch_days, (load_days + disch_days) * wx, route.backhaul_index,
        margin=shadow_freight.LANE_MARGIN.get(
            shadow_freight.lane_key(origin.country, dest.country)),
        extra_band=(fc.hi_80 - fc.lo_80) / (2 * fc.point) if fc.point else 0.0)

    return {"point": rate.usd_per_tonne, "interval_80": [rate.lo_80, rate.hi_80],
            "provenance": "derived", "model": rate.model,
            "calibration_mape": rate.calibration_mape,
            "calibration_route": rate.calibration_route,
            "cargo_t": rate.cargo_t, "components_usd": rate.components_usd}
