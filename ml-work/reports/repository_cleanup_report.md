# SIH26006 — Repository Cleanup & Canonical Workspace Consolidation Report

**Date:** 20 September 2026  
**Status:** ✅ Completed & Validated  
**Authoritative Reference:** [`SIH26006_Blueprint.md`](file:///c:/Users/win11/Downloads/sih/SIH26006_Blueprint.md)

---

## 1. Executive Summary

Prior to implementing the new frontend design, a thorough, evidence-based audit and cleanup was conducted across the SIH26006 repository. Multiple generations of prototype trees, duplicate reference tables, and legacy scripts had created redundancy and ambiguity regarding the single source of truth.

Following a strict **Audit → Classify → Consolidate/Archive → Verify** workflow:
1. **Canonical Workspaces Consolidated:** The repository now exposes three unambiguous canonical workspaces (`ml-work/`, `backend-work/`, `frontend-work/`) alongside centralized documentation (`docs/`).
2. **Duplicate Snapshot Archived:** The obsolete `sih/` tree was audited, its unique reference documentation and utility scripts consolidated into `docs/` and `backend-work/scripts/`, and the snapshot safely preserved in `.archive/reference-snapshot/sih/` (with heavy `.venv/` cache pruned).
3. **Legacy Root Artifacts Cleaned:** Obsolete root `data/`, early phase `scripts/clean_bpi.py`, redundant root reports, and a 0-byte orphan database were classified and archived/removed.
4. **All Tests Retained 100% Pass Rate:** All 73 ML pipeline tests and 78 backend API/decision engine tests passed, and the frontend production bundle built cleanly.

---

## 2. Testing Baseline & Verification Summary

| Test Suite | Pre-Cleanup Baseline | Post-Cleanup Result | Duration | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ML Pipeline (`ml-work/tests/`)** | 73 passed | **73 passed** | 48.26s | ✅ 100% Pass |
| **Backend Engine (`backend-work/tests/`)** | 78 passed | **78 passed** | 24.34s | ✅ 100% Pass |
| **Frontend Production Build (`frontend-work/`)** | built in 15.77s | **built in 4.66s** | 4.66s | ✅ Clean Build |

---

## 3. Pre-Cleanup vs. Post-Cleanup Directory Trees

### A. Pre-Cleanup Cluttered Root
```text
SIH26006/
├── .pytest_cache/             # Temporary test cache
├── backend-work/              # Active backend workspace
├── data/                      # Legacy root prototype data (bpi_cleaned.csv, original_dataset.csv)
├── docs/                      # Partial docs (PROJECT_STATUS.md only)
├── frontend-work/             # Active frontend workspace
├── ml-work/                   # Active ML & route modeling workspace
├── scripts/                   # Legacy prototype cleaning script (clean_bpi.py)
├── sih/                       # Duplicate historical snapshot tree with duplicate backend & data
├── .gitignore
├── charter.db                 # 0-byte empty orphan file at root
├── CLEANING_REPORT.md         # Stale root copy of Phase 1 cleaning report
├── DATA_PROVENANCE.md         # Stale root copy of Phase 1 provenance report
├── README.md                  # Outdated root readme
└── SIH26006_Blueprint (1).md  # Master blueprint with awkward download suffix
```

### B. Post-Cleanup Canonical Root
```text
SIH26006/
│
├── ml-work/                   # [ACTIVE CANONICAL] Machine Learning & Route Economics
│   ├── data/                  # Category A verified real Baltic series + FRED macro data
│   ├── features/              # Feature engineering pipeline across 6 discrete horizons (h ∈ {7..180})
│   ├── models/                # Quantile LightGBM models + conformal prediction calibration
│   ├── route/                 # Voyage economics, vessel mapping, port constraints, bunker model
│   ├── pipeline/              # Data cleaning, validation, split configs, readiness checker
│   ├── reports/               # Audit reports, calibration results, reconciliation logs
│   ├── scripts/               # Training, evaluation, post-2019 validation scripts
│   └── tests/                 # 73 unit and integration tests (100% passing)
│
├── backend-work/              # [ACTIVE CANONICAL] Decision-Support API & Simulation Engine
│   ├── app/                   # FastAPI routers, schemas, services, optimization, simulation
│   ├── data/reference/        # Authoritative reference tables (ports, berths, routes, tariffs, demo)
│   ├── scripts/               # Authoritative scripts (bootstrap_db, calibrate_shadow_freight, etc.)
│   ├── tests/                 # 78 API, constraint, and simulation tests (100% passing)
│   ├── requirements.txt       # Backend dependency manifest
│   ├── .env.example           # Canonical environment configuration template
│   └── Dockerfile             # Containerized backend deployment
│
├── frontend-work/             # [ACTIVE CANONICAL] Interactive Web Dashboard (React 18 + Vite)
│   ├── src/                   # UI components, Charter Optimizer, Historical Forecast, Route Analysis
│   ├── package.json           # Node dependencies and scripts
│   └── vite.config.js         # Vite dev server with proxy to backend (:5173 -> :8000)
│
├── docs/                      # [CENTRALIZED DOCUMENTATION] Authoritative Contracts & Specs
│   ├── api_contract.md        # Full REST endpoint catalogue & schema documentation
│   ├── assumptions.md         # Complete physical, operational, and commercial assumptions register
│   ├── openapi.json           # Authoritative OpenAPI v3 specification (generated from live backend)
│   └── PROJECT_STATUS.md      # Multi-phase milestone status report
│
├── .archive/                  # [HISTORICAL ARCHIVE] Isolated reference & legacy materials
│   ├── reference-snapshot/    # Archived reference snapshot of early prototype (sih/)
│   ├── legacy-data/           # Archived legacy prototype data (root data/)
│   └── obsolete-scripts/      # Archived early prototype scripts (root scripts/)
│
├── SIH26006_Blueprint.md      # Master architectural problem blueprint & requirements
├── README.md                  # Comprehensive root readme
└── .gitignore                 # Clean VCS exclusions
```

---

## 4. Deep Duplicate Analysis & Actions Taken

### 1. The `sih/` Tree
* **Audit Findings:**
  * `sih/backend/app`: Identical to `backend-work/app` except `backend-work/app` is strictly newer (contains `/historical` API routes and local reference data fallback in `seed.py`).
  * `sih/backend/tests`: Identical to `backend-work/tests`.
  * `sih/data/reference/`: SHA256 checksums verified to be 100% identical to `backend-work/data/reference/`.
  * `sih/docs/`: Contained invaluable documentation (`api_contract.md`, `assumptions.md`).
  * `sih/scripts/`: Contained backend operational scripts (`calibrate_shadow_freight.py`, `rebuild_compatibility.py`, `generate_demo_series.py`, `bootstrap_db.sh`).
  * `sih/.venv/`: Contained a 400MB+ obsolete virtual environment.
* **Classification:** **C / B — HISTORICAL REFERENCE SNAPSHOT & REDUNDANT DUPLICATE**
* **Action:**
  1. Extracted `api_contract.md` and `assumptions.md` into canonical `docs/`.
  2. Consolidated all backend scripts into `backend-work/scripts/`.
  3. Added `.env.example` and `requirements.txt` to `backend-work/`.
  4. Pruned `.venv/` and `.DS_Store`.
  5. Moved the snapshot to `.archive/reference-snapshot/sih/`.

### 2. Root-level `data/`
* **Audit Findings:**
  * `data/raw/original_dataset.csv`: SHA256 matches `ml-work/data/raw/original_dataset.csv` exactly.
  * `data/processed/bpi_cleaned.csv`: Early prototype output from Phase 1. The modern ML pipeline uses multivariate dataset `ml-work/data/processed/real_baltic_multivariate.csv` and feature datasets across 6 horizons.
* **Action:** Moved to `.archive/legacy-data/data/`.

### 3. Root-level `scripts/`
* **Audit Findings:**
  * Contained only `scripts/clean_bpi.py` (early single-index BPI prototype script).
  * Superseded by `ml-work/pipeline/cleaner.py` and `ml-work/scripts/run_phase4_benchmark.py`.
* **Action:** Moved to `.archive/obsolete-scripts/scripts/`.

### 4. Root Documentation & Blueprints
* **Audit Findings:**
  * Root `CLEANING_REPORT.md` and `DATA_PROVENANCE.md` were stale, early Phase 1 drafts superseded by the comprehensive, multi-source versions in `ml-work/`.
  * `SIH26006_Blueprint (1).md` was the master problem specification with an artifact download suffix.
  * 0-byte orphan `charter.db` at root was created erroneously outside `backend-work/`.
* **Action:**
  1. Removed redundant root `CLEANING_REPORT.md` and `DATA_PROVENANCE.md`.
  2. Renamed `SIH26006_Blueprint (1).md` to canonical `SIH26006_Blueprint.md`.
  3. Removed 0-byte orphan `charter.db`.
  4. Rewrote root `README.md` to cleanly showcase the canonical repository structure.

---

## 5. Cross-Reference Corrections

| File Modified | Modification Detail |
| :--- | :--- |
| [`ml-work/pipeline/config.py`](file:///c:/Users/win11/Downloads/sih/ml-work/pipeline/config.py#L41) | Updated `default_source_url` provenance string from `local://sih/scripts/...` to `local://backend-work/scripts/...`. |
| [`ml-work/DATA_PROVENANCE.md`](file:///c:/Users/win11/Downloads/sih/ml-work/DATA_PROVENANCE.md#L6) | Updated blueprint link to `SIH26006_Blueprint.md` and demo generator reference to `backend-work/scripts/generate_demo_series.py`. |
| [`ml-work/reports/data_source_audit.md`](file:///c:/Users/win11/Downloads/sih/ml-work/reports/data_source_audit.md#L6) | Updated blueprint link and demo generator script path. |
| [`ml-work/reports/real_data_quality_report.md`](file:///c:/Users/win11/Downloads/sih/ml-work/reports/real_data_quality_report.md#L8) | Updated blueprint link to `SIH26006_Blueprint.md`. |
| [`docs/api_contract.md`](file:///c:/Users/win11/Downloads/sih/docs/api_contract.md#L34-L40) | Documented newly implemented `/api/v1/historical/` endpoints (`/status`, `/series`, `/forecast`, `/route-estimate`, `/supported-routes`). |
| [`docs/openapi.json`](file:///c:/Users/win11/Downloads/sih/docs/openapi.json) | Exported live OpenAPI v3 schema directly from the active FastAPI backend. |
| [`.gitignore`](file:///c:/Users/win11/Downloads/sih/.gitignore#L36-L41) | Added explicit exclusions for `node_modules/`, `dist/`, and `.vite/`. |

---

## 6. Files & Directories Audit Accounting

### A. Files/Directories Archived
- `sih/` (pruned of `.venv/` and `.DS_Store`) $\rightarrow$ `.archive/reference-snapshot/sih/`
- `data/` $\rightarrow$ `.archive/legacy-data/data/`
- `scripts/clean_bpi.py` $\rightarrow$ `.archive/obsolete-scripts/scripts/clean_bpi.py`

### B. Files Deleted
- `charter.db` (root 0-byte orphan file)
- `CLEANING_REPORT.md` (root redundant duplicate)
- `DATA_PROVENANCE.md` (root redundant duplicate)
- `sih/.venv/` (obsolete 400MB+ virtual environment)
- `sih/.DS_Store` (OS junk)

### C. Files Created / Consolidated
- `backend-work/scripts/` (`bootstrap_db.sh`, `calibrate_shadow_freight.py`, `export_openapi.py`, `generate_demo_series.py`, `rebuild_compatibility.py`)
- `backend-work/.env.example`
- `backend-work/requirements.txt`
- `docs/api_contract.md`
- `docs/assumptions.md`
- `docs/openapi.json`
- `ml-work/reports/repository_cleanup_report.md`

### D. Files Renamed / Modified
- `SIH26006_Blueprint (1).md` $\rightarrow$ `SIH26006_Blueprint.md`
- `README.md`
- `.gitignore`
- `ml-work/pipeline/config.py`
- `ml-work/DATA_PROVENANCE.md`
- `ml-work/reports/data_source_audit.md`
- `ml-work/reports/real_data_quality_report.md`

### E. Files Preserved with Strict Immutability
- All 72 serialized LightGBM model checkpoints in `ml-work/models/saved_models/`
- All conformal calibration parameters and audit files in `ml-work/reports/`
- Verified real historical data: `ml-work/data/processed/real_baltic_multivariate.csv` and Mendeley/FRED raw data
- Authoritative backend database: `backend-work/charter.db` (8.46 MB)
- All 24 feature dataset CSVs in `ml-work/data/features/`
- All frontend source code in `frontend-work/src/`

---

## 7. Acceptance Criteria Verification

- [x] **One active backend:** `backend-work/`
- [x] **One active frontend:** `frontend-work/`
- [x] **One active ML pipeline:** `ml-work/`
- [x] **One authoritative reference-data location:** `backend-work/data/reference/`
- [x] **No obsolete duplicate imports:** Checked across all workspaces.
- [x] **No broken documentation links:** All links point to canonical files.
- [x] **No accidental data loss:** All Category A real datasets, features, and model weights preserved.
- [x] **Historical model artifacts preserved:** All 72 quantile models intact in `ml-work/models/saved_models/`.
- [x] **Data provenance preserved:** `ml-work/DATA_PROVENANCE.md` and registry intact.
- [x] **All ML tests pass:** 73/73 passing (`python -m pytest ml-work/tests/`).
- [x] **All backend tests pass:** 78/78 passing (`python -m pytest backend-work/tests/`).
- [x] **Frontend build passes:** Clean production build with Vite (`npm run build`).
- [x] **Root directory is clean & understandable:** Modern `README.md` with clear architecture diagram.
