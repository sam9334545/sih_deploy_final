# Phase 6B — Historical Backtest & End-to-End System Integration Report
**Project:** SIH26006 — Intelligent freight forecasting for optimized vessel chartering and bulk cargo procurement from overseas to East Coast of India ports  
**Author:** Antigravity (Lead ML + Backend + Frontend Integration Engineer)  
**Date:** September 2026  
**Status:** COMPLETED & VERIFIED (Path B — Historical Development Mode)

---

## 1. Executive Summary & Objective

Phase 6B connects and validates the entire software pipeline for SIH26006 end-to-end:
$$\text{Historical Baltic Observations} \longrightarrow \text{Leakage-Safe Feature Builder} \longrightarrow \text{Quantile LightGBM } (P_{10}/P_{50}/P_{90}) \longrightarrow \text{Split Conformal Calibrator} \longrightarrow \text{FastAPI Backend} \longrightarrow \text{Route Translation} \longrightarrow \text{Voyage Physics} \longrightarrow \text{Charter Optimizer} \longrightarrow \text{Interactive Frontend}$$

The explicit objective of Phase 6B was **not** to redesign the machine learning models or synthesize fake post-2019 observations, but to demonstrate that:
1. The 72 Phase 5 Quantile LightGBM models load and generate valid predictions with monotonic quantile hierarchy ($P_{10} \le P_{50} \le P_{90}$).
2. Split conformal prediction bounds operate accurately on out-of-sample historical origin dates with zero look-ahead bias.
3. The route layer maps vessel classes to indices, computes physical voyage economics (fuel consumption, steaming time, hire costs), and passes cost distributions to the decision engine.
4. The frontend UI provides an interactive interface displaying data provenance badges, historical backtest evaluation metrics, route analyses, and risk-adjusted charter optimizations.

---

## 2. Data Decision: Path B Adopted

In strict accordance with **Section 1 (Absolute Data Integrity Rule)** and **Section 6 (Data Decision Tree)**:
- A comprehensive provenance audit of open repositories was conducted. Baltic Exchange dry-bulk sub-indices ($BCI, BPI, BSI, BHSI$) post-July 2019 are proprietary commercial benchmarks requiring commercial licensing.
- Composite Baltic Dry Index ($BDI$) was identified in some public repositories, but $BDI \ne BCI/BPI/BSI/BHSI$ and cannot replace sub-indices.
- **Decision:** In full compliance with project rules prohibiting synthetic data fabrication or label manipulation, **PATH B** was adopted.
- The system operates strictly on the verified **2012-08-01 through 2019-07-31** dataset (`mendeley_baltic_subindices_2012_2019.csv`).
- Target realizations for forecast horizons extending past 2019-07-31 are explicitly declared:
  ```text
  NOT_AVAILABLE
  ```
  with zero fabrication. The application displays a prominent, persistent banner:
  ```text
  HISTORICAL DEVELOPMENT MODE (Coverage: 2012-08-01 → 2019-07-31)
  ```

---

## 3. Dataset Provenance & Boundary Audit

| Metric / Dimension | Specification |
| :--- | :--- |
| **Dataset Source** | Mendeley Data Dry Bulk Multivariate Time Series |
| **Citation / DOI** | DOI: 10.17632/m645w433cx.1 |
| **Target Sub-Indices** | Baltic Capesize (`BCI`), Panamax (`BPI`), Supramax (`BSI`), Handysize (`BHSI`) |
| **Temporal Coverage** | 2012-08-01 to 2019-07-31 |
| **Session Count** | 1,749 verified official Baltic Exchange trading days |
| **Chronological Partitions** | Warmup (2012-08-01 to 2012-12-10), Train (2012-12-11 to 2017-07-31), Validation (2017-08-01 to 2018-07-31), Test (2018-08-01 to 2019-07-31) |
| **License / Terms** | CC BY 4.0 Open Data Attribution |
| **Integrity Audit** | Zero synthetic interpolation, zero forward data leakage, zero look-ahead bias |

---

## 4. ML Inference Architecture

The ML inference service is housed in [`ml-work/models/inference.py`](file:///c:/Users/win11/Downloads/sih/ml-work/models/inference.py):
1. **Model Persistence:** All 72 quantile models ($4 \text{ targets} \times 6 \text{ horizons} \times 3 \text{ quantiles}$) were pre-trained across discrete horizons ($h \in \{7, 14, 28, 60, 90, 180\}$ sessions) and serialized into [`ml-work/models/saved_models/`](file:///c:/Users/win11/Downloads/sih/ml-work/models/saved_models/) via `joblib`. Cold-start inference latency dropped from ~2.5s to **~35ms**.
2. **On-the-Fly Feature Construction:** Given an origin date $T$, the service queries `features.builder.build_features_for_row()` to construct the 39 backward-looking features using strictly observations at $t \le T$.
3. **Quantile Monotonicity Enforcement:** Predictions are passed through `enforce_monotonic_quantiles()` (Chernozhukov et al. quantile rearrangement) ensuring:
   $$P_{10}^{\text{raw}} \le P_{50}^{\text{raw}} \le P_{90}^{\text{raw}}$$
4. **Split Conformal Calibration:** Frozen validation adjustments ($\hat{q}$) from [`ml-work/reports/phase5_calibration_results.csv`](file:///c:/Users/win11/Downloads/sih/ml-work/reports/phase5_calibration_results.csv) expand the prediction intervals to satisfy the 80% coverage guarantee:
   $$P_{10}^{\text{cal}} = P_{10}^{\text{mono}} - \hat{q}, \quad P_{90}^{\text{cal}} = P_{90}^{\text{mono}} + \hat{q}$$
5. **Contract Conversion:** The result encapsulates both evaluation metrics and converts cleanly to `MarketForecast` for downstream route estimation.

---

## 5. Backend Integration & API Flow

The FastAPI backend ([`backend-work/app/routers/historical.py`](file:///c:/Users/win11/Downloads/sih/backend-work/app/routers/historical.py)) was mounted under `/api/v1/historical` in [`app/main.py`](file:///c:/Users/win11/Downloads/sih/backend-work/app/main.py):

```text
Frontend Client
     │
     ├── GET  /api/v1/historical/market-summary  ──> Returns latest observed BCI/BPI/BSI/BHSI (2019-07-31)
     ├── GET  /api/v1/historical/dates           ──> Returns valid historical origin dates
     ├── POST /api/v1/historical/forecast        ──> Generates P10/P50/P90 + backtest evaluation
     ├── GET  /api/v1/historical/routes          ──> Lists verified shipping corridors (distances, ports)
     ├── POST /api/v1/historical/route-estimate  ──> Runs voyage economics & port compatibility
     └── POST /api/v1/optimize-charter           ──> Existing optimizer strategy ranking
```

---

## 6. Route-Aware Translation & Economics

The route layer connects macro index levels to East Coast of India discharge corridors without arbitrary multipliers:
- **Vessel to Index Mapping:**
  - Capesize $\to$ BCI
  - Panamax $\to$ BPI
  - Supramax $\to$ BSI
  - Handysize $\to$ BHSI
- **Market-to-TCE Translation:** Converts forecasted index levels to daily Time Charter Equivalent earnings (\$/day).
- **Voyage Physics:**
  $$\text{Sea Days} = \frac{\text{Distance (NM)}}{\text{Operational Speed (knots)} \times 24}$$
  $$\text{Port Days} = \frac{\text{Cargo Lifted}}{\text{Loading Rate}} + \frac{\text{Cargo Lifted}}{\text{Discharge Rate}} + \text{Port Waiting Days}$$
  $$\text{Fuel Consumed} = (\text{Sea Days} \times \text{Sea MT/day}) + (\text{Port Days} \times \text{Port MT/day})$$
  $$\text{Freight (\$/tonne)} = \frac{\text{Hire Cost} + \text{Bunker Cost} + \text{Port Tariffs}}{\text{Cargo Lifted}}$$
- **Port Compatibility Check:** Evaluates draft, LOA, beam, and cargo handling constraints across Indian discharge ports (Paradip, Haldia, Visakhapatnam, Krishnapatnam, Dhamra).

---

## 7. Frontend Architecture

A modern React 18 + Vite dashboard was engineered in [`frontend-work/`](file:///c:/Users/win11/Downloads/sih/frontend-work/):
1. **Persistent Data Mode Banner:** Declares `HISTORICAL DEVELOPMENT MODE` with coverage boundaries and DOI provenance.
2. **Market Dashboard (`Dashboard.jsx`):** Real observed metrics for BCI, BPI, BSI, BHSI with quick-select buttons.
3. **Historical Forecast & Backtest (`HistoricalForecast.jsx`):**
   - Inputs: Vessel class, forecast origin date ($T$), and discrete horizon ($h$).
   - Outputs: $P_{10}$, $P_{50}$, $P_{90}$ raw and calibrated.
   - Interactive visual interval track showing the 80% coverage band vs realization.
   - Error verification card displaying Absolute Error, Percentage Error, and interval coverage status when $T+h \le 2019-07-31$, or `NOT_AVAILABLE` when post-cutoff.
4. **Route Analysis (`RouteAnalysis.jsx`):** Corridor selection, voyage physics breakdown (sea days, port days, fuel cost, $/tonne freight), port constraint checks, and bunker status (`DEMO_ONLY`).
5. **Charter Optimizer (`CharterOptimizer.jsx`):** Risk-aversion slider ($\lambda \in [0, 1]$), total cargo requirement, consecutive voyages vs spot fixtures comparison, and optimizer recommendations.

---

## 8. Anti-Leakage Verification

Section 36 requires an automated test proving future data modifications cannot change features computed at the forecast origin.
- **Implementation:** [`ml-work/tests/test_phase6b_integration.py::test_future_data_modification_leaves_origin_features_invariant`](file:///c:/Users/win11/Downloads/sih/ml-work/tests/test_phase6b_integration.py)
- **Mechanism:**
  1. Features are built at origin $T =$ `2019-05-15`.
  2. All future observations ($t > T$) are perturbed with extreme values ($999,999$ pts).
  3. Features are recomputed at origin $T$ from the perturbed dataset.
  4. Exact numerical equality across all 39 feature values is verified:
     $$\max |x_{\text{orig}} - x_{\text{pert}}| = 0.000000000000$$

---

## 9. Provenance Taxonomy

Every data point rendered across the API and frontend carries an explicit provenance tag:
- **`OBSERVED`:** Real historical Baltic Exchange daily observation from Mendeley Data (2012–2019).
- **`DERIVED`:** Computed via Quantile LightGBM, Conformal Calibration, or Voyage Physics equations.
- **`ASSUMED`:** Engineering parameter (e.g. vessel speed of 12.5 knots, standard port waiting times).
- **`DEMO_ONLY`:** Placeholder test fixture (e.g. Rotterdam/Singapore VLSFO demo bunker feed).
- **`NOT_AVAILABLE`:** Genuine unobserved market state (e.g. post-2019 Baltic sub-indices). Never fabricated.

---

## 10. Test Verification Results

### A. Machine Learning Test Suite
```bash
pytest ml-work/tests/ -v
============================= 64 passed in 32.33s =============================
```
- 56/56 existing tests from Phase 1 through 6A preserved without modification.
- 8 new integration and anti-leakage tests added and passing:
  - `test_future_data_modification_leaves_origin_features_invariant` (PASSED)
  - `test_ml_inference_model_loading_and_forecast_generation` (PASSED)
  - `test_ml_inference_quantile_monotonicity_ordering` (PASSED)
  - `test_ml_inference_invalid_inputs_fail_gracefully` (PASSED)
  - `test_historical_actual_evaluation_inside_and_outside_cutoff` (PASSED)
  - `test_route_layer_receives_market_forecast_and_computes_freight` (PASSED)
  - `test_optimizer_adapter_payload_from_route_estimate` (PASSED)
  - `test_backend_historical_endpoints_via_testclient` (PASSED)

### B. Backend Test Suite
```bash
cd backend-work
pytest tests/ -v
============================= 78 passed in 22.40s =============================
```
- All 78 original backend tests continue passing with 100% green status.

### C. Frontend Production Build
```bash
cd frontend-work
npm run build
✓ 1598 modules transformed.
dist/index.html                   1.07 kB │ gzip:  0.62 kB
dist/assets/index-BmQFegCg.css    3.05 kB │ gzip:  1.24 kB
dist/assets/index-DxVtFa8u.js   201.52 kB │ gzip: 58.93 kB
✓ built in 5.44s
```

---

## 11. Known Limitations

1. **Temporal Cutoff:** The verified dataset concludes on 2019-07-31. Post-2019 predictions cannot be verified against open-source actuals without commercial Baltic Exchange subscriptions.
2. **Bunker Price Feed:** Real historical bunker prices at Singapore/Fujairah are currently fed via `DemoBunkerDataProvider` (`DEMO_ONLY`).
3. **Route Corridors:** Route options are limited to the 5 verified corridors in `SUPPORTED_ROUTES`. Unverified routes are rejected.

---

## 12. Future Post-2020 Data Integration Plan

When legitimate commercial post-2020 Baltic sub-index data is acquired:
1. Place raw CSV in `ml-work/data/raw/` and document DOI/provenance.
2. Re-run `run_pipeline.py` to produce updated `real_baltic_multivariate.csv`.
3. Retrain the 72 Quantile LightGBM models across updated chronological splits (e.g. Train: 2015–2022, Val: 2023–2024, Test: 2025–present).
4. Save models into `ml-work/models/saved_models/`.
5. Update `data_cutoff` parameter in config.
6. The entire frontend, backend API, route layer, and optimizer will immediately operate on live data with **zero architectural redesign**.

---

## 13. File Change Audit

- **Untouched Reference Snapshot:** `sih/` (100% untouched)
- **Modified Backend Files:**
  - `backend-work/app/main.py` (mounted historical router)
  - `backend-work/app/routers/historical.py` (created historical API router)
- **Modified ML Files:**
  - `ml-work/models/inference.py` (added singleton accessor and `to_market_forecast()` method)
  - `ml-work/tests/test_phase6b_integration.py` (new integration test suite)
- **Frontend Files Created (`frontend-work/`):**
  - `package.json`, `vite.config.js`, `index.html`
  - `src/index.css`
  - `src/main.jsx`, `src/App.jsx`
  - `src/components/Header.jsx`, `src/components/ProvenanceBadge.jsx`
  - `src/pages/Dashboard.jsx`, `src/pages/HistoricalForecast.jsx`, `src/pages/RouteAnalysis.jsx`, `src/pages/CharterOptimizer.jsx`

---

## 14. Reproducibility & Run Commands

### 1. ML Tests & Anti-Leakage Verification
```bash
# Run all 64 ML & integration tests
pytest ml-work/tests/ -v
```

### 2. Backend Server & Tests
```bash
# Run backend test suite
cd backend-work
pytest tests/ -v

# Launch backend API server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Web Application
```bash
cd frontend-work
# Install dependencies
npm install

# Start Vite development server
npm run dev
# Open http://localhost:5173
```
