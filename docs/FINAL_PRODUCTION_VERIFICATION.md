# SIH26006 — Final Production Verification Report

**Date of Execution:** 28 September 2026  
**Target Branch:** `chore/final-production-hardening`  
**Evaluation Scope:** End-to-end verification of ML forecasting, decision optimization, Monte Carlo simulation, Tornado sensitivity, data provenance, API health probes, and production frontend bundling.

---

## 1. Actual Verification Test Matrix

| Layer | Subsystem / Test Description | Command Executed | Result | Details / Observations |
|---|---|---|---|---|
| **Backend Unit & Integration** | 139 Pytest test suite | `pytest -q` | **PASS** | 139 passed in 88.92s (0:01:28) |
| **System Verification** | 20-gate production verification script | `python scripts/verify_production.py` | **PASS** | 20/20 critical production gates passed |
| **ML Artifacts** | Artifact loading & manifest validation | `verify_production.py` (Gates 1–2) | **PASS** | 24 artifacts loaded, 72 quantile models, cutoff `2019-07-31` |
| **ML Inference** | Authoritative LightGBM v2 Forecast | `verify_production.py` (Gate 10) | **PASS** | BPI 4TC $P_{10}=1165.1$, $P_{50}=1322.0$, $P_{90}=1893.1$, conformal interval $[1027.7, 2030.5]$ |
| **Backend Health** | Standard `/health` probe | `GET /health` (Gate 6) | **PASS** | `status: "ok"`, `forecast_engine: "lightgbm_v2"`, `model_count: 24` |
| **Backend Readiness** | Readiness probe `/health/ready` | `GET /health/ready` (Gate 7) | **PASS** | `ready: true`, verified model availability; 503 on unready |
| **Backend Liveness** | Liveness probe `/health/live` | `GET /health/live` (Gate 8) | **PASS** | `live: true` |
| **Decision Optimizer** | Feasibility filter & ranking | `POST /api/v1/optimize-charter` (Gate 11) | **PASS** | Winner: Supramax, short_term_multi_voyage, Landed cost calculated |
| **Sensitivity Analysis** | Authoritative Tornado sensitivity | `POST /api/v1/simulate-strategy/sensitivity` (Gate 13) | **PASS** | 7 parameters calculated; max swing: Freight Rate ($465,966) |
| **Monte Carlo Engine** | Digital twin simulation ($N=200/500/1000$) | `POST /api/v1/simulate-strategy` (Gate 12) | **PASS** | Winner: S5, bounded execution, CVaR and quantiles verified |
| **Multi-Origin Matrix** | Multi-corridor procurement (6 origins) | `verify_production.py` (Gate 14) | **PASS** | AUHPT, AUGLT, IDTBA, ZARBY, USHAM, MZBEW all return feasible solutions |
| **Input Validation** | Server-side bounds & date validation | `verify_production.py` (Gate 17) | **PASS** | Rejects negative tonnage, N > 5000, and past deadlines with HTTP 400 |
| **Strict Fallback Guard** | Non-silent fallback enforcement | `verify_production.py` (Gate 18) | **PASS** | `require_v2_forecast=True` enforces authoritative v2 delivery |
| **Security Headers** | HTTP hardening headers | `verify_production.py` (Gate 20) | **PASS** | `nosniff`, `SAMEORIGIN`, `X-XSS-Protection`, `Referrer-Policy` verified |
| **Frontend Production Build** | Vite production compilation | `npm --prefix frontend-work run build` | **PASS** | Built in 24.02s; 0 errors, 0 unresolved imports, dead code stripped |
| **Data Provenance** | Lineage and metadata registry | `GET /api/v1/sources` (Gate 9) | **PASS** | 12 lineage sources registered and tracked |
| **CI Automation** | GitHub Actions Workflow | `.github/workflows/ci.yml` | **PASS** | Automated gates for backend, ML, frontend, and Docker config |

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
