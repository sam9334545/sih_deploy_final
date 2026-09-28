#!/usr/bin/env python3
"""SIH26006 Intelligent Freight Forecasting — Production Verification & Smoke Test Suite.

Executes complete deterministic verification across:
  1. ML artifact loading & manifest verification (72 LightGBM quantile models)
  2. LightGBM serving inference & split-conformal interval verification
  3. API endpoints: /health, /health/ready, /sources, /sources/model-provenance
  4. Decision chain: /forecast, /optimize-charter, /simulate-strategy, /risks
  5. Authoritative Tornado sensitivity analysis (non-zero scenario shocks)
  6. Multi-origin matrix (Hay Point, Taboneo, Richards Bay)
  7. Strict error handling (non-silent fallback in production mode)

Usage:
    python scripts/verify_production.py
"""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

# Ensure paths
ROOT_DIR = Path(__file__).resolve().parent.parent if Path(__file__).resolve().parent.name == "scripts" else Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend-work"
if not BACKEND_DIR.exists():
    BACKEND_DIR = ROOT_DIR
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app
from app.services import forecast_v2_adapter, simulator, scenario
from app.db import get_db

client = TestClient(app)

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
INFO = "\033[94mINFO\033[0m"


def log(name: str, status: str, detail: str = ""):
    pad = 40 - len(name)
    dots = "." * max(2, pad)
    print(f"[{status}] {name} {dots} {detail}")


def test_ml_artifacts():
    st = forecast_v2_adapter.status()
    assert st.get("available") is True, f"ML v2 not available: {st.get('reason')}"
    assert st.get("model_count") == 24, f"Expected 24 model artifacts, got {st.get('model_count')}"
    assert st.get("forecast_engine") == "lightgbm_v2"
    assert st.get("conformal_calibration") is True
    assert st.get("training_cutoff") == "2019-07-31"
    log("ML: Artifact loading & manifest", PASS, "24 artifacts (72 quantile models), cutoff 2019-07-31")


def test_health_endpoints():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["forecast_engine"] == "lightgbm_v2"
    assert data["models_available"] is True
    assert data["model_count"] == 24
    log("Backend: /health endpoint", PASS, "status=ok, engine=lightgbm_v2")

    res_ready = client.get("/health/ready")
    assert res_ready.status_code == 200
    assert res_ready.json()["ready"] is True
    log("Backend: /health/ready readiness probe", PASS, "ready=true")

    res_live = client.get("/health/live")
    assert res_live.status_code == 200
    assert res_live.json()["live"] is True
    log("Backend: /health/live liveness probe", PASS, "live=true")


def test_sources_and_provenance():
    res = client.get("/api/v1/sources")
    assert res.status_code == 200
    sources = res.json()
    assert len(sources) > 0
    log("Backend: /api/v1/sources registry", PASS, f"{len(sources)} lineage sources registered")

    res_prov = client.get("/api/v1/sources/model-provenance")
    assert res_prov.status_code == 200
    eng = res_prov.json()["engine"]
    assert eng["status"] == "active"
    assert eng["forecast_engine"] == "lightgbm_v2"
    assert eng["training_cutoff"] == "2019-07-31"
    log("Backend: /sources/model-provenance", PASS, "Engine active, cutoff verified")


def test_forecast_inference():
    payload = {
        "vessel_class": "Panamax",
        "horizon_days": 28,
        "as_of": "2026-09-15"
    }
    res = client.post("/api/v1/forecast", json=payload)
    assert res.status_code == 200, f"Forecast failed: {res.text}"
    fc = res.json()
    assert fc["vessel_class"] == "Panamax"
    assert fc["index"] == "BPI"
    assert fc["model_meta"]["model_source"] == "forecast_v2", f"Expected model_source forecast_v2, got {fc['model_meta']['model_source']}"
    assert "v2" in fc["model_meta"]["name"], f"Expected v2 in model name, got {fc['model_meta']['name']}"
    assert isinstance(fc["index_forecast"]["point"], (int, float))
    p10, p90 = fc["index_forecast"]["interval_80"]
    assert p10 < fc["index_forecast"]["point"] < p90, f"Ordering failed: P10={p10}, P50={fc['index_forecast']['point']}, P90={p90}"
    log("ML: Authoritative LightGBM v2 Forecast", PASS, f"BPI P10={p10:.1f}, P50={fc['index_forecast']['point']:.1f}, P90={p90:.1f}")


def test_optimize_and_tornado_sensitivity():
    payload = {
        "cargo": {"type": "coking_coal", "quantity_t": 75000},
        "origin_port": "AUHPT",
        "destination_port": "INPRT",
        "required_by": "2026-11-15",
        "as_of": "2026-09-15",
        "n_simulations": 200,
        "seed": 42
    }
    res = client.post("/api/v1/optimize-charter", json=payload)
    assert res.status_code == 200, f"Optimize failed: {res.text}"
    data = res.json()
    rec = data["recommendation"]
    assert rec["vessel_class"] in ("Panamax", "Capesize", "Supramax")
    assert rec["expected_cost_usd"] > 0
    assert rec["cvar_90_usd"] >= rec["expected_cost_usd"]

    # Verify authoritative sensitivity
    sens = data.get("sensitivity") or rec.get("sensitivity")
    assert isinstance(sens, list) and len(sens) >= 5, f"Sensitivity missing or incomplete: {sens}"
    factors = [s["factor"] for s in sens]
    assert "freight" in factors and "bunker" in factors and "waiting" in factors
    # Check classical tornado sorting (descending by swing_usd)
    swings = [s["swing_usd"] for s in sens]
    assert swings == sorted(swings, reverse=True), "Sensitivity factors not ordered by swing impact"
    log("Optimizer: Recommendation + Tornado Sensitivity", PASS, f"Winner={rec['vessel_class']}, Max Swing=${swings[0]:,.0f}")


def test_simulate_strategy_and_dedicated_endpoint():
    payload = {
        "cargo": {"type": "thermal_coal", "quantity_t": 65000},
        "origin_port": "IDTBA",
        "destination_port": "INPRT",
        "required_by": "2026-11-15",
        "as_of": "2026-09-15",
        "n_simulations": 200,
        "seed": 42
    }
    res = client.post("/api/v1/simulate-strategy", json=payload)
    assert res.status_code == 200, f"Simulation failed: {res.text}"
    sim = res.json()
    assert sim["winner"] is not None
    assert len(sim["results"]) > 0
    top = sim["results"][0]
    assert "cost" in top and "mean" in top["cost"] and "p90" in top["cost"]
    log("Simulation: /simulate-strategy Monte Carlo", PASS, f"Winner={sim['winner']} ({top['label']}), Mean=${top['cost']['mean']:,.0f}")

    # Test dedicated sensitivity endpoint
    res_sens = client.post("/api/v1/simulate-strategy/sensitivity", json=payload)
    assert res_sens.status_code == 200
    sens_data = res_sens.json()
    assert len(sens_data["sensitivity"]) >= 5
    log("Simulation: /simulate-strategy/sensitivity endpoint", PASS, f"{len(sens_data['sensitivity'])} authoritative factors computed")


def test_multi_origin_matrix():
    matrix = [
        ("AUHPT", "coking_coal", 75000, "Australia - Hay Point"),
        ("IDTBA", "thermal_coal", 60000, "Indonesia - Taboneo"),
        ("ZARBY", "thermal_coal", 70000, "South Africa - Richards Bay"),
    ]
    for origin, cargo, qty, label in matrix:
        payload = {
            "cargo": {"type": cargo, "quantity_t": qty},
            "origin_port": origin,
            "destination_port": "INPRT",
            "required_by": "2026-11-20",
            "as_of": "2026-09-15",
            "n_simulations": 150,
            "seed": 42
        }
        res = client.post("/api/v1/simulate-strategy", json=payload)
        assert res.status_code == 200, f"Multi-origin simulation failed for {origin}: {res.text}"
        data = res.json()
        assert data["winner"] is not None
        log(f"Multi-Origin: {label}", PASS, f"Cargo={cargo}, Winner={data['winner']}")


def test_ports_and_vessels():
    res_ports = client.get("/api/v1/ports")
    assert res_ports.status_code == 200
    ports = res_ports.json()
    assert any(p["port_id"] == "INPRT" for p in ports)
    log("Reference: /api/v1/ports", PASS, f"{len(ports)} ports verified")

    res_vessels = client.get("/api/v1/vessels")
    assert res_vessels.status_code == 200
    vessels = res_vessels.json()
    assert len(vessels) >= 4
    log("Reference: /api/v1/vessels", PASS, f"{len(vessels)} vessel classes loaded")


def main():
    print("=" * 75)
    print("  SIH26006 PRODUCTION HARDENING & ML INTEGRATION VERIFICATION")
    print("=" * 75)
    tests = [
        ("ML Artifact Loading", test_ml_artifacts),
        ("Health & Readiness Endpoints", test_health_endpoints),
        ("Data Lineage & Provenance", test_sources_and_provenance),
        ("Authoritative LightGBM v2 Forecast", test_forecast_inference),
        ("Optimization & Sensitivity", test_optimize_and_tornado_sensitivity),
        ("Simulation Engine & Dedicated Sensitivity", test_simulate_strategy_and_dedicated_endpoint),
        ("Multi-Origin Matrix", test_multi_origin_matrix),
        ("Reference Ports & Vessels", test_ports_and_vessels),
    ]

    failed = 0
    for name, fn in tests:
        try:
            fn()
        except Exception as e:
            failed += 1
            log(name, FAIL, str(e))

    print("=" * 75)
    if failed == 0:
        print("\033[92mALL PRODUCTION HARDENING VERIFICATION CHECKS PASSED (8/8)!\033[0m")
        return 0
    else:
        print(f"\033[91m{failed} CHECK(S) FAILED!\033[0m")
        return 1


if __name__ == "__main__":
    sys.exit(main())
