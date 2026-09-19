"""
Route-Aware Forecasting & Market-to-Route Translation Package.
SIH26006 Phase 6A.
"""
from .vessel_mapping import (
    VESSEL_INDEX_MAP,
    INDEX_VESSEL_MAP,
    VesselClassSpecs,
    VESSEL_SPECS,
    get_index_for_vessel,
    get_vessel_for_index,
    get_vessel_specs,
)
from .route_config import (
    RouteContext,
    SUPPORTED_ROUTES,
    get_route,
    list_supported_routes,
)
from .bunker_interface import (
    MissingBunkerDataError,
    BunkerPriceRecord,
    BunkerDataProvider,
    DemoBunkerDataProvider,
)
from .port_constraints import (
    MissingPortConstraintError,
    PortConstraint,
    PORT_REGISTRY,
    get_port_constraint,
    check_vessel_port_compatibility,
    CompatibilityResult,
)
from .voyage_economics import (
    VoyageEconomicsResult,
    calculate_sea_days,
    calculate_voyage_economics,
)
from .forecast_object import (
    MarketForecast,
    VALID_HORIZONS,
)
from .charter_estimator import (
    ScenarioRate,
    RouteCharterEstimate,
    estimate_route_charter,
    INDEX_TO_TCE_RATIO,
)
from .optimizer_adapter import (
    OptimizerInputPayload,
    adapt_charter_estimate_for_optimizer,
)

__all__ = [
    "VESSEL_INDEX_MAP",
    "INDEX_VESSEL_MAP",
    "VesselClassSpecs",
    "VESSEL_SPECS",
    "get_index_for_vessel",
    "get_vessel_for_index",
    "get_vessel_specs",
    "RouteContext",
    "SUPPORTED_ROUTES",
    "get_route",
    "list_supported_routes",
    "MissingBunkerDataError",
    "BunkerPriceRecord",
    "BunkerDataProvider",
    "DemoBunkerDataProvider",
    "MissingPortConstraintError",
    "PortConstraint",
    "PORT_REGISTRY",
    "get_port_constraint",
    "check_vessel_port_compatibility",
    "CompatibilityResult",
    "VoyageEconomicsResult",
    "calculate_sea_days",
    "calculate_voyage_economics",
    "MarketForecast",
    "VALID_HORIZONS",
    "ScenarioRate",
    "RouteCharterEstimate",
    "estimate_route_charter",
    "INDEX_TO_TCE_RATIO",
    "OptimizerInputPayload",
    "adapt_charter_estimate_for_optimizer",
]
