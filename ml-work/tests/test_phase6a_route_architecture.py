"""
Unit tests for Phase 6A Route-Aware Forecasting & Market-to-Route Translation Layer.
Validates:
  - Test 1: Vessel-to-index mapping (Capesize -> BCI, Panamax -> BPI, Supramax -> BSI, Handysize -> BHSI)
  - Test 2: Unknown vessel type fails clearly with descriptive error
  - Test 3: Unknown route fails clearly with available route listing
  - Test 4: Missing bunker data does not silently become zero
  - Test 5: Missing port constraint is never fabricated
  - Test 6: P10 <= P50 <= P90 ordering constraint
  - Test 7: Calibrated lower <= P50 <= Calibrated upper ordering constraint
  - Test 8: Horizon validation (must be one of 7, 14, 28, 60, 90, 180)
  - Test 9: Route, vessel, and forecast metadata propagation
  - Test 10: Optimizer adapter payload construction
"""
import pytest
import numpy as np
from pathlib import Path
import sys

# Ensure ml-work is in python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from route.vessel_mapping import (
    VESSEL_INDEX_MAP,
    INDEX_VESSEL_MAP,
    get_index_for_vessel,
    get_vessel_for_index,
    get_vessel_specs,
)
from route.route_config import (
    RouteContext,
    SUPPORTED_ROUTES,
    get_route,
    list_supported_routes,
)
from route.bunker_interface import (
    MissingBunkerDataError,
    BunkerPriceRecord,
    DemoBunkerDataProvider,
)
from route.port_constraints import (
    MissingPortConstraintError,
    PortConstraint,
    PORT_REGISTRY,
    get_port_constraint,
    check_vessel_port_compatibility,
)
from route.voyage_economics import (
    VoyageEconomicsResult,
    calculate_sea_days,
    calculate_voyage_economics,
)
from route.forecast_object import (
    MarketForecast,
    VALID_HORIZONS,
)
from route.charter_estimator import (
    RouteCharterEstimate,
    estimate_route_charter,
)
from route.optimizer_adapter import (
    OptimizerInputPayload,
    adapt_charter_estimate_for_optimizer,
)


def test_1_vessel_to_index_mapping():
    """Test 1 — Vessel-to-Index Mapping: Verifies Baltic index assignments."""
    assert get_index_for_vessel("Capesize") == "BCI"
    assert get_index_for_vessel("Panamax") == "BPI"
    assert get_index_for_vessel("Supramax") == "BSI"
    assert get_index_for_vessel("Handysize") == "BHSI"

    assert get_vessel_for_index("BCI") == "Capesize"
    assert get_vessel_for_index("BPI") == "Panamax"
    assert get_vessel_for_index("BSI") == "Supramax"
    assert get_vessel_for_index("BHSI") == "Handysize"


def test_2_unknown_vessel_type_fails():
    """Test 2 — Unknown Vessel Type: Rejects invalid vessel with clear error."""
    with pytest.raises(ValueError, match="Unknown vessel class: 'VLCC'"):
        get_index_for_vessel("VLCC")

    with pytest.raises(ValueError, match="Unknown vessel class: 'ContainerShip'"):
        get_vessel_specs("ContainerShip")


def test_3_unknown_route_fails():
    """Test 3 — Unknown Route: Rejects unsupported route pairs with clear error."""
    with pytest.raises(ValueError, match="Unknown route 'USNYC-INHAL'"):
        get_route("USNYC", "INHAL")


def test_4_missing_bunker_data_fails_not_zero():
    """Test 4 — Missing Bunker Data: Raises error; does NOT silently default to 0.0."""
    bunker_provider = DemoBunkerDataProvider()
    # Singapore VLSFO is available
    rec = bunker_provider.get_bunker_price("Singapore", "2019-05-01", "VLSFO")
    assert rec.price_usd_per_mt == 550.0
    assert rec.provenance == "TEST_ONLY"

    # Honolulu is not in the provider: must raise MissingBunkerDataError
    with pytest.raises(MissingBunkerDataError, match="Missing verified bunker price for location='Honolulu'"):
        bunker_provider.get_bunker_price("Honolulu", "2019-05-01", "VLSFO")


def test_5_missing_port_constraint_handled():
    """Test 5 — Missing Port Constraint: Unknown port raises clear ValueError without fabrication."""
    with pytest.raises(ValueError, match="Unknown port 'ZZZ'"):
        get_port_constraint("ZZZ")

    # If a port constraint has None for draft, check compatibility warns rather than inventing a number
    unverified_port = PortConstraint(
        port_id="TEST_PORT",
        port_name="Test Port",
        country="XX",
        role="load",
        max_draft_m=None,  # unknown draft
        max_loa_m=None,
    )
    vessel = get_vessel_specs("Panamax")
    res = check_vessel_port_compatibility(vessel, unverified_port, "coking_coal")
    assert any("max_draft_m is unknown" in w for w in res.missing_data_warnings)


def test_6_p10_p50_p90_ordering():
    """Test 6 — P10 <= P50 <= P90: Enforced by MarketForecast constructor."""
    # Invalid raw ordering: P10 > P50
    with pytest.raises(ValueError, match="Raw quantiles violate ordering"):
        MarketForecast(
            target="BPI",
            vessel_type="Panamax",
            origin_date="2019-05-01",
            target_date="2019-06-10",
            horizon_sessions=28,
            p10_raw=1500.0,
            p50_raw=1200.0,  # P10 > P50!
            p90_raw=1800.0,
            p10_calibrated=1000.0,
            p50=1200.0,
            p90_calibrated=2000.0,
            raw_width=300.0,
            calibrated_width=1000.0,
        )


def test_7_calibrated_interval_ordering():
    """Test 7 — Calibrated Bounds: Enforced P10_cal <= P50 <= P90_cal."""
    with pytest.raises(ValueError, match="Calibrated interval violates ordering"):
        MarketForecast(
            target="BPI",
            vessel_type="Panamax",
            origin_date="2019-05-01",
            target_date="2019-06-10",
            horizon_sessions=28,
            p10_raw=1000.0,
            p50_raw=1200.0,
            p90_raw=1500.0,
            p10_calibrated=1300.0,  # P10_cal > P50!
            p50=1200.0,
            p90_calibrated=1800.0,
            raw_width=500.0,
            calibrated_width=500.0,
        )


def test_8_horizon_validation():
    """Test 8 — Horizon Validation: Must be in {7, 14, 28, 60, 90, 180}."""
    with pytest.raises(ValueError, match="Invalid horizon_sessions 45"):
        MarketForecast(
            target="BPI",
            vessel_type="Panamax",
            origin_date="2019-05-01",
            target_date="2019-06-10",
            horizon_sessions=45,  # Invalid horizon!
            p10_raw=1000.0,
            p50_raw=1200.0,
            p90_raw=1500.0,
            p10_calibrated=900.0,
            p50=1200.0,
            p90_calibrated=1600.0,
            raw_width=500.0,
            calibrated_width=700.0,
        )


def test_9_route_vessel_metadata_propagation():
    """Test 9 — Metadata Propagation: Route, vessel, and forecast parameters flow cleanly into estimate."""
    route = get_route("AUHPT", "INPRT")
    bunker_provider = DemoBunkerDataProvider()
    forecast = MarketForecast(
        target="BPI",
        vessel_type="Panamax",
        origin_date="2019-05-01",
        target_date="2019-06-10",
        horizon_sessions=28,
        p10_raw=1100.0,
        p50_raw=1300.0,
        p90_raw=1600.0,
        p10_calibrated=950.0,
        p50=1300.0,
        p90_calibrated=1850.0,
        raw_width=500.0,
        calibrated_width=900.0,
    )

    estimate = estimate_route_charter(
        market_forecast=forecast,
        route=route,
        bunker_provider=bunker_provider,
        risk_aversion=0.50,
    )

    assert estimate.route_id == "AUHPT-INPRT"
    assert estimate.origin_port == "AUHPT"
    assert estimate.destination_port == "INPRT"
    assert estimate.vessel_class == "Panamax"
    assert estimate.horizon_sessions == 28
    assert estimate.scenario_p10.freight_usd_per_tonne < estimate.scenario_p50.freight_usd_per_tonne
    assert estimate.scenario_p50.freight_usd_per_tonne < estimate.scenario_p90.freight_usd_per_tonne
    assert estimate.risk_adjusted_freight_usd_t > estimate.scenario_p50.freight_usd_per_tonne
    assert estimate.status == "feasible"
    assert "actual_spot_fixture_quote" in estimate.not_currently_available


def test_10_optimizer_adapter_construction():
    """Test 10 — Optimizer Adapter: Converts RouteCharterEstimate to OptimizerInputPayload."""
    route = get_route("AUHPT", "INPRT")
    bunker_provider = DemoBunkerDataProvider()
    forecast = MarketForecast(
        target="BCI",
        vessel_type="Capesize",
        origin_date="2019-05-01",
        target_date="2019-06-10",
        horizon_sessions=28,
        p10_raw=1800.0,
        p50_raw=2200.0,
        p90_raw=2800.0,
        p10_calibrated=1500.0,
        p50=2200.0,
        p90_calibrated=3200.0,
        raw_width=1000.0,
        calibrated_width=1700.0,
    )

    estimate = estimate_route_charter(
        market_forecast=forecast,
        route=route,
        bunker_provider=bunker_provider,
        risk_aversion=0.60,
    )

    payload = adapt_charter_estimate_for_optimizer(estimate)
    assert isinstance(payload, OptimizerInputPayload)
    assert payload.route_id == "AUHPT-INPRT"
    assert payload.vessel_class == "Capesize"
    assert payload.index_code == "BCI"
    assert payload.freight_lo80_usd_t == estimate.scenario_p10.freight_usd_per_tonne
    assert payload.freight_p50_usd_t == estimate.scenario_p50.freight_usd_per_tonne
    assert payload.freight_hi80_usd_t == estimate.scenario_p90.freight_usd_per_tonne
    assert payload.feasible is True
