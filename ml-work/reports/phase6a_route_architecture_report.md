# SIH26006 — Phase 6A: Route-Aware Forecasting, Market-to-Route Translation & Chartering Layer Report

**Project Title:** Intelligent Freight Forecasting for Optimized Vessel Chartering & Bulk Cargo Procurement  
**Problem Statement ID:** SIH26006  
**Auditor / Architect:** Senior ML / Time-Series Systems Engineer  
**Component:** `ml-work/route`  
**Date:** 2026-09-19  
**Status:** COMPLETE — ARCHITECTURE & ADAPTERS IMPLEMENTED, 100% PASS RATE ACROSS ALL 56 ML TESTS AND 78 BACKEND TESTS  

---

## 1. Existing Architecture Discovered

During Step 1 of Phase 6A, a thorough audit of `backend-work/`, `ml-work/`, `frontend-work/`, and the reference snapshot in `sih/` was executed:
1. **Backend Layer (`backend-work/`):**
   * **Database Models (`app/models.py`):** Rich relational schema implementing blueprint §31:
     * Dimension tables: `dim_port`, `dim_berth`, `dim_vessel_class`, `dim_route`, `dim_port_tariff`.
     * Fact tables: `fact_freight_index`, `fact_commodity_price`, `fact_port_call`, `fact_weather_climatology`.
     * Derived tables: `derived_compatibility`, `model_forecast`.
   * **Services (`app/services/`):**
     * `optimizer.py`: Ranks charter strategies (spot voyage, continuous COA, time charter) across simulated freight paths.
     * `shadow_freight.py`: Reconstructs voyage economics and freight rates ($/tonne) from daily TCE, distance, fuel consumption, and port dues.
     * `constraint_service.py` & `compatibility_service.py`: Evaluates physical port feasibility (draft, LOA, beam, cargo gear).
     * `scenario.py`: Assembles scenario context (`ScenarioContext`) for simulation without touching the ORM in loop execution.
     * `cost_model.py`: Pure vectorizable voyage cost calculation engine.
     * `simulator.py`: Monte Carlo simulation over stochastic freight and operational variables.
     * `risk_engine.py`: Multi-factor risk engine computing weighted composite risk indices.
   * **Routers (`app/routers/`):**
     * `/optimize-charter`: Recommends optimal charter strategy with full cost and risk breakdown.
     * `/forecast`: Serves freight index forecasts and derived $/tonne route estimates.
     * `/market`: Serves macro indicators, fuel benchmarks, and freight indices.
     * `/ports` & `/vessels`: Port and vessel constraints, berths, and compatibility matrix.
     * `/health`: System freshness and status.
2. **Frontend Layer (`frontend-work/`):**
   * Decoupled web client consuming backend JSON APIs at `http://localhost:8000`. Does not touch raw ML models or SQLite databases.
3. **ML Forecasting Layer (`ml-work/`):**
   * 72 Quantile LightGBM models ($P_{10}, P_{50}, P_{90}$) across 4 Baltic indices $\times$ 6 horizons.
   * Monotonic rearrangement and split conformal calibration on validation residuals.
   * 46 verified passing unit and regression tests.

---

## 2. What Was Reused

To uphold the core directive — **"Do NOT rebuild functionality that already exists"** — the following existing components were preserved and integrated:
1. **Physical Specifications & Reference Data:**
   * Reused Baltic standard vessel dimensions (DWT, draft, LOA, beam, speeds, consumption rates) from `backend-work/data/reference/vessel_classes.csv`.
   * Reused standard East Coast of India port limits (draft, LOA, beam, handling rates) from `backend-work/data/reference/ports.csv`.
   * Reused maritime distances and passage descriptions from `backend-work/data/reference/routes.csv`.
2. **Backend Services & Engines:**
   * Existing `optimizer.py` and `simulator.py` were left completely intact; the new route layer provides clean data structures and an adapter (`adapt_charter_estimate_for_optimizer`) that directly outputs the payload required by downstream optimization.
   * Existing 78 backend tests continue to pass 100% without modification.
3. **Phase 5 Probabilistic Forecast Models:**
   * Preserved all 72 quantile LightGBM models, benchmark outputs, and conformal calibration parameters without running unnecessary retraining.

---

## 3. New Route-Layer Architecture (`ml-work/route/`)

The newly developed modular package under [ml-work/route/](file:///c:/Users/win11/Downloads/sih/ml-work/route/) connects market-level forecasts to voyage economics and chartering decisions without conflating index levels with route prices:

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Market-Level Probabilistic Forecast (ML Layer)          │
│    - Index: BCI / BPI / BSI / BHSI                          │
│    - Quantiles: P10 (stress low), P50 (median), P90 (high)  │
│    - Split Conformal Calibration bounds                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Vessel-to-Index Translation (vessel_mapping.py)          │
│    - Capesize  → BCI                                        │
│    - Panamax   → BPI                                        │
│    - Supramax  → BSI                                        │
│    - Handysize → BHSI                                       │
│    - Daily TCE Mapping: tce_usd_day = index * ratio         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Physical Port Constraints Layer (port_constraints.py)    │
│    - Draft depth & Under Keel Clearance (UKC = 10%)         │
│    - Deadweight reduction: cargo_t = DWT - (draft_def * TPC)│
│    - LOA, beam, and cargo handling feasibility              │
│    - Lighterage requirement detection (e.g. Haldia/Sandheads│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Voyage Economics Engine (voyage_economics.py)            │
│    - Sea days: distance_nm / (speed_kn * 24)                │
│    - Ballast days: sea_days * (1 - backhaul_index)          │
│    - Port days: load_days + disch_days + weather + wait     │
│    - Fuel: (sea_days * cons_sea + port_days * cons_port)* $/mt
│    - Charter hire: total_days * tce_usd_day                 │
│    - Freight: total_voyage_cost / cargo_tonnes              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Route-Specific Charter Estimator (charter_estimator.py)  │
│    - P10 Freight Rate ($/t)                                 │
│    - P50 Freight Rate ($/t)                                 │
│    - P90 Freight Rate ($/t)                                 │
│    - Risk-Adjusted Freight: (1 - λ)*P50 + λ*P90             │
│    - Categorized: Predicted, Derived, Assumed, Unavailable  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Optimizer Adapter (optimizer_adapter.py)                 │
│    - Formats payload for backend optimizer & simulator      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Vessel / Baltic Index Mapping

The mapping is explicitly defined and configured in [ml-work/route/vessel_mapping.py](file:///c:/Users/win11/Downloads/sih/ml-work/route/vessel_mapping.py):

| Vessel Category | Baltic Index Code | Benchmark Index Description | Typical Deadweight (DWT) | Reference Draft |
| :--- | :---: | :--- | :---: | :---: |
| **Capesize** | `BCI` | Baltic Capesize Index | 180,000 MT | 18.20 m |
| **Panamax** | `BPI` | Baltic Panamax Index | 82,500 MT | 14.43 m |
| **Supramax** | `BSI` | Baltic Supramax Index | 63,000 MT | 13.35 m |
| **Handysize** | `BHSI` | Baltic Handysize Index | 38,200 MT | 10.54 m |

* **Validation Rules:**
  * Requesting an unsupported vessel type (e.g. `VLCC`, `ContainerShip`) raises a descriptive `ValueError` listing allowed dry-bulk categories.
  * Bidirectional translation functions `get_index_for_vessel()` and `get_vessel_for_index()` enforce exact typing.

---

## 5. Route Representation & Supported Lanes

Routes are modeled as `RouteContext` objects in [ml-work/route/route_config.py](file:///c:/Users/win11/Downloads/sih/ml-work/route/route_config.py) representing discrete port-to-port maritime corridors:

### Verified Overseas Origin Ports:
* **Australia (AU):** Hay Point (`AUHPT`), Gladstone (`AUGLT`)
* **Indonesia (ID):** Taboneo / Tanjung Bara (`IDTBA`)
* **South Africa (ZA):** Richards Bay (`ZARBY`)
* **United States (US):** Hampton Roads (`USHAM`)
* **Mozambique (MZ):** Beira (`MZBEW`)
* **Russia (RU):** Vostochny / Vladivostok (`RUVVO`)

### Verified East Coast India Discharge Ports:
* Paradip (`INPRT`), Visakhapatnam (`INVTZ`), Gangavaram (`INGGV`), Dhamra (`INDHA`), Haldia (`INHAL`), Gopalpur (`INGPR`), Sagar / Sandheads anchorage (`INSGD`).

### Supported Corridors (Sample Registry):
* `AUHPT-INPRT`: 5,180 nm (via Torres Strait & Malacca, C5/P3A analogue, backhaul index 0.25)
* `AUGLT-INDHA`: 5,425 nm (via Torres Strait & Malacca, C5 analogue, backhaul index 0.25)
* `IDTBA-INPRT`: 3,180 nm (via Malacca, S10 analogue, backhaul index 0.45)
* `ZARBY-INVTZ`: 4,450 nm (Cape of Good Hope approaches, C17 analogue, backhaul index 0.30)
* `USHAM-INPRT`: 9,150 nm (via Suez Canal, backhaul index 0.35)
* `MZBEW-INPRT`: 4,210 nm (Mozambique Channel, backhaul index 0.20)
* `RUVVO-INPRT`: 5,460 nm (via Malacca, sanctions review required)

---

## 6. Data Sources and Provenance

Every value in the route architecture carries strict provenance:
1. **Baltic Index Data:** Mendeley Data DOI `10.17632/mcm7ycmjtt.1`, verified real Baltic daily sessions (2012–2019), provenance: `mendeley_verified_2012_2019`.
2. **Maritime Distances:** Searoute algorithm under IMO routing rules, provenance: `great_circle_constrained_searoute_v1`.
3. **Vessel Specifications:** Baltic Exchange official vessel descriptions, provenance: `baltic_standard_description`.
4. **Port Physical Limits:** Major Port Authority administrative handbooks and official gazettes, provenance: `official_major_port_authority`.
5. **Test Fixtures:** Synthetic test inputs are restricted to unit tests and explicitly badged `TEST_ONLY`.

---

## 7. What is Observed vs. Derived vs. Assumed vs. Unavailable

The architecture strictly segregates data components across four explicit categories in [ml-work/route/charter_estimator.py](file:///c:/Users/win11/Downloads/sih/ml-work/route/charter_estimator.py):

| Category | Components Included | Source / Method |
| :--- | :--- | :--- |
| **A. Directly Observed / Predicted** | Baltic index point forecast ($P_{50}$), interval bounds ($P_{10}, P_{90}$), historical index levels. | Quantile LightGBM models trained on verified Baltic data. |
| **B. Derived** | Sea days, ballast days, port turnaround days, bunker fuel consumption (mt), daily hire cost, total voyage cost ($), freight rate ($/tonne). | Mathematical voyage economics formulas using physical vessel and distance parameters. |
| **C. Assumed / Configured** | Vessel operating speeds (kn), fuel consumption rates (mt/day), Under Keel Clearance (10%), commercial margin (10%), risk aversion ($\lambda$). | Configurable domain parameters from Baltic standard vessel descriptions. |
| **D. Not Currently Available** | Real-time spot vessel fixture quotes, real-time AIS vessel locations, verified post-2020 Baltic target data. | Explicitly flagged as `None` / `awaiting_legitimate_post_2020_data_acquisition`. |

---

## 8. Bunker Fuel Price Interface

The bunker fuel interface in [ml-work/route/bunker_interface.py](file:///c:/Users/win11/Downloads/sih/ml-work/route/bunker_interface.py) defines:
* Abstract protocol `BunkerDataProvider` with method `get_bunker_price(location, query_date, fuel_type)`.
* **Zero Silent Fallback Rule:** Missing bunker data raises `MissingBunkerDataError`. It does **not** silently default to 0.0 or invent numbers.
* `DemoBunkerDataProvider`: Concrete provider for test suites badging records with `provenance="TEST_ONLY"`.

---

## 9. Port Constraint & Compatibility Checking

Implemented in [ml-work/route/port_constraints.py](file:///c:/Users/win11/Downloads/sih/ml-work/route/port_constraints.py):
* `PortConstraint`: Captures `max_draft_m`, `max_loa_m`, `max_beam_m`, `handling_rate_tpd`, `lighterage_required`.
* `check_vessel_port_compatibility()`:
  * Computes draft deficit: $\Delta d = \text{draft}_{\text{vessel}} - (\text{draft}_{\text{port}} / 1.10)$.
  * Deadweight intake reduction: $\Delta \text{payload} = \Delta d \times 100 \times \text{TPC}$.
  * If intake falls below 50% DWT and lighterage is unavailable, rejects with detailed reason.
  * If a port constraint is missing (`None`), generates a clear warning rather than inventing limits.

---

## 10. Clean Forecast Object Contract

Defined in [ml-work/route/forecast_object.py](file:///c:/Users/win11/Downloads/sih/ml-work/route/forecast_object.py):
* Enforces trading session horizons $h \in \{7, 14, 28, 60, 90, 180\}$.
* Enforces $P_{10} \le P_{50} \le P_{90}$ and $P_{10, \text{cal}} \le P_{50} \le P_{90, \text{cal}}$.
* Validates vessel type vs. Baltic target index consistency.
* Serializes to dictionary for JSON API responses.

---

## 11. Optimization Integration Plan

The optimizer adapter in [ml-work/route/optimizer_adapter.py](file:///c:/Users/win11/Downloads/sih/ml-work/route/optimizer_adapter.py) produces the `OptimizerInputPayload`:
* Feeds `freight_p50_usd_t`, `freight_lo80_usd_t` ($P_{10}$), and `freight_hi80_usd_t` ($P_{90}$) directly into the backend's `cost_model.py` and `optimizer.py`.
* Preserves risk aversion parameter $\lambda \in [0, 1]$ allowing procurement officers to weight tail-risk freight scenarios:
  $$\text{Cost}_{\text{risk-adjusted}} = (1 - \lambda) \times \text{Cost}(P_{50}) + \lambda \times \text{Cost}(P_{90})$$
* Seamless contract compatibility without modifying any backend code.

---

## 12. Verification & Test Suite Results

### A. New Phase 6A Test Suite ([ml-work/tests/test_phase6a_route_architecture.py](file:///c:/Users/win11/Downloads/sih/ml-work/tests/test_phase6a_route_architecture.py))
All 10 required tests pass cleanly in 0.19s:
1. `test_1_vessel_to_index_mapping`: Confirms Capesize $\to$ BCI, Panamax $\to$ BPI, Supramax $\to$ BSI, Handysize $\to$ BHSI.
2. `test_2_unknown_vessel_type_fails`: Rejects unknown classes (e.g. `VLCC`) with descriptive error.
3. `test_3_unknown_route_fails`: Rejects unknown port pairs with supported list.
4. `test_4_missing_bunker_data_fails_not_zero`: Confirms missing fuel data raises `MissingBunkerDataError`.
5. `test_5_missing_port_constraint_handled`: Confirms missing constraints generate warnings rather than fabricated values.
6. `test_6_p10_p50_p90_ordering`: Verifies constructor rejects inverted quantiles.
7. `test_7_calibrated_interval_ordering`: Verifies constructor rejects inverted calibrated intervals.
8. `test_8_horizon_validation`: Verifies non-standard horizons (e.g. 45 days) are rejected.
9. `test_9_route_vessel_metadata_propagation`: Verifies end-to-end parameter flow into `RouteCharterEstimate`.
10. `test_10_optimizer_adapter_construction`: Verifies payload construction for downstream optimizer.

### B. Full ML Test Suite
* Executed `pytest ml-work/tests/ -v`.
* **56 passed in 46.94s (100% pass rate).**

### C. Full Backend Test Suite
* Executed `pytest tests/ -v` from `backend-work/`.
* **78 passed in 40.06s (100% pass rate).**

---

## 13. Known Limitations & Post-2020 Data Acquisition Status

1. **Dataset Boundary:** The verified Baltic dataset spans 2012-08-01 to 2019-07-31.
2. **Post-2020 Status:** Acquisition of legitimate post-2020 Baltic dry-bulk sub-indices remains a separate ongoing initiative through academic/institutional channels.
3. **No Fabrication:** No synthetic post-2020 observations were added, and official Baltic formulas were not simulated.
4. **Architectural Readiness:** When verified post-2020 data is acquired, it will be placed in `ml-work/data/raw/` and processed through the feature pipeline without requiring any restructuring of this route translation layer.

---

## 14. Recommendation for Next Steps

* **Do not start Phase 6B / full API integration until this Phase 6A architecture report is reviewed and approved.**
* Upon approval, the next step will be to connect this route-aware translation module to the FastAPI `/forecast` and `/optimize-charter` endpoints, exposing probabilistic bounds and route economics directly to the user interface.
