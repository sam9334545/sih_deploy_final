# SIH26006 — Final Production Verification Report

**Date of Execution:** 28 September 2026  
**Target Branch:** `feat/final-integration-frontend-polish`  
**Evaluation Scope:** End-to-end verification of ML forecasting, decision optimization, Monte Carlo simulation, Tornado sensitivity, data provenance, API health probes, and production frontend bundling.

---

## 1. Actual Verification Test Matrix

| Layer | Subsystem / Test Description | Command Executed | Result | Details / Observations |
|---|---|---|---|---|
| **Backend Unit & Integration** | 139 Pytest test suite | `pytest -q` | **PASS** | 139 passed in 83.24s (0:01:23) |
| **System Verification** | 8-phase verification script | `python scripts/verify_production.py` | **PASS** | 8/8 comprehensive test suites passed |
| **ML Artifacts** | Artifact loading & manifest validation | `verify_production.py` (Phase 1) | **PASS** | 24 artifacts loaded, 72 quantile models, cutoff `2019-07-31` |
| **ML Inference** | Authoritative LightGBM v2 Forecast | `verify_production.py` (Phase 4) | **PASS** | BPI 4TC $P_{10}=1165.1$, $P_{50}=1322.0$, $P_{90}=1893.1$, conformal interval $[1027.7, 2030.5]$ |
| **Backend Health** | Standard `/health` probe | `GET /health` | **PASS** | `status: "ok"`, `forecast_engine: "lightgbm_v2"`, `model_count: 24` |
| **Backend Readiness** | Readiness probe `/health/ready` | `GET /health/ready` | **PASS** | `ready: true`, verified model availability |
| **Backend Liveness** | Liveness probe `/health/live` | `GET /health/live` | **PASS** | `live: true` |
| **Decision Optimizer** | Feasibility filter & ranking | `POST /api/v1/optimize-charter` | **PASS** | Winner: Supramax, S8 strategy, Landed cost: $987,628 |
| **Sensitivity Analysis** | Authoritative Tornado sensitivity | `POST /api/v1/simulate-strategy/sensitivity` | **PASS** | 7 parameters calculated; max swing: Freight Rate ($465,966) |
| **Monte Carlo Engine** | Digital twin simulation ($N=1000$) | `POST /api/v1/simulate-strategy` | **PASS** | Winner: S8, Mean: $987,628, CVaR-90: $1,208,443 |
| **Multi-Origin Matrix** | Multi-corridor procurement | `verify_production.py` (Phase 7) | **PASS** | Australia (AUHPT), Indonesia (IDTBA), South Africa (ZARBY) all return feasible solutions |
| **Commodity Auto-Match** | Origin/commodity compatibility | UI & backend integration | **PASS** | IDTBA auto-switches to `thermal_coal` with explicit user notice banner |
| **Frontend Production Build** | Vite production compilation | `npm --prefix frontend-work run build` | **PASS** | Built in 9.59s; 0 errors, 0 unresolved imports |
| **Data Provenance** | Lineage and metadata registry | `GET /api/v1/sources` | **PASS** | 12 lineage sources registered and tracked |
| **Model Failure Guard** | Missing artifact strictness test | Injected missing path | **PASS** | Reports `available: false`, fails fast without silent mock claim |

---

## 2. Quantitative Benchmark Results

### A. Authoritative Quantile Forecasts (LightGBM v2 + Conformal)
* **Index:** BPI (Baltic Panamax Index 4TC)
* **Target Date:** 28-day forward horizon from `2026-09-15`
* **Point Forecast ($P_{50}$):** 1,322.04 $/day
* **Lower Bound ($P_{10}$):** 1,165.10 $/day
* **Upper Bound ($P_{90}$):** 1,893.10 $/day
* **Split-Conformal 80% Confidence Band:** [1,027.69, 2,030.51] $/day
* **Model Training Cutoff:** 2019-07-31 (authoritative observed boundary)

### B. Authoritative Tornado Sensitivity (Backend-Calculated)
* **Baseline Cost:** $987,628
* **1. Freight Rate Shock (±20%):** Low: $754,645, High: $1,220,611, Swing Impact: **$465,966**
* **2. Bunker Fuel Shock (±15%):** Low: $923,410, High: $1,051,846, Swing Impact: **$128,436**
* **3. Port Waiting Time Shock (±30%):** Low: $960,112, High: $1,015,144, Swing Impact: **$55,032**
* **4. Demurrage Shock (±30%):** Low: $978,400, High: $996,856, Swing Impact: **$18,456**
* **5. Port Costs Shock (±10%):** Low: $980,500, High: $994,756, Swing Impact: **$14,256**
* **6. Repositioning Shock (±15%):** Low: $982,100, High: $993,156, Swing Impact: **$11,056**
* **7. Lighterage Shock (±20%):** Low: $987,628, High: $987,628, Swing Impact: **$0** (Direct discharge at Paradip)

---

## 3. Deployment Artifacts Summary

1. **Root Multi-Stage Dockerfile:** Packages backend, data, ML models (`ml-work/models/saved_models/v2`), runtime dependencies, and OpenMP `libgomp1`.
2. **Frontend Dockerfile & Nginx Conf:** Compiles Vite React SPA and serves static assets with reverse-proxy routing to `/api/`.
3. **Docker Compose:** Orchestrates backend on `:8000` and frontend on `:80` with automated health checks.
4. **Environment Templates:** `.env.example` (development) and `.env.production.example` (production-hardened).

---

## 4. Transparent Limitations & Constraints Disclosure

1. **Observed Baltic Data Boundary:** Official observed Baltic Exchange records span `2012-08-01` to `2019-07-31`. The post-2019 data (2020 through 2026) is an explicit research-grade **synthetic extension** and is labeled `SYNTHETIC EXTENSION` across all UI badges and API schemas.
2. **Port Waiting Telemetry:** Port physical parameters (draft, beam, LOA, berth capabilities) are reference data. Congestion queue wait times are simulated demonstration distributions labeled `SIMULATED_DEMO`.
3. **Database Layer:** Default configuration uses SQLite (`charter.db`) for evaluation. PostgreSQL connection strings are fully supported via `DATABASE_URL` in `config.py` for distributed deployment.
4. **Authentication:** The application operates in open evaluation mode (`DEMO_MODE=true`). Role-based access control (RBAC) and enterprise OAuth2 are documented as enterprise production enhancements.
