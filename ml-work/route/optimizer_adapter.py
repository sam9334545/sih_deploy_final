"""
Optimizer Adapter Layer for SIH26006.
Bridges the route-aware probabilistic forecast engine and the existing
downstream optimization / strategy ranking engine.

Contract Guarantee:
  - Preserves backend/optimizer interfaces without modifying backend code.
  - Translates P10/P50/P90 market distributions into uncertainty bounds for strategy evaluation.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Optional

from .charter_estimator import RouteCharterEstimate


@dataclass(frozen=True)
class OptimizerInputPayload:
    """
    Standardized payload consumed by the charter strategy optimizer.
    """
    route_id: str
    vessel_class: str
    index_code: str
    origin_port: str
    destination_port: str
    cargo_type: str
    cargo_tonnes: float
    horizon_days: int

    # Freight cost parameters ($/tonne)
    freight_p50_usd_t: float
    freight_lo80_usd_t: float
    freight_hi80_usd_t: float
    risk_adjusted_freight_usd_t: float

    # Daily earnings parameter ($/day)
    tce_usd_day: float

    # Operational metrics
    total_voyage_days: float
    sea_days_laden: float
    sea_days_ballast: float
    bunker_consumption_mt: float
    bunker_cost_usd: float

    # Feasibility status
    feasible: bool
    rejection_reasons: list[str]

    provenance: str = "route_forecast_to_optimizer_adapter_v1"


def adapt_charter_estimate_for_optimizer(
    estimate: RouteCharterEstimate,
) -> OptimizerInputPayload:
    """
    Transform a RouteCharterEstimate into the exact input payload
    required by downstream charter strategy optimization.
    """
    return OptimizerInputPayload(
        route_id=estimate.route_id,
        vessel_class=estimate.vessel_class,
        index_code=estimate.directly_predicted["target"],
        origin_port=estimate.origin_port,
        destination_port=estimate.destination_port,
        cargo_type=estimate.cargo_type,
        cargo_tonnes=estimate.cargo_tonnes,
        horizon_days=estimate.horizon_sessions,
        freight_p50_usd_t=estimate.scenario_p50.freight_usd_per_tonne,
        freight_lo80_usd_t=estimate.scenario_p10.freight_usd_per_tonne,
        freight_hi80_usd_t=estimate.scenario_p90.freight_usd_per_tonne,
        risk_adjusted_freight_usd_t=estimate.risk_adjusted_freight_usd_t,
        tce_usd_day=estimate.scenario_p50.tce_usd_day,
        total_voyage_days=estimate.scenario_p50.voyage_days,
        sea_days_laden=estimate.derived["sea_days_laden"],
        sea_days_ballast=estimate.derived["sea_days_ballast"],
        bunker_consumption_mt=estimate.derived["bunker_consumption_mt"],
        bunker_cost_usd=estimate.scenario_p50.bunker_cost_usd,
        feasible=(estimate.status == "feasible"),
        rejection_reasons=estimate.compatibility_reasons,
    )
