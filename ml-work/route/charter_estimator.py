"""
Route-Specific Charter Estimator & Translation Layer for SIH26006.
Translates broad vessel-segment Baltic forecasts into route-specific
freight and voyage economics scenarios (P10, P50, P90).

Categorizes every component explicitly:
  A. DIRECTLY OBSERVED / PREDICTED: Baltic index forecasts (P10, P50, P90)
  B. DERIVED: sea days, bunker consumption, voyage duration, freight $/tonne
  C. ASSUMED / CONFIGURED: vessel speeds, daily consumption, port turnaround, risk aversion
  D. NOT CURRENTLY AVAILABLE: actual spot fixture quotes, post-2020 target data
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import date
from typing import Dict, Any, Optional, Tuple

from .vessel_mapping import VesselClassSpecs, get_vessel_specs
from .route_config import RouteContext, get_route
from .port_constraints import PortConstraint, get_port_constraint, check_vessel_port_compatibility
from .bunker_interface import BunkerDataProvider, BunkerPriceRecord
from .forecast_object import MarketForecast
from .voyage_economics import VoyageEconomicsResult, calculate_voyage_economics

# Empirical / benchmark ratio converting Baltic index level to daily TCE ($/day)
# e.g., BPI 1200 * 9.5 ~ $11,400/day
INDEX_TO_TCE_RATIO: dict[str, float] = {
    "BCI": 11.5,
    "BPI": 9.5,
    "BSI": 11.0,
    "BHSI": 18.0,
}


@dataclass(frozen=True)
class ScenarioRate:
    """A single freight scenario (e.g. P10, P50, P90)."""
    scenario_name: str
    index_level: float
    tce_usd_day: float
    total_voyage_cost_usd: float
    freight_usd_per_tonne: float
    voyage_days: float
    bunker_cost_usd: float


@dataclass(frozen=True)
class RouteCharterEstimate:
    """
    Complete structured route-level charter estimate.
    Combines market forecast, physical port compatibility, and voyage economics.
    """
    route_id: str
    origin_port: str
    destination_port: str
    vessel_class: str
    cargo_type: str
    cargo_tonnes: float
    horizon_sessions: int
    as_of_date: str

    # Scenarios
    scenario_p10: ScenarioRate
    scenario_p50: ScenarioRate
    scenario_p90: ScenarioRate
    risk_adjusted_freight_usd_t: float
    risk_aversion_lambda: float

    # Port & physical compatibility
    load_port_feasible: bool
    discharge_port_feasible: bool
    requires_lighterage: bool
    compatibility_reasons: list[str]

    # Accounting categories
    directly_predicted: dict[str, Any]
    derived: dict[str, Any]
    assumed: dict[str, Any]
    not_currently_available: dict[str, Any]

    status: str = "feasible"
    provenance: str = "route_aware_voyage_translation_v1"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def estimate_route_charter(
    market_forecast: MarketForecast,
    route: RouteContext,
    bunker_provider: BunkerDataProvider,
    bunker_location: str = "Singapore",
    cargo_type: str = "coking_coal",
    desired_cargo_tonnes: Optional[float] = None,
    risk_aversion: float = 0.50,
    origin_port_constraint: Optional[PortConstraint] = None,
    dest_port_constraint: Optional[PortConstraint] = None,
) -> RouteCharterEstimate:
    """
    Generate route-specific chartering cost estimates across P10, P50, and P90 market scenarios.
    
    Parameters:
      - market_forecast: Verified MarketForecast object for the matching vessel class
      - route: Verified RouteContext
      - bunker_provider: Interface providing verified or test-fixture fuel prices
      - bunker_location: Port where bunker fuel is priced (default: Singapore for Pacific/Indo routes)
      - cargo_type: Bulk cargo commodity
      - desired_cargo_tonnes: Optional lift quantity (defaults to draft-limited intake)
      - risk_aversion: Weight lambda in [0, 1] for tail-risk adjustment
    """
    if not (0.0 <= risk_aversion <= 1.0):
        raise ValueError(f"risk_aversion must be in [0, 1], got {risk_aversion}")

    vessel = get_vessel_specs(market_forecast.vessel_type)
    load_port = origin_port_constraint or get_port_constraint(route.origin_port)
    disch_port = dest_port_constraint or get_port_constraint(route.destination_port)

    # 1. Physical compatibility checks
    load_compat = check_vessel_port_compatibility(vessel, load_port, cargo_type)
    disch_compat = check_vessel_port_compatibility(vessel, disch_port, cargo_type)
    
    reasons = load_compat.reasons + disch_compat.reasons
    feasible = load_compat.feasible and disch_compat.feasible

    # Determine allowable cargo intake
    max_cargo_t = min(load_compat.max_intake_t, disch_compat.max_intake_t)
    if desired_cargo_tonnes is not None:
        cargo_t = min(desired_cargo_tonnes, max_cargo_t)
    else:
        cargo_t = max_cargo_t

    if cargo_t <= 0:
        feasible = False
        reasons.append("Allowable cargo intake is 0 tonnes due to port or vessel draft limits.")

    # 2. Bunker fuel retrieval (MUST NOT silently default to 0)
    bunker_record = bunker_provider.get_bunker_price(
        location=bunker_location,
        query_date=market_forecast.origin_date,
        fuel_type="VLSFO",
    )
    bunker_price = bunker_record.price_usd_per_mt

    # 3. Market-to-TCE conversion
    tce_ratio = INDEX_TO_TCE_RATIO.get(market_forecast.target, 10.0)
    tce_p10 = round(market_forecast.p10_calibrated * tce_ratio, 2)
    tce_p50 = round(market_forecast.p50 * tce_ratio, 2)
    tce_p90 = round(market_forecast.p90_calibrated * tce_ratio, 2)

    # Effective payload for economics calculation
    eval_cargo_t = cargo_t if cargo_t > 0 else (vessel.ref_dwt - vessel.constants_t)

    # 4. Voyage Economics across P10, P50, P90
    econ_p10 = calculate_voyage_economics(
        vessel=vessel,
        route=route,
        cargo_tonnes=eval_cargo_t,
        tce_usd_day=tce_p10,
        bunker_usd_per_mt=bunker_price,
    )
    econ_p50 = calculate_voyage_economics(
        vessel=vessel,
        route=route,
        cargo_tonnes=eval_cargo_t,
        tce_usd_day=tce_p50,
        bunker_usd_per_mt=bunker_price,
    )
    econ_p90 = calculate_voyage_economics(
        vessel=vessel,
        route=route,
        cargo_tonnes=eval_cargo_t,
        tce_usd_day=tce_p90,
        bunker_usd_per_mt=bunker_price,
    )

    # 5. Risk-Adjusted Freight Rate: (1 - lambda) * P50 + lambda * P90
    risk_adjusted_rate = round(
        (1.0 - risk_aversion) * econ_p50.freight_usd_per_tonne +
        risk_aversion * econ_p90.freight_usd_per_tonne,
        3
    )

    sc_p10 = ScenarioRate(
        scenario_name="P10_calibrated_low",
        index_level=market_forecast.p10_calibrated,
        tce_usd_day=tce_p10,
        total_voyage_cost_usd=econ_p10.total_voyage_cost_usd,
        freight_usd_per_tonne=econ_p10.freight_usd_per_tonne,
        voyage_days=econ_p10.total_voyage_days,
        bunker_cost_usd=econ_p10.bunker_cost_usd,
    )
    sc_p50 = ScenarioRate(
        scenario_name="P50_central_median",
        index_level=market_forecast.p50,
        tce_usd_day=tce_p50,
        total_voyage_cost_usd=econ_p50.total_voyage_cost_usd,
        freight_usd_per_tonne=econ_p50.freight_usd_per_tonne,
        voyage_days=econ_p50.total_voyage_days,
        bunker_cost_usd=econ_p50.bunker_cost_usd,
    )
    sc_p90 = ScenarioRate(
        scenario_name="P90_calibrated_high",
        index_level=market_forecast.p90_calibrated,
        tce_usd_day=tce_p90,
        total_voyage_cost_usd=econ_p90.total_voyage_cost_usd,
        freight_usd_per_tonne=econ_p90.freight_usd_per_tonne,
        voyage_days=econ_p90.total_voyage_days,
        bunker_cost_usd=econ_p90.bunker_cost_usd,
    )

    return RouteCharterEstimate(
        route_id=route.route_id,
        origin_port=route.origin_port,
        destination_port=route.destination_port,
        vessel_class=vessel.vessel_class,
        cargo_type=cargo_type,
        cargo_tonnes=round(eval_cargo_t, 1),
        horizon_sessions=market_forecast.horizon_sessions,
        as_of_date=market_forecast.origin_date,
        scenario_p10=sc_p10,
        scenario_p50=sc_p50,
        scenario_p90=sc_p90,
        risk_adjusted_freight_usd_t=risk_adjusted_rate,
        risk_aversion_lambda=risk_aversion,
        load_port_feasible=load_compat.feasible,
        discharge_port_feasible=disch_compat.feasible,
        requires_lighterage=disch_compat.requires_lighterage,
        compatibility_reasons=reasons,
        directly_predicted={
            "target": market_forecast.target,
            "horizon_sessions": market_forecast.horizon_sessions,
            "p10_calibrated": market_forecast.p10_calibrated,
            "p50": market_forecast.p50,
            "p90_calibrated": market_forecast.p90_calibrated,
            "model_version": market_forecast.model_version,
            "data_cutoff": market_forecast.data_cutoff,
        },
        derived={
            "distance_nm": route.distance_nm,
            "sea_days_laden": econ_p50.sea_days_laden,
            "sea_days_ballast": econ_p50.sea_days_ballast,
            "total_voyage_days": econ_p50.total_voyage_days,
            "bunker_consumption_mt": econ_p50.bunker_consumption_mt,
            "bunker_cost_p50_usd": econ_p50.bunker_cost_usd,
            "freight_usd_per_tonne_p50": econ_p50.freight_usd_per_tonne,
            "total_voyage_cost_p50_usd": econ_p50.total_voyage_cost_usd,
        },
        assumed={
            "vessel_speed_laden_kn": vessel.speed_laden_kn,
            "vessel_speed_ballast_kn": vessel.speed_ballast_kn,
            "fuel_consumption_laden_mt_day": vessel.cons_laden_mt_day,
            "index_to_tce_ratio": tce_ratio,
            "commercial_margin": econ_p50.commercial_margin,
            "risk_aversion_lambda": risk_aversion,
            "bunker_location": bunker_location,
        },
        not_currently_available={
            "actual_spot_fixture_quote": None,
            "post_2020_baltic_target_data": None,
            "real_time_ais_vessel_positions": None,
            "status": "awaiting_legitimate_post_2020_data_acquisition",
        },
        status="feasible" if feasible else "infeasible",
    )
