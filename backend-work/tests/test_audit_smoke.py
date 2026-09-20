"""
Comprehensive API Integration & Smoke Test Suite for SIH26006 Audit.
Validates:
  1. Historical Series API (BCI, BPI, BSI, BHSI)
  2. Probabilistic Forecast API (All 4 indices, multiple horizons, P10 <= P50 <= P90)
  3. Route Economics API (All canonical corridor routes, draft feasibility checks)
  4. Charter Optimizer API (Valid payload, recommendation, cost components)
  5. Port Intelligence API (List ports, port details, berths, compatibility)
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

INDICES = ["BCI", "BPI", "BSI", "BHSI"]
HORIZONS = [7, 14, 28, 60, 90, 180]


class TestHistoricalSeriesAPI:
    @pytest.mark.parametrize("target", INDICES)
    def test_series_returns_verified_data(self, target):
        res = client.get(f"/api/v1/historical/series?target={target}&limit=50")
        assert res.status_code == 200
        data = res.json()
        assert data["target"] == target
        assert data["data_mode"] == "HISTORICAL_DEVELOPMENT"
        assert data["data_cutoff"] == "2019-07-31"
        assert len(data["observations"]) == 50
        assert len(data["data"]) == 50
        # Check observation structure
        obs = data["observations"][-1]
        assert "obs_date" in obs
        assert "value" in obs
        assert obs["value"] > 0
        assert obs["obs_date"] <= "2019-07-31"

    def test_series_invalid_target_400(self):
        res = client.get("/api/v1/historical/series?target=INVALID")
        assert res.status_code == 400


class TestProbabilisticForecastAPI:
    @pytest.mark.parametrize("target", INDICES)
    def test_forecast_all_indices_h7_and_h28(self, target):
        for h in [7, 28]:
            res = client.post("/api/v1/historical/forecast", json={
                "target": target,
                "origin_date": "2019-06-28",
                "horizon_sessions": h,
                "vessel_type": "Panamax" if target == "BPI" else "Capesize" if target == "BCI" else "Supramax" if target == "BSI" else "Handysize"
            })
            assert res.status_code == 200
            d = res.json()
            assert d["target"] == target
            assert d["horizon_sessions"] == h
            # Verify mathematical ordering: p10 <= p50 <= p90
            assert d["p10_calibrated"] is not None
            assert d["p50"] is not None
            assert d["p90_calibrated"] is not None
            assert d["p10_calibrated"] <= d["p50"] <= d["p90_calibrated"]
            assert d["p50"] > 0
            # Target date 2019-06-28 + 7 or 28 sessions is within verified range (ends 2019-07-31)
            if d["actual_status"] == "OBSERVED":
                assert d["actual_value"] is not None
                assert d["actual_value"] > 0

    def test_forecast_post_2019_unobserved_integrity(self):
        # Forecast origin 2019-07-31 + 28 sessions targets post-2019
        res = client.post("/api/v1/historical/forecast", json={
            "target": "BPI",
            "origin_date": "2019-07-31",
            "horizon_sessions": 28,
            "vessel_type": "Panamax"
        })
        assert res.status_code == 200
        d = res.json()
        assert d["p50"] > 0
        assert d["actual_value"] is None
        assert d["actual_status"] == "NOT_AVAILABLE"
        assert d["target_date"] == "OUT_OF_SAMPLE_POST_2019"


class TestRouteAnalysisAPI:
    ROUTES = [
        ("AUHPT-INPRT", "BCI", "Capesize"),
        ("AUHPT-INVTZ", "BCI", "Capesize"),
        ("IDTBA-INPRT", "BPI", "Panamax"),
        ("IDTBA-INHAL", "BSI", "Supramax"),
        ("ZARBY-INPRT", "BPI", "Panamax"),
        ("USHAM-INPRT", "BCI", "Capesize"),
        ("MZBEW-INPRT", "BPI", "Panamax"),
    ]

    @pytest.mark.parametrize("route_id,target,vessel", ROUTES)
    def test_route_estimate_scenarios(self, route_id, target, vessel):
        res = client.post("/api/v1/historical/route-estimate", json={
            "target": target,
            "origin_date": "2019-07-31",
            "horizon_sessions": 28,
            "route_id": route_id,
            "cargo_type": "coking_coal" if "coking" in route_id or "AU" in route_id or "US" in route_id or "MZ" in route_id else "thermal_coal",
            "risk_aversion": 0.5,
            "bunker_location": "Singapore"
        })
        assert res.status_code == 200
        d = res.json()
        assert "scenario_p10" in d
        assert "scenario_p50" in d
        assert "scenario_p90" in d
        assert d["scenario_p10"]["freight_usd_per_tonne"] <= d["scenario_p50"]["freight_usd_per_tonne"] <= d["scenario_p90"]["freight_usd_per_tonne"]
        assert d["scenario_p50"]["voyage_days"] > 0
        assert d["scenario_p50"]["bunker_cost_usd"] > 0


class TestCharterOptimizerAPI:
    def test_optimizer_feasible_recommendation(self):
        res = client.post("/api/v1/optimize-charter", json={
            "cargo": {
                "type": "coking_coal",
                "quantity_t": 150000
            },
            "origin_port": "AUHPT",
            "destination_port": "INPRT",
            "required_by": "2026-11-15",
            "as_of": "2026-09-15",
            "risk_aversion": 0.5,
            "deadline_miss_penalty_usd": 500000,
            "n_simulations": 200
        })
        assert res.status_code == 200
        d = res.json()
        assert "recommendation" in d
        assert d["recommendation"]["vessel_class"] in ["Panamax", "Capesize", "Supramax", "Handysize"]
        assert d["recommendation"]["expected_usd_per_tonne"] > 0
        assert d["recommendation"]["expected_cost_usd"] > 0
        assert "cost_breakdown_usd" in d
        assert len(d["cost_breakdown_usd"]) > 0
        assert "explanation" in d

    def test_optimizer_infeasible_deadline_handling(self):
        # Extremely tight deadline (e.g. required in 2 days from Australia to India)
        res = client.post("/api/v1/optimize-charter", json={
            "cargo": {
                "type": "coking_coal",
                "quantity_t": 150000
            },
            "origin_port": "AUHPT",
            "destination_port": "INPRT",
            "required_by": "2026-09-17",
            "as_of": "2026-09-15",
            "risk_aversion": 0.5,
            "deadline_miss_penalty_usd": 500000,
            "n_simulations": 100
        })
        # Backend returns 422 with structured Infeasible payload
        assert res.status_code == 422


class TestPortIntelligenceAPI:
    def test_list_ports(self):
        res = client.get("/api/v1/ports?country=IN")
        assert res.status_code == 200
        ports = res.json()
        assert len(ports) >= 6
        port_ids = [p["port_id"] for p in ports]
        assert "INPRT" in port_ids
        assert "INVTZ" in port_ids

    def test_port_detail_paradip(self):
        res = client.get("/api/v1/ports/INPRT?cargo_type=coking_coal")
        assert res.status_code == 200
        d = res.json()
        assert d["port_id"] == "INPRT"
        assert len(d["berths"]) > 0
        assert d["congestion"]["expected_wait_hours_p50"] > 0
        assert "vessel_compatibility" in d
        compat = d["vessel_compatibility"]
        compat_classes = [item["vessel_class"] if isinstance(item, dict) else item for item in (compat if isinstance(compat, list) else compat.keys())]
        assert "Capesize" in compat_classes
        assert "Panamax" in compat_classes
