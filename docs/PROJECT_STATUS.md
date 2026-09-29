# SIH26006 Project Status Report — Production Hardening & ML Integration Pass

**Project Title:** Development of an Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement from Overseas to the East Coast of India  
**Ministry / Problem Statement:** Ministry of Ports, Shipping and Waterways / SIH26006  
**Status Date:** September 2026  
**Current Branch:** `feat/final-integration-frontend-polish`  
**Overall Readiness:** **SIH-Ready & Production-Hardened**

---

## 1. Executive Summary

This branch contains the production-hardened, reproducible implementation of the SIH26006 Intelligent Freight Forecasting & Charter Decision-Support System.

All core layers are operational and integrated:
1. **Machine Learning Pipeline:** 72 trained LightGBM quantile regression models (24 model artifacts across 4 Baltic vessel classes $\times$ 6 discrete horizons: 7, 14, 28, 60, 90, 180 days) calibrated using finite-sample split-conformal prediction intervals targeting an 80% coverage band ($P_{10}$ to $P_{90}$).
2. **ML Serving Adapter:** Production-safe `forecast_v2_adapter` serving authoritative ML predictions directly through `POST /api/v1/forecast`, with strict non-silent fallback enforcement and explicit provenance tracking.
3. **Backend Decision Engine:** FastAPI decision services including vessel feasibility evaluation, port constraint and draft validation, Sandheads lighterage transhipment modeling, Monte Carlo strategy simulation, CVaR-90 tail risk evaluation, and **backend-authoritative Tornado sensitivity analysis**.
4. **Data Integrity & Lineage:** Clean demarcation of observed historical data (2012-08-01 through 2019-07-31 from verified Mendeley Data CC-BY 4.0), synthetic demonstration extension (2020 through 2026), and model-generated probabilistic forecasts.
5. **Frontend Application:** 10 fully functional UI pages built in React + Vite with zero build errors and strict adherence to the "Backend owns all business logic" architectural rule.

---

## 2. Architecture & Implementation Map

```text
Cargo Requirement
        ↓
Market / Freight Forecast (LightGBM v2 + Conformal Calibration)
        ↓
Port Constraints (Draft, LOA, Beam, Berth Allocation, Lighterage)
        ↓
Vessel Feasibility (Intake ratios, parceling, deadweight checks)
        ↓
Feasible Charter Options (Spot vs Multi-Voyage COA, Sequential vs Parallel)
        ↓
Monte Carlo Strategy Simulation (Stochastic digital twin: freight, bunker, queue, weather)
        ↓
Risk-Adjusted Cost Ranking (Expected cost + λ × CVaR-90 + deadline miss penalty)
        ↓
Recommendation & Explanation ("Why This Decision?" plain-English attribution)
```

---

## 3. Component Inventory & Status

| Layer | Component | Status | Details |
|---|---|---|---|
| **ML Engine** | Quantile LightGBM Models | **Complete** | 72 quantile models (24 horizon/index artifacts in `ml-work/models/saved_models/v2/`) |
| **ML Engine** | Conformal Calibration | **Complete** | Split-conformal prediction intervals with empirical coverage tracking |
| **ML Engine** | Feature Pipeline | **Complete** | Momentum, rolling volatility, lags, Fourier seasonality, and cross-market signals |
| **Backend** | ML v2 Serving Adapter | **Complete** | `forecast_v2_adapter.py` loading real artifacts into `ForecastResponse` |
| **Backend** | Decision Optimizer | **Complete** | Stage 1–3 filter + Stage 4 Monte Carlo strategy ranking (`optimizer.py`) |
| **Backend** | Simulation Engine | **Complete** | Vectorized Monte Carlo digital twin with $N \in \{200, 500, 1000, 2500\}$ |
| **Backend** | Sensitivity Engine | **Complete** | Authoritative Tornado analysis under ±20% freight, ±15% bunker, ±30% queues |
| **Backend** | Health & Probes | **Complete** | `/health`, `/health/ready`, `/health/live`, `/sources/model-provenance` |
| **Frontend** | Executive Dashboard | **Complete** | Landed cost overview, market metrics, decision workflow banner |
| **Frontend** | Charter Planner | **Complete** | End-to-end cargo input to recommendation and explanation |
| **Frontend** | Freight Forecast | **Complete** | Interactive probabilistic cones with verified vs synthetic timeline labels |
| **Frontend** | Port Intelligence | **Complete** | Berth draft restrictions, Sandheads lighterage, seasonal weather |
| **Frontend** | Vessel Optimizer | **Complete** | Compatibility scoring across Capesize, Panamax, Supramax, Handysize |
| **Frontend** | Strategy Simulator | **Complete** | Monte Carlo trigger, cost distribution chart, backend sensitivity tornado |
| **Frontend** | Risk & Alerts | **Complete** | Port and route risk breakdowns with plain-English mitigation steps |
| **Deployment**| Packaging & Docker | **Complete** | Root `Dockerfile` & `docker-compose.yml` packaging backend + ML v2 artifacts |

---

## 4. Test Verification Summary

* **Pytest Suite:** **139 passed** in `backend-work/tests/`
* **Production Smoke Script:** `python scripts/verify_production.py` -> **8/8 checks passed**
* **Frontend Production Build:** `npm run build` in `frontend-work/` -> **0 errors, 0 unresolved imports**

---

## 5. Explicit Data Provenance & Boundary Declarations

To ensure institutional credibility, the system enforces unambiguous labeling:
* **`OBSERVED` (2012-08-01 → 2019-07-31):** Verified real Baltic Exchange daily assessments sourced from Mendeley Data (CC-BY 4.0).
* **`SYNTHETIC EXTENSION` (2020-01-01 → 2026-09-15):** Statistically calibrated Ornstein-Uhlenbeck extension used solely for demonstration and scenario evaluation. Never presented as real historical market history.
* **`FORECAST` (Post-T0 Horizon):** Model-generated quantiles ($P_{10}, P_{50}, P_{90}$) from trained LightGBM models.
* **`DERIVED`:** Landed costs, voyage durations, and route economics calculated via physical and accounting formulas.
* **`SIMULATED_DEMO`:** Waiting time queues and demo port calls calibrated to mimic empirical congestion.
