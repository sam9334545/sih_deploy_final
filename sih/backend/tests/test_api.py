"""Contract tests: the shapes the frontend is built against, and the error envelope."""
from __future__ import annotations

import pytest

V1 = "/api/v1"


def test_health_reports_fresh_data(client):
    j = client.get(f"{V1}/health").json()
    assert j["status"] == "ok"
    assert j["counts"]["ports"] > 0 and j["counts"]["berths"] > 0


def test_every_response_carries_as_of_and_a_request_id(client, base_request):
    r = client.post(f"{V1}/forecast", json={"vessel_class": "Supramax", "horizon_days": 28})
    assert r.headers["x-request-id"]
    j = r.json()
    assert j["as_of"] and j["request_id"] and j["provenance"] and j["assumptions"]


def test_a_supplied_request_id_is_echoed_back(client):
    r = client.get(f"{V1}/health", headers={"x-request-id": "abc-123"})
    assert r.headers["x-request-id"] == "abc-123"


@pytest.mark.parametrize("vessel_class,index", [
    ("Handysize", "BHSI"), ("Supramax", "BSI"), ("Panamax", "BPI"), ("Capesize", "BCI")])
def test_each_class_forecasts_its_own_index(client, vessel_class, index):
    j = client.post(f"{V1}/forecast",
                    json={"vessel_class": vessel_class, "horizon_days": 28}).json()
    assert j["index"] == index
    lo, hi = j["index_forecast"]["interval_80"]
    assert lo < j["index_forecast"]["point"] < hi
    assert 0 < j["confidence"] <= 1
    assert j["model_meta"]["validation_mase"] is not None


def test_a_route_forecast_returns_a_derived_usd_per_tonne_with_its_calibration(client):
    j = client.post(f"{V1}/forecast", json={
        "vessel_class": "Supramax", "horizon_days": 28,
        "route": {"origin_port": "AUHPT", "destination_port": "INPRT"}}).json()
    rate = j["usd_per_tonne"]
    assert rate["provenance"] == "derived"
    assert rate["calibration_mape"] and rate["calibration_route"]
    assert 2 < rate["point"] < 200            # a dry-bulk $/t, not a nonsense number
    assert rate["interval_80"][0] < rate["point"] < rate["interval_80"][1]


def test_unknown_vessel_class_is_a_400_with_the_allowed_values(client):
    r = client.post(f"{V1}/forecast", json={"vessel_class": "Handymax", "horizon_days": 28})
    assert r.status_code == 400
    j = r.json()
    assert j["error"] == "invalid_input" and j["field"] == "vessel_class" and j["request_id"]


def test_untrained_horizon_is_rejected_with_the_horizons_we_do_have(client):
    r = client.post(f"{V1}/forecast", json={"vessel_class": "Supramax", "horizon_days": 45})
    assert r.status_code == 400
    assert "7" in str(r.json()["message"])


def test_unknown_port_is_a_404_listing_the_registry(client):
    r = client.get(f"{V1}/ports/INXXX")
    assert r.status_code == 404
    assert "INPRT" in r.json()["allowed"]


def test_port_detail_carries_constraints_congestion_and_compatibility(client):
    j = client.get(f"{V1}/ports/INPRT").json()
    assert j["berths"] and all(b["source_url"] for b in j["berths"])
    assert j["congestion"]["sample_size"] > 0
    assert j["vessel_compatibility"]
    assert j["constraints_as_of"]


def test_haldia_declares_its_two_mode_lighterage_behaviour(client):
    j = client.get(f"{V1}/ports/INHAL").json()
    assert "Sandheads" in j["seasonal_notes"]


def test_vessel_classes_come_from_the_baltic_descriptions(client):
    rows = client.get(f"{V1}/vessels").json()
    assert {r["vessel_class"] for r in rows} == {"Handysize", "Supramax", "Panamax", "Capesize"}
    assert all("balticexchange" in r["source_url"] for r in rows)


def test_recommend_vessel_ranks_and_explains_rejections(client, base_request):
    j = client.post(f"{V1}/recommend-vessel", json=base_request).json()
    assert j["recommended"]["deadline_feasible"]
    assert j["recommended"]["binding_constraint"]
    for r in j["rejected"]:
        assert r["reason"] and r["detail"]


def test_an_impossible_cargo_returns_a_first_class_infeasible_answer(client):
    r = client.post(f"{V1}/recommend-vessel", json={
        "cargo": {"type": "iron_ore", "quantity_t": 50000}, "origin_port": "AUHPT",
        "destination_port": "INGPR", "required_by": "2026-12-01"})
    assert r.status_code == 422
    j = r.json()
    assert j["error"] == "infeasible_request"
    assert j["rejected"] and all(x["reason"] for x in j["rejected"])


def test_optimize_returns_a_costed_explained_recommendation(client, base_request):
    j = client.post(f"{V1}/optimize-charter",
                    json={**base_request, "n_simulations": 300}).json()
    rec = j["recommendation"]
    assert rec["expected_cost_usd"] > 0
    assert rec["interval_80_usd"][0] <= rec["expected_cost_usd"] <= rec["interval_80_usd"][1]
    assert rec["expected_cost_inr"] == pytest.approx(rec["expected_cost_usd"] * rec["fx_rate"],
                                                     rel=1e-6)
    assert rec["risk"] in ("LOW", "MEDIUM", "HIGH")
    assert len(j["explanation"]) >= 5
    assert j["cost_breakdown_usd"]["total"] == pytest.approx(rec["expected_cost_usd"], rel=1e-6)
    assert 0 <= j["opportunity"]["charter_opportunity_score"] <= 100


def test_simulate_compares_strategies_and_names_a_winner(client, base_request):
    j = client.post(f"{V1}/simulate-strategy",
                    json={**base_request, "n_simulations": 200}).json()
    assert j["winner"] == j["results"][0]["id"]
    costs = [r["risk_adjusted_cost"] for r in j["results"]]
    assert costs == sorted(costs)
    for r in j["results"]:
        c = r["cost"]
        assert c["p10"] <= c["p50"] <= c["p90"] <= c["cvar_90"]
    assert j["distributions"]["waiting_discharge"].startswith("Empirical bootstrap")


def test_simulation_is_reproducible_from_its_seed(client, base_request):
    body = {**base_request, "n_simulations": 200, "seed": 99}
    a = client.post(f"{V1}/simulate-strategy", json=body).json()
    b = client.post(f"{V1}/simulate-strategy", json=body).json()
    assert [r["cost"]["mean"] for r in a["results"]] == [r["cost"]["mean"] for r in b["results"]]


def test_opportunity_score_explains_itself(client, base_request):
    j = client.post(f"{V1}/opportunity-score",
                    json={**base_request, "n_simulations": 150}).json()
    assert 0 <= j["charter_opportunity_score"] <= 100
    assert j["verdict"] in ("charter_now", "monitor", "wait")
    assert len(j["window"]) == j["window_points"]
    assert j["attribution_usd"]["total"] is not None
    assert len(j["lambda_sensitivity"]) == 5


def test_market_dashboard_has_every_index_and_a_bunker_price(client):
    j = client.get(f"{V1}/market").json()
    assert {"BDI", "BCI", "BPI", "BSI", "BHSI"} <= set(j["indices"])
    assert j["bunker"]["value"] > 0 and j["fx"]["rate"] > 0
    assert j["availability_signal"]["Supramax"]["signal"] in ("TIGHT", "NORMAL", "LOOSE")


def test_risk_components_are_weighted_by_simulator_sensitivity(client):
    j = client.get(f"{V1}/risks", params={"port_id": "INPRT", "vessel_class": "Panamax",
                                          "month": 11}).json()
    assert j["overall"] in ("LOW", "MEDIUM", "HIGH")
    names = {c["name"] for c in j["components"]}
    assert names == {"market", "port", "weather", "vessel_availability", "route", "demand"}
    assert all(c["detail"] for c in j["components"])
    assert sum(c["weight"] for c in j["components"]) == pytest.approx(1.0, abs=0.05)
    assert j["what_would_change"]


def test_sources_registry_is_live_and_rates_availability(client):
    rows = client.get(f"{V1}/sources").json()
    assert rows and all(r["availability_rating"] in ("G", "Y", "O", "R") for r in rows)
    assert any(r["availability_rating"] == "R" for r in rows)   # we admit what we cannot get


def test_low_demand_strip_reads_the_regime_for_a_charterer(client):
    j = client.get(f"{V1}/market/low-demand", params={"vessel_class": "Supramax"}).json()
    assert len(j["strip"]) == 6
    assert all(s["regime"] in ("LOW", "NORMAL", "HIGH") for s in j["strip"])
    assert all(s["charterer_reading"] for s in j["strip"])


def test_backhaul_insight_prices_the_ballast_premium(client):
    j = client.get(f"{V1}/market/backhaul", params={
        "origin_port": "AUHPT", "destination_port": "INPRT", "vessel_class": "Supramax"}).json()
    assert j["ballast_premium_usd"] > 0
    assert j["better_backhaul_origins"]


def test_openapi_documents_every_versioned_route(client):
    paths = client.get("/openapi.json").json()["paths"]
    for p in ("/api/v1/forecast", "/api/v1/recommend-vessel", "/api/v1/optimize-charter",
              "/api/v1/simulate-strategy", "/api/v1/ports", "/api/v1/ports/{port_id}",
              "/api/v1/vessels", "/api/v1/market", "/api/v1/risks", "/api/v1/sources"):
        assert p in paths
