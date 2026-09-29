# SIH26006 — Production Deployment Checklist & SOP

This document provides the standard operating procedure (SOP) and verification steps for deploying the **SIH26006 Intelligent Freight Forecasting & Charter Decision-Support System** in evaluation or production environments.

---

## 1. Pre-Deployment Configuration

### Step 1: Prepare Environment Configuration
Copy the production environment template:
```bash
cp .env.production.example .env.production
```

### Step 2: Configure Environment Variables
Edit `.env.production` to set your target domain, database URL, and operational flags:
```ini
# Production Environment
DEMO_MODE=false
STRICT_PRODUCTION_ML=true
ALLOW_ML_FALLBACK=false
REQUIRE_V2_FORECAST=true

# Database: SQLite for single-instance demo or PostgreSQL for enterprise multi-node
DATABASE_URL=sqlite:///./charter.db
# Or PostgreSQL: postgresql+psycopg2://user:password@db-host:5432/charter_db

# CORS Configuration (Restricted to production frontend domain)
CORS_ORIGINS=https://charter.example.gov.in,https://freight-decision.gov.in

# Server Binding
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=info
```

### Step 3: Verify Model Artifact Presence
Ensure all 24 authoritative LightGBM v2 model artifacts and manifest exist:
```bash
# Verify artifact directory
ls -la ml-work/models/saved_models/v2/
# Check manifest
cat ml-work/models/saved_models/v2/model_manifest.json
```
Required count: **24 artifact files** + `model_manifest.json` representing 72 quantile models ($P_{10}, P_{50}, P_{90}$).

---

## 2. Automated Test & Verification Gate

Before building or launching containers, verify all test suites and pipeline gates:

### Step 4: Run Backend Test Suite
```bash
cd backend-work
python -m pytest -q
```
**Acceptance Criterion:** 139 passed tests, 0 failures.

### Step 5: Run Production System Verification
```bash
python scripts/verify_production.py
```
**Acceptance Criterion:** 8/8 test phases pass (ML artifact loading, `/health`, `/health/ready`, `/health/live`, `/api/v1/sources`, LightGBM v2 forecast, optimizer recommendation + Tornado sensitivity, and multi-origin simulation).

### Step 6: Build Production Frontend
```bash
cd frontend-work
npm install
npm run build
```
**Acceptance Criterion:** Vite builds cleanly with 0 errors and outputs to `dist/`.

---

## 3. Containerized Deployment (Docker / Docker Compose)

### Step 7: Build Containers from Clean Context
```bash
docker compose build --no-cache
```

### Step 8: Start Services
```bash
docker compose up -d
```

### Step 9: Verify Container Health Probes
```bash
# Check running containers
docker compose ps

# Test Liveness Probe (process responsive)
curl -f http://localhost:8000/health/live

# Test Readiness Probe (ML models loaded and database ready)
curl -f http://localhost:8000/health/ready

# Inspect Full Diagnostic Health Status
curl http://localhost:8000/health
```
**Expected Response from `/health/ready`:**
```json
{
  "ready": true,
  "forecast_engine": "lightgbm_v2",
  "models_available": true
}
```

### Step 10: Verify Frontend Web Delivery
Open a web browser or curl the frontend reverse proxy:
```bash
curl -I http://localhost/
```
**Expected Response:** HTTP 200 OK (Nginx serving `index.html` with SPA fallback).

---

## 4. End-to-End Browser Acceptance Workflow

Perform the standard operational smoke test in the browser:

1. **Access URL:** Navigate to `http://localhost:5173` (or `http://localhost` if running Docker).
   - **Verification:** The application opens directly to the **Executive Dashboard** (Home Page) at `/`.
2. **Charter Planner Workflow:**
   - Navigate to `/charter-planner` or click "Charter Planner" on the navigation bar.
   - Select Origin: `IDTBA (Taboneo)`.
   - **Verification:** System displays notification banner:
     `Commodity adjusted to Thermal Coal because the selected loading port supports thermal coal in the reference registry.`
   - Click **RUN CHARTER ANALYSIS**.
   - **Verification:** Recommendation displays feasible strategy, cost breakdown, and authoritative backend sensitivity.
3. **Strategy Simulator Workflow:**
   - Click **EXECUTE MONTE CARLO SIMULATION** ($N=1000$).
   - **Verification:** State transitions `Idle → Loading → Success`; winner updates; CVaR-90 is populated; Tornado Chart renders real backend low/high delta swings.
4. **Data Provenance Transparency:**
   - Navigate to **Freight Forecast** (`/freight-forecast`).
   - **Verification:** Timeline shows verified historical observations (2012–2019) and synthetic extension (2020–2026) with explicit labels.

---

## 5. Rollback Procedure

If the production container fails readiness probes or exhibits degraded performance:

1. **Stop Current Services:**
   ```bash
   docker compose down
   ```
2. **Revert Git to Last Known Good Tag or Commit:**
   ```bash
   git checkout tags/v1.0.0-hardened # or commit 56a2175
   ```
3. **Re-launch Staging Container:**
   ```bash
   docker compose up -d --build
   ```
4. **Confirm Service Restoration:**
   ```bash
   curl -f http://localhost:8000/health/ready
   ```
