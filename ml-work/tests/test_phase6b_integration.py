"""
Phase 6B End-to-End Integration and Anti-Leakage Test Suite.

Verifies:
  1. Automated Anti-Leakage Test: Modifying future data post-origin T does not alter features at T.
  2. ML Inference Service: Target selection, horizon validation, model loading.
  3. Quantile Monotonicity: P10 <= P50 <= P90 (raw and conformal calibrated).
  4. Historical Backtest & Actual Evaluation: Error calculation within window, NOT_AVAILABLE post-cutoff.
  5. Route Layer Integration: MarketForecast -> RouteCharterEstimate -> Voyage Economics.
  6. Backend Endpoints: /api/v1/historical/* via TestClient.
  7. Optimizer Adapter: Connects route estimates into decision payloads.
"""
import pytest
import numpy as np
import pandas as pd
from pathlib import Path
import sys

# Ensure ml-work and backend-work are on sys.path
ML_WORK_DIR = Path(__file__).resolve().parent.parent
BACKEND_WORK_DIR = ML_WORK_DIR.parent / "backend-work"
sys.path.insert(0, str(ML_WORK_DIR))
sys.path.insert(0, str(BACKEND_WORK_DIR))

from models.inference import get_inference_service, MLInferenceService, HistoricalForecastResult
from features.builder import build_features_for_row
from features.config import FeatureConfig
from route.vessel_mapping import get_index_for_vessel, get_vessel_for_index
from route.route_config import get_route, SUPPORTED_ROUTES
from route.bunker_interface import DemoBunkerDataProvider
from route.charter_estimator import estimate_route_charter
from route.optimizer_adapter import adapt_charter_estimate_for_optimizer


# =====================================================================
# 1. AUTOMATED ANTI-LEAKAGE TEST (Section 36)
# =====================================================================
def test_future_data_modification_leaves_origin_features_invariant():
    """
    Test 1: Future data modification test (Section 36).
    Proves that altering future data post-origin date T has zero impact on features computed at T.
    """
    service = get_inference_service()
    df_clean = service.df.copy()

    origin_date = "2019-05-15"
    assert origin_date in df_clean["obs_date"].values
    origin_idx = service.date_to_idx[origin_date]
    config = FeatureConfig()

    # Step 1: Compute features at T from original dataset
    features_orig = build_features_for_row(df_clean, origin_idx, "bpi_value", config)

    # Step 2: Create perturbed dataset where all future data (t > T) is heavily modified
    df_perturbed = df_clean.copy()
    future_mask = df_perturbed.index > origin_idx
    assert future_mask.sum() > 0, "Must have future rows to perturb"

    # Drastically perturb future rows with extreme values
    df_perturbed.loc[future_mask, "bpi_value"] = 999999.0
    df_perturbed.loc[future_mask, "bci_value"] = 888888.0
    df_perturbed.loc[future_mask, "bsi_value"] = 777777.0
    df_perturbed.loc[future_mask, "bhsi_value"] = 666666.0

    # Step 3: Compute features at T from perturbed dataset
    features_pert = build_features_for_row(df_perturbed, origin_idx, "bpi_value", config)

    # Step 4: Verify 100% numerical equality across all feature keys
    assert set(features_orig.keys()) == set(features_pert.keys())
    for k in features_orig:
        if isinstance(features_orig[k], (int, float)):
            assert np.isclose(features_orig[k], features_pert[k], rtol=1e-10, atol=1e-10), f"Feature {k} differed!"
        else:
            assert features_orig[k] == features_pert[k], f"Feature {k} differed!"


# =====================================================================
# 2. ML INFERENCE SERVICE TESTS (Section 37 - ML)
# =====================================================================
def test_ml_inference_model_loading_and_forecast_generation():
    """Test 2: Model loading and valid MarketForecast creation."""
    service = get_inference_service()
    fc = service.forecast(
        target="BPI",
        origin_date="2019-06-28",
        horizon_sessions=28,
        vessel_type="Panamax"
    )
    assert fc.target == "BPI"
    assert fc.vessel_type == "Panamax"
    assert fc.origin_date == "2019-06-28"
    assert fc.horizon_sessions == 28
    assert fc.p10_raw > 0
    assert fc.p50_raw > 0
    assert fc.p90_raw > 0

    mf = fc.to_market_forecast()
    assert mf.target == "BPI"
    assert mf.p50 == fc.p50


def test_ml_inference_quantile_monotonicity_ordering():
    """Test 3: Both raw and conformal calibrated quantiles obey strict ordering."""
    service = get_inference_service()
    for vessel, target in [("Capesize", "BCI"), ("Panamax", "BPI"), ("Supramax", "BSI"), ("Handysize", "BHSI")]:
        fc = service.forecast(target=target, origin_date="2019-05-15", horizon_sessions=14, vessel_type=vessel)
        # Raw quantiles
        assert fc.p10_raw <= fc.p50_raw <= fc.p90_raw, f"Raw ordering failed for {target}"
        # Calibrated quantiles
        assert fc.p10_calibrated <= fc.p50 <= fc.p90_calibrated, f"Calibrated ordering failed for {target}"


def test_ml_inference_invalid_inputs_fail_gracefully():
    """Test 4: Invalid target, horizon, or out-of-bounds date raises ValueError."""
    service = get_inference_service()
    # Invalid horizon
    with pytest.raises(ValueError, match="Invalid horizon"):
        service.forecast(target="BPI", origin_date="2019-05-15", horizon_sessions=45)

    # Invalid vessel/target mismatch
    with pytest.raises(ValueError):
        service.forecast(target="UNKNOWN", origin_date="2019-05-15", horizon_sessions=28)

    # Out of bounds date (future)
    with pytest.raises(ValueError, match="not found in verified historical"):
        service.forecast(target="BPI", origin_date="2025-01-01", horizon_sessions=28)


def test_historical_actual_evaluation_inside_and_outside_cutoff():
    """Test 5: Evaluation reports metrics when T+h <= cutoff, NOT_AVAILABLE when T+h > cutoff."""
    service = get_inference_service()

    # Case A: T+h is within 2012-2019 window (2019-05-15 + 14 sessions = late May 2019)
    res_in = service.forecast(
        target="BPI",
        origin_date="2019-05-15",
        horizon_sessions=14,
        vessel_type="Panamax"
    )
    assert res_in.actual_status == "OBSERVED"
    assert res_in.actual_value is not None
    assert res_in.absolute_error is not None
    assert res_in.percentage_error is not None
    assert res_in.absolute_error >= 0
    assert res_in.percentage_error >= 0

    # Case B: T+h is beyond cutoff (2019-07-25 + 28 sessions = September 2019)
    res_out = service.forecast(
        target="BPI",
        origin_date="2019-07-25",
        horizon_sessions=28,
        vessel_type="Panamax"
    )
    assert res_out.actual_status == "NOT_AVAILABLE"
    assert res_out.actual_value is None
    assert res_out.absolute_error is None
    assert res_out.percentage_error is None


# =====================================================================
# 3. ROUTE LAYER INTEGRATION TESTS (Section 37 - Route)
# =====================================================================
def test_route_layer_receives_market_forecast_and_computes_freight():
    """Test 6: MarketForecast connects to RouteCharterEstimate via voyage physics."""
    service = get_inference_service()
    fc = service.forecast(target="BPI", origin_date="2019-06-28", horizon_sessions=28, vessel_type="Panamax")
    mf = fc.to_market_forecast()

    # Find a verified route from SUPPORTED_ROUTES
    route = list(SUPPORTED_ROUTES.values())[0]
    bunker_provider = DemoBunkerDataProvider()

    est = estimate_route_charter(
        market_forecast=mf,
        route=route,
        bunker_provider=bunker_provider,
        cargo_type="coal",
        desired_cargo_tonnes=75000,
    )

    # Freight estimates exist and obey monotonic bounds
    assert est.scenario_p10.freight_usd_per_tonne <= est.scenario_p50.freight_usd_per_tonne <= est.scenario_p90.freight_usd_per_tonne
    assert est.scenario_p50.freight_usd_per_tonne > 5.0  # Realistic $/tonne floor
    assert est.provenance == "route_aware_voyage_translation_v1"


def test_optimizer_adapter_payload_from_route_estimate():
    """Test 7: Route estimate converts into valid backend optimizer payload."""
    service = get_inference_service()
    fc = service.forecast(target="BPI", origin_date="2019-06-28", horizon_sessions=28, vessel_type="Panamax")
    mf = fc.to_market_forecast()
    route = list(SUPPORTED_ROUTES.values())[0]
    bunker_provider = DemoBunkerDataProvider()

    est = estimate_route_charter(
        market_forecast=mf,
        route=route,
        bunker_provider=bunker_provider,
        cargo_type="coal",
        desired_cargo_tonnes=75000,
    )

    opt_payload = adapt_charter_estimate_for_optimizer(estimate=est)

    assert opt_payload.destination_port == route.destination_port
    assert opt_payload.freight_p50_usd_t > 0
    assert opt_payload.risk_adjusted_freight_usd_t > 0


# =====================================================================
# 4. BACKEND FASTAPI ENDPOINTS VIA TESTCLIENT (Section 37 - Backend)
# =====================================================================
def test_backend_historical_endpoints_via_testclient():
    """Test 8: Backend historical router endpoints return valid contracts."""
    from fastapi.testclient import TestClient
    from app.main import app

    client = TestClient(app)

    # 1. Market summary
    res_mkt = client.get("/api/v1/historical/market-summary")
    assert res_mkt.status_code == 200
    mkt_json = res_mkt.json()
    assert mkt_json["data_mode"] == "HISTORICAL_DEVELOPMENT"
    target_set = {item["target"] for item in mkt_json["indices"]}
    assert "BPI" in target_set
    assert "BCI" in target_set
    assert any(item["target"] == "BPI" and item["provenance"] == "OBSERVED" for item in mkt_json["indices"])

    # 2. Historical dates
    res_dates = client.get("/api/v1/historical/dates")
    assert res_dates.status_code == 200
    dates_json = res_dates.json()
    assert len(dates_json["dates"]) > 1000
    assert dates_json["data_cutoff"] == "2019-07-31"

    # 3. Supported routes
    res_routes = client.get("/api/v1/historical/routes")
    assert res_routes.status_code == 200
    routes_json = res_routes.json()
    assert len(routes_json["routes"]) >= 5

    # 4. Historical forecast execution
    res_fc = client.post(
        "/api/v1/historical/forecast",
        json={
            "target": "BPI",
            "origin_date": "2019-05-15",
            "horizon_sessions": 28,
            "vessel_type": "Panamax"
        }
    )
    assert res_fc.status_code == 200
    fc_json = res_fc.json()
    assert fc_json["target"] == "BPI"
    assert fc_json["p10_calibrated"] <= fc_json["p50"] <= fc_json["p90_calibrated"]
    assert fc_json["actual_status"] == "OBSERVED"
    assert fc_json["actual_value"] is not None

    # 5. Route estimate execution
    first_route = routes_json["routes"][0]
    res_est = client.post(
        "/api/v1/historical/route-estimate",
        json={
            "target": "BPI",
            "origin_date": "2019-05-15",
            "horizon_sessions": 28,
            "route_id": first_route["route_id"],
            "cargo_type": "thermal_coal"
        }
    )
    assert res_est.status_code == 200
    est_json = res_est.json()
    assert est_json["scenario_p50"]["freight_usd_per_tonne"] > 0
    assert est_json["scenario_p50"]["voyage_days"] > 0
    assert "optimizer_payload" in est_json
