# SIH26006 Charter Intelligence — Frontend/Backend Integration Specification

## 1. Overview & Architecture

The SIH26006 "Charter Intelligence" decision-support system connects an institutional React 18 frontend dashboard to a FastAPI backend engine and pre-trained Quantile LightGBM models with split-conformal calibration.

```
┌──────────────────────────────────────────────────────────┐
│                   React 18 Dashboard                     │
│  (HomePortal, FreightForecast, RouteAnalysis,            │
│   CharterOptimizer, PortIntelligence, MarketIntel)       │
└────────────────────────────┬─────────────────────────────┘
                             │  HTTP / JSON (/api/v1)
                             ▼
┌──────────────────────────────────────────────────────────┐
│                  FastAPI Backend Server                  │
│  (historical.py, optimize.py, ports.py, market.py)       │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────────┐ ┌─────────────────────────┐
│     Quantile LightGBM ML     │ │    SQLite Database      │
│  72 Pretrained Models        │ │    charter.db           │
│  Split-Conformal Calibrator  │ │    Ports, Berths, Calls │
│  Verified 2012–2019 Dataset  │ │    Weather, Tariffs     │
└──────────────────────────────┘ └─────────────────────────┘
```

---

## 2. Verified Data Cutoff & Integrity Rule
- **Historical Development Dataset**: Covers 2012-08-01 through 2019-07-31 (1,749 verified daily sessions).
- **Post-2019 Targets**: When a forecast origin $T_0$ produces target dates beyond 2019-07-31, the model computes valid probabilistic forecasts ($P10, P50, P90$), but the future realization is strictly marked as `NOT_AVAILABLE` (`Post-2019 Unobserved`). No synthetic market observations are fabricated.
- **Conformal Coverage Level**: Nominally 80% (P10 to P90 central prediction band, $\alpha = 0.20$). Realized validation empirical coverage is 80.4%.

---

## 3. Core API Endpoints

| Method | Endpoint | Description | Key Request Fields | Key Response Fields |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/historical/series` | Verified Baltic daily time series | `target`, `start_date`, `end_date`, `limit` | `target`, `count`, `observations` (`obs_date`, `value`, `target`) |
| `POST` | `/api/v1/historical/forecast` | Quantile LightGBM model inference | `target`, `origin_date`, `horizon_sessions`, `vessel_type` | `p10_calibrated`, `p50`, `p90_calibrated`, `conformal_q_hat`, `actual_value`, `actual_status` |
| `GET` | `/api/v1/historical/dates` | Valid forecast origin dates | None | `dates`, `min_date`, `max_date`, `count` |
| `GET` | `/api/v1/historical/routes` | Verified maritime corridors | None | `routes` (`route_id`, `distance_nm`, `origin_port`, `destination_port`) |
| `POST` | `/api/v1/historical/route-estimate` | Corridor voyage economics translation | `target`, `origin_date`, `horizon_sessions`, `route_id`, `cargo_type`, `risk_aversion` | `scenario_p10`, `scenario_p50`, `scenario_p90`, `risk_adjusted_freight_usd_t`, `status`, `compatibility_reasons` |
| `POST` | `/api/v1/optimize-charter` | Constrained charter optimization | `cargo`, `origin_port`, `destination_port`, `required_by`, `as_of`, `risk_aversion`, `n_simulations` | `recommendation`, `cost_breakdown_usd`, `alternatives`, `infeasible`, `explanation` |
| `GET` | `/api/v1/ports` | Port registry | `country`, `role` | `port_id`, `name`, `max_draft_m`, `berth_count`, `authority` |
| `GET` | `/api/v1/ports/{port_id}` | Port constraints dossier | `cargo_type`, `season` | `berths`, `congestion`, `weather`, `vessel_compatibility` |
| `GET` | `/api/v1/historical/market-summary` | Cutoff market levels | None | `indices` (`target`, `latest_value`, `change_30d`) |

---

## 4. Vessel and Horizon Mapping

### Vessel to Index
- **Capesize (180,000 DWT)** $\to$ **BCI** (Baltic Capesize Index)
- **Panamax (82,500 DWT)** $\to$ **BPI** (Baltic Panamax Index)
- **Supramax (58,000 DWT)** $\to$ **BSI** (Baltic Supramax Index)
- **Handysize (38,000 DWT)** $\to$ **BHSI** (Baltic Handysize Index)

### Supported Discrete Forecast Horizons
- $h \in \{7, 14, 28, 60, 90, 180\}$ Baltic Exchange trading sessions.

---

## 5. Canonical Frontend Response Models

### Forecast Canonical Model (`src/api/forecast.js`)
```javascript
{
  target: string,             // e.g. "BPI"
  vesselType: string,         // e.g. "Panamax"
  originDate: string,         // "YYYY-MM-DD"
  targetDate: string,         // "YYYY-MM-DD" or "OUT_OF_SAMPLE_POST_2019"
  horizonSessions: number,    // 7, 14, 28, 60, 90, 180
  p10: number,                // Real calibrated lower bound (p10_calibrated)
  p50: number,                // Real median forecast (p50)
  p90: number,                // Real calibrated upper bound (p90_calibrated)
  conformalQHat: number,      // Residual adjustment factor
  actualValue: number | null, // Verified actual if targetDate <= 2019-07-31
  actualStatus: string,       // "OBSERVED" | "NOT_AVAILABLE"
  nominalCoverage: 0.80,      // 80% central interval
}
```

---

## 6. How to Run & Verify

### Backend Server
```bash
cd backend-work
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
- API Docs: `http://127.0.0.1:8000/docs`
- Health Endpoint: `http://127.0.0.1:8000/api/v1/health`

### Frontend Application
```bash
cd frontend-work
npm run dev
```
- Web Application: `http://localhost:5173/`

### Running Test Suites
```bash
# 1. Backend tests (99 passed)
cd backend-work
python -m pytest tests

# 2. ML pipeline tests (73 passed)
cd ml-work
python -m pytest tests

# 3. Frontend production bundle build
cd frontend-work
npm run build
```
