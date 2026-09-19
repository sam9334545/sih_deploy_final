# SIH26006 — Intelligent Freight Forecasting & Charter Decision Support System

An end-to-end maritime freight intelligence and charter decision-support platform designed for dry bulk imports into India's East Coast ports (Paradip, Dhamra, Haldia, Vizag, Gopalpur, Gangavaram, Ennore, Krishnapatnam).

**Authoritative Specification:** [`SIH26006_Blueprint.md`](file:///c:/Users/win11/Downloads/sih/SIH26006_Blueprint.md)

---

## Canonical Workspace Architecture

The repository enforces a strict, modular three-tier separation of concerns with dedicated documentation:

```text
SIH26006/
│
├── ml-work/                 # Machine Learning, Econometrics & Route Modeling
│   ├── data/                # Category A verified real Baltic series + FRED macro indicators
│   ├── features/            # Feature engineering pipeline across 6 discrete horizons (h ∈ {7..180})
│   ├── models/              # LightGBM quantile regression & split-conformal calibration
│   ├── route/               # Voyage economics, vessel mapping, port constraints, bunker model
│   ├── pipeline/            # Data cleaning, validation, split configs, and readiness checking
│   ├── reports/             # Benchmark audits, calibration logs, and data quality audits
│   ├── scripts/             # Training, evaluation, and post-2019 validation scripts
│   └── tests/               # 73 unit and integration tests (100% passing)
│
├── backend-work/            # Decision-Support Engine & FastAPI Service
│   ├── app/                 # Routers, schemas, domain services, optimization, and simulation
│   ├── data/reference/      # Authoritative ports, berths, routes, vessel classes, tariffs, demo series
│   ├── scripts/             # DB bootstrap, shadow freight calibration, and utility scripts
│   ├── tests/               # 78 API, constraint, and simulation tests (100% passing)
│   ├── requirements.txt     # Backend Python dependencies
│   └── Dockerfile           # Containerized backend deployment
│
├── frontend-work/           # Interactive Web Dashboard (React 18 + Vite)
│   ├── src/                 # Charter Optimizer, Historical Forecast, Route Analysis, Provenance
│   ├── package.json         # Node dependencies and scripts
│   └── vite.config.js       # Vite dev server with reverse proxy to backend (:5173 -> :8000)
│
├── docs/                    # Authoritative System & API Documentation
│   ├── api_contract.md      # Full REST endpoint contract & schema documentation
│   ├── assumptions.md       # Complete physical, operational, and commercial assumptions register
│   ├── openapi.json         # Authoritative OpenAPI v3 specification
│   └── PROJECT_STATUS.md    # Multi-phase milestone status report
│
├── .archive/                # Preserved Historical & Reference Material
│   ├── reference-snapshot/  # Archived reference snapshot of early prototype
│   ├── legacy-data/         # Archived legacy prototype data
│   └── obsolete-scripts/    # Archived early prototype scripts
│
├── SIH26006_Blueprint.md    # Master architectural problem blueprint & requirements
└── .gitignore               # Clean VCS exclusions
```

---

## Responsibility Mapping

| Workspace | Primary Role | Technologies / Standards |
| :--- | :--- | :--- |
| **`ml-work/`** | **ML / Data / Route Work** | LightGBM, Conformal Prediction, Pandas, Scikit-learn, Statsmodels, Pytest |
| **`backend-work/`** | **API & Decision Engine** | FastAPI, Pydantic v2, SQLAlchemy, Uvicorn, Monte Carlo Simulation |
| **`frontend-work/`** | **User Interface** | React 18, Vite, Lucide Icons, Vanilla CSS Design System |
| **`docs/`** | **System Documentation** | API contracts, assumptions register, OpenAPI v3 spec |

---

## Quickstart

### 1. Run the Backend Service
```bash
cd backend-work
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **API Root:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Run the Frontend Dashboard
```bash
cd frontend-work
npm install
npm run dev
```
- **Web UI:** [http://localhost:5173](http://localhost:5173)

---

## Verification & Testing

Both active Python workspaces and the frontend include independent, comprehensive automated test suites:

```bash
# Run ML Pipeline & Route Architecture Tests (73 tests)
python -m pytest ml-work/tests/

# Run Backend API, Simulation & Constraint Tests (78 tests)
python -m pytest backend-work/tests/

# Validate Frontend Production Bundle
cd frontend-work && npm run build
```
