# SIH26006 — Project Status Inventory (Phase 0 Audit)

**Date:** 19 September 2026  
**Document Version:** 1.0 (Phase 0 Baseline)  
**System:** Intelligent Freight Forecasting & Charter Decision Support Engine for Indian East Coast Ports  
**Source of Truth:** [`SIH26006_Blueprint (1).md`](file:///c:/Users/win11/Downloads/sih/SIH26006_Blueprint%20(1).md)

---

## 1. Current Architecture & Layout

The project is structured into three modular, decoupled workspaces plus an immutable reference snapshot:

```text
sih/
├── ml-work/                         # ML & Data Engineering Workspace
│   ├── data/
│   │   ├── raw/                     # Read-only raw data inputs
│   │   │   └── original_dataset.csv
│   │   └── processed/               # Standardized cleaned datasets
│   │       └── bpi_cleaned.csv
│   ├── pipeline/                    # Pure-function Python data pipeline
│   │   ├── cleaner.py               # Parsing, deduplication, sorting, constraints
│   │   ├── config.py                # Dynamic column aliases & paths (zero hardcoded values)
│   │   ├── validator.py             # Bounds, IQR outlier & price jump detection
│   │   └── reporter.py              # Automated markdown audit report generation
│   ├── scripts/
│   │   └── run_pipeline.py          # CLI runner for reproducible data processing
│   ├── tests/
│   │   └── test_data_pipeline.py    # Unit tests for data pipeline (6/6 passing)
│   ├── CLEANING_REPORT.md           # Execution report of data cleaning
│   ├── DATA_PROVENANCE.md           # Provenance audit and legal assessment
│   └── README.md                    # Developer guide for data engineering
│
├── backend-work/                    # FastAPI Backend & Decision Engine
│   ├── app/                         # Application modules
│   │   ├── routers/                 # Endpoints: forecast, optimize, ports, vessels, risks, market
│   │   ├── services/                # Business logic: simulator, cost_model, forecast_model, etc.
│   │   ├── repositories/            # Database queries: reference tables & time-series
│   │   ├── schemas/                 # Pydantic request & response contracts
│   │   ├── models.py                # SQLAlchemy ORM models
│   │   ├── seed.py                  # Database seeder script
│   │   └── config.py                # Environment-driven application settings
│   ├── data/reference/              # Static domain tables (ports, berths, routes, tariffs)
│   ├── tests/                       # Test suite (78/78 tests passing)
│   ├── charter.db                   # Local SQLite database (seeded)
│   ├── Dockerfile                   # Container specification
│   └── pytest.ini                   # Test configuration
│
├── frontend-work/                   # Frontend Workspace (Pending implementation)
│   ├── src/                         # Client source tree
│   └── README.md                    # Frontend integration & architecture guide
│
├── sih/                             # Immutable original/reference snapshot (DO NOT MODIFY)
│   ├── backend/
│   ├── data/reference/
│   ├── docs/
│   └── scripts/
│
├── docs/                            # Cross-project technical documentation
│   └── PROJECT_STATUS.md            # This document
├── .gitignore                       # Clean Git exclusion rules
├── README.md                        # Root workspace documentation
└── SIH26006_Blueprint (1).md        # Authoritative problem statement & blueprint
```

---

## 2. Inventory & State of Artifacts

### Git & Source Control State
* **Branch:** `main`
* **Remote:** `https://github.com/sam9334545/sih.git`
* **Working Tree:** Clean (all current changes committed and synchronized).
* **Excluded Files:** SQLite databases (`*.db`), Python virtual environments (`.venv/`), bytecode caches (`__pycache__/`, `.pytest_cache/`), and secrets (`.env`).

### Database & Environment State
* **Database:** `backend-work/charter.db` (SQLite, 8.4 MB), created and seeded via `python -m app.seed`.
* **Seed Tables:** Ports (14), Berths (22), Routes (36), Tariffs (41), Compatibility rules (1,056).
* **Configuration:** Controlled via `pydantic-settings` in `backend-work/app/config.py` with fallback defaults.

### Test Setup & Verification
1. **ML Pipeline Tests:** `pytest ml-work/tests/` -> **6 passed** in 4.40s.
2. **Backend Integration Tests:** `pytest backend-work/tests/` -> **78 passed** in 146.52s.

---

## 3. Completed Components

1. **Modular Workspace Isolation:** Clean physical separation of concerns (`ml-work`, `backend-work`, `frontend-work`).
2. **Data Pipeline Infrastructure:** Fully functional, config-driven, reproducible cleaning scripts in `ml-work/pipeline/`.
3. **Backend Decision Engine:** Complete vessel feasibility checker, port draft constraint evaluator, voyage cost calculator, Sandheads lighterage model, Monte Carlo risk engine, and charter strategy simulator.
4. **API Endpoints:** Working REST endpoints for `/v1/forecast`, `/v1/optimize`, `/v1/ports`, `/v1/vessels`, `/v1/market`, `/v1/risks`.

---

## 4. Incomplete Components (To Be Built in Successive Phases)

1. **Real Historical Market Data (Phase 1):** Verified real-world series for Baltic Panamax Index (BPI), Capesize (BCI), Supramax (BSI), Handysize (BHSI), bunker fuel, and coal/iron ore.
2. **Supervised Feature Store (Phase 3):** Systematic lag, rolling momentum/volatility, Fourier seasonality, and exogenous cross-market features (`ml-work/features/`).
3. **Model Ladder (Phases 4–6):**
   * Baseline 1: Seasonal-naive
   * Baseline 2: Damped drift / Ridge
   * Baseline 3: SARIMA
   * Core Model: LightGBM
   * Probabilistic Intervals: Quantile LightGBM (P10, P50, P90) with split conformal calibration.
4. **Explainability Engine (Phase 7):** SHAP-based driver attribution.
5. **Production ML Integration (Phase 8):** Connecting the trained LightGBM artifacts directly into the backend `ForecastService`.
6. **Frontend Dashboard (Phase 10):** Interactive UI for scenario simulation, forecast curves, and charter recommendations.

---

## 5. Known Demo / Synthetic Components (CRITICAL TRANSPARENCY)

> [!WARNING]
> The current forecasting pipeline uses synthetic demonstration data. It MUST NOT be represented as real market observations.

* **Freight Series:** `ml-work/data/raw/original_dataset.csv` and `backend-work/data/reference/demo/freight_index.csv` were generated via an Ornstein–Uhlenbeck mean-reversion stochastic process (`sih/scripts/generate_demo_series.py`, seed `26006`).
* **Time Charter Ratio:** In the demo dataset, Time Charter average (`tc_avg_usd_day`) is locked at a fixed $9.00 \times \text{bpi_value}$. Real market P5TC rates fluctuate dynamically.
* **Commodity & Traffic Series:** `commodity_price.csv` and `port_call.csv` are calibrated demo fixtures.
* **Backend Forecast Engine:** `backend-work/app/services/forecast_model.py` currently executes an analytical Ridge regression / damped-drift baseline. It is not yet the required LightGBM model.

---

## 6. Known Risks & Constraints

1. **Baltic Exchange Benchmark Licensing:** Official BPI/P5TC daily assessments are proprietary intellectual property regulated under UK FCA Benchmark Regulation. Programmatic scraping of free portals (e.g. Investing.com, MacroMicro) is actively blocked by Cloudflare HTTP 403 or paywalls.
2. **Data Leakage in Time Series:** Multi-step forward forecasting (7 to 180 days) requires strict rolling-origin cutoff; features must never incorporate future observations.
3. **Resource Constraints:** All ML training and inference must run comfortably on a standard developer laptop without GPU dependencies.
4. **Contract Preservation:** ML model enhancements must preserve existing backend schemas (`ForecastResponse`, `Interval80`, `ModelMeta`) to ensure seamless integration with the charter optimizer.

---

## 7. Next Phase: Phase 1 — Real Data Acquisition

* **Goal:** Identify, verify, and acquire legally and practically available historical market feeds for freight indices (BPI, BCI, BSI, BHSI) and exogenous drivers (bunker fuel, coal, USD/INR FX).
* **Action:** Audit viable public APIs (e.g., FRED, World Bank, EIA, Yahoo Finance, academic repositories) and update `ml-work/DATA_PROVENANCE.md`.
