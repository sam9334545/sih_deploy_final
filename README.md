# SIH26006 — Intelligent Freight Forecasting & Charter Decision-Support System

[![Live Production Deployment](https://img.shields.io/badge/Render-Live_Production-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://sih-deploy-final-1.onrender.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![LightGBM](https://img.shields.io/badge/LightGBM-Quantile_Regression-brightgreen?style=for-the-badge)](https://lightgbm.readthedocs.io/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-Production_Container-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests Passing](https://img.shields.io/badge/Tests-393_Passing-success?style=for-the-badge)](file:///docs/PROJECT_STATUS.md)

An end-to-end maritime intelligence and charter decision-support platform designed for dry bulk imports into India's East Coast ports (**Paradip, Dhamra, Haldia, Visakhapatnam, Gangavaram, Gopalpur, Ennore, and Krishnapatnam**).

Developed for **Smart India Hackathon (SIH 2026)** — Problem Statement **SIH26006**.

- **Live Production Platform:** [https://sih-deploy-final-1.onrender.com/](https://sih-deploy-final-1.onrender.com/)
- **Video Demonstration:** [https://youtu.be/KJXbaAhKiio](https://youtu.be/KJXbaAhKiio)

---

## 🌐 Live Production Deployment & Service Endpoints

The complete system is containerized with multi-stage Docker builds and deployed live on Render:

| Service Component | Endpoint / URL | Operational Status | Description |
| :--- | :--- | :---: | :--- |
| **Interactive Web Application** | **[https://sih-deploy-final-1.onrender.com/](https://sih-deploy-final-1.onrender.com/)** | `200 OK (Active)` | Production React 18 client with bilingual English/Hindi localization and accessibility |
| **Video Demonstration** | **[https://youtu.be/KJXbaAhKiio](https://youtu.be/KJXbaAhKiio)** | `Available (YouTube)` | Complete end-to-end video walkthrough of the operational platform and decision engine |
| **Container Readiness Probe** | [`/health/ready`](https://sih-deploy-final-1.onrender.com/health/ready) | `200 OK` | Orchestration probe validating database seed (14 ports, 22 berths) and 24 LightGBM models |
| **Liveness & Lineage Probe** | [`/health`](https://sih-deploy-final-1.onrender.com/health) | `200 OK` | Detailed health report with table row counts, model training cutoff, and memory cache diagnostics |
| **Interactive API Documentation**| [`/docs`](https://sih-deploy-final-1.onrender.com/docs) | `200 OK` | Swagger UI documentation with executable schemas, request validators, and model payload inspectors |
| **OpenAPI Specification** | [`/openapi.json`](https://sih-deploy-final-1.onrender.com/openapi.json) | `200 OK` | Authoritative OpenAPI v3 schema defining all domain models and REST endpoints |

---

## 🎯 What We Are Building: The Problem & Solution

### The Industrial Problem
India’s thermal power stations, blast furnaces, and integrated steel manufacturers import over **200 million metric tonnes** of dry bulk raw materials annually:
- **Coking Coal** from Australia (Hay Point, Gladstone) and the United States (Hampton Roads).
- **Thermal Coal** from Indonesia (Taboneo) and South Africa (Richards Bay).
- **Limestone & Flux Minerals** from the Middle East and Southeast Asia.

Freight is the single largest volatile cost component in raw material landed economics. Freight procurement desks face critical challenges:
1. **Extreme Market Volatility:** Baltic Exchange sub-indices ($BCI, BPI, BSI, BHSI$) fluctuate wildly based on global demand, canal disruptions, and commodity super-cycles.
2. **Hard Physical Port Constraints:** Indian East Coast terminals have varying draft limits (e.g. Haldia has only ~7.5m–8.5m allowable draft; Paradip has ~14.5m; Dhamra has ~17.5m). Capesize vessels cannot enter Haldia and require expensive lighterage at Sandheads anchorage, costing hundreds of thousands of dollars in transshipment fees.
3. **Severe Demurrage Penalties:** Port congestion during monsoon and cyclone periods leads to pre-berthing waiting times of 4 to 12 days. Daily demurrage rates of $15,000 to $35,000 per vessel quickly erode procurement margins.
4. **The Flaw of "Price Oracle" Spreadsheets:** Traditional procurement tools attempt to predict a single deterministic freight price. In the real world, a forecast is an uncertain distribution, not a certainty.

### Our Solution
Our system is **not a naive price prediction tool**. It is an **engineering-grade, risk-aware maritime decision engine**. It takes uncertain probabilistic freight forecasts, subjects them to physical terminal constraints and weather regimes, simulates operational chartering strategies across thousands of stochastic Monte Carlo futures, and delivers an explainable recommendation specifying:
- **Which vessel class to charter** (Capesize, Panamax, Supramax, Handysize).
- **Which contractual structure to sign** (Spot Voyage, Multi-Voyage COA, Index-Linked Variable, or Period Time Charter).
- **Exact landed cost per tonne** in both **USD ($/MT)** and **Indian Rupees (₹/MT)**.
- **Tail-risk exposure (CVaR-90)** and the primary sensitivity drivers via Tornado analysis.

```mermaid
flowchart TD
    subgraph Data ["1. Authoritative Data & Provenance Layer"]
        D1["Verified Real Baltic Sub-Indices (2012-2019 Mendeley CC-BY 4.0)"]
        D2["FRED Macro, Energy & Commodity Series"]
        D3["East Coast Port Constraint Registry (14 Ports, 22 Berths)"]
        D1 --> FE["Feature Engineering Pipeline (Lags, Rolling Vol, Momentum, Seasonal)"]
        D2 --> FE
    end

    subgraph ML ["2. Machine Learning Forecasting Engine"]
        FE --> M1["72 Triplet Quantile LightGBM Models (P10, P50, P90)"]
        M1 --> M2["Split-Conformal Calibration (Empirical Coverage Guarantee)"]
        M2 --> M3["Monotonic Quantile Non-Crossing Enforcement (P10 <= P50 <= P90)"]
    end

    subgraph Constraints ["3. Physical Maritime Engineering Engine"]
        D3 --> C1["Vessel Class Pruning (DWT, Beam, Draft, Air Draft, LOA)"]
        C1 --> C2["Tidal Window & Under-Keel Clearance (UKC >= 10%)"]
        C2 --> C3["Sandheads Lighterage & Part-Load Penalty Model"]
    end

    subgraph Simulation ["4. Monte Carlo Digital Twin & Optimization (Flagship USP)"]
        M3 --> Sim["Monte Carlo Strategy Simulator (N = 1,000 to 5,000 Iterations)"]
        C3 --> Sim
        Sim --> O1["Risk-Adjusted Strategy Ranking: E[Cost] + lambda * CVaR-90"]
        Sim --> O2["7-Factor Tornado Sensitivity Analysis"]
        Sim --> O3["Multi-Origin Procurement Matrix (AU, ID, ZA, US, MZ)"]
    end

    subgraph Interface ["5. Institutional Decision Portal"]
        O1 --> UI["Interactive React 18 Dashboard (Bilingual EN/HI + Accessibility)"]
        O2 --> UI
        O3 --> UI
        O1 --> API["High-Throughput FastAPI REST Backend"]
    end
```

---

## ⚡ The Flagship USP: Monte Carlo Strategy Simulator & Digital Twin

> *"The single most powerful, mathematically rigorous, and commercially transformative component of the platform."*

Most AI systems in freight stop at predicting a price. But a freight desk manager cannot take a price curve to an executive board; they must decide **which charter party contract to sign, which vessel class to fixture, and how much risk the enterprise will absorb**.

The **Strategy Simulator & Monte Carlo Digital Twin** is the crown jewel that turns raw ML forecasts into actionable, risk-defended commercial decisions.

![Charter Strategy Simulator & Monte Carlo Digital Twin](docs/screenshots/strategy_simulator.png)

### Why the Simulator is Transformative
1. **From Deterministic Guessing to Stochastic Reality:**
   Rather than assuming average port waiting times and static fuel prices, the simulator runs **$N = 1,000$ to $5,000$ joint Monte Carlo iterations**. Each iteration simulates a realistic future where freight indices fluctuate, monsoonal weather delays arrivals, port queues spike, and daily demurrage accrues non-linearly.
2. **Evaluates 5 Realistic Commercial Procurement Archetypes:**
   - **S1 — Single-Voyage Spot Charter:** Buys freight on the open market at laycan; highly exposed to spot spikes and unpredictable demurrage.
   - **S2 — Short-Term Multi-Voyage Contract (COA):** Locks in forward capacity across multiple consecutive voyages with negotiated demurrage caps.
   - **S3 — Index-Linked Floating Rate Charter:** Floats with the published Baltic Index at fixture plus a collar buffer.
   - **S4 — Period Time Charter (6-Month Fixed):** Fixes daily hire ($/day); charterer bears bunker consumption and steaming speed variance.
   - **S5 — Split / Lighterage Operation:** Utilizes a massive Capesize bulker to deep-water anchorage combined with shallow-draft barging into draft-restricted berths (e.g. Haldia via Sandheads).
3. **Tail-Risk Quantification via CVaR-90:**
   Standard procurement looks only at expected mean cost ($\mu$). Our digital twin computes **Conditional Value at Risk ($\text{CVaR}_{90}$)** — the expected landed cost in the **worst 10% of market scenarios**. This protects buyers from bankruptcy-level freight spikes.
4. **Interactive Risk-Aversion Slider ($\lambda \in [0.0, 1.0]$):**
   Allows executives to tailor recommendations to their corporate mandate:
   $$\text{Decision Score} = \mathbb{E}[\text{Landed Cost}] + \lambda \times \text{CVaR}_{90}[\text{Landed Cost}]$$
   - $\lambda = 0.0$: Risk-neutral (purely minimizes average cost).
   - $\lambda = 0.5$: Balanced institutional benchmark.
   - $\lambda = 1.0$: Extreme risk-averse (prioritizes guaranteed budget certainty).
5. **7-Factor Tornado Sensitivity Analysis:**
   Directly below the simulation curves, an automated sensitivity engine systematically applies $\pm 20\%$ shocks across:
   - Freight Rate Volatility (Index shock)
   - Port Waiting Days (Queue depth)
   - Demurrage Daily Rate ($/day)
   - Bunker Fuel Price (VLSFO / MGO $/MT)
   - Currency Exchange Rate (USD/INR)
   - Vessel Steaming Speed (Eco vs Normal)
   - Port Tariffs & Canal Tolls
   
   This instantly reveals which physical or financial variable is the primary driver of procurement risk.

---

## 📸 Platform Walkthrough & Feature Showcase

All screenshots are captured directly from the live production deployment and cropped cleanly to focus on the operational interfaces without empty margins or window outlines.

---

### 1. Executive Intelligence Homepage
The primary operational overview delivering immediate situational awareness across global dry bulk indices, active terminal queues, and current procurement posture.

![Executive Intelligence Homepage](docs/screenshots/homepage.png)

#### Operational Capabilities & Key Metrics:
- **Global Baltic Benchmarks:** Real-time BCI, BPI, BSI, and BHSI levels with 7-day trend indicators.
- **Executive Decision Scorecard:** Highlights the current winning procurement strategy, landed cost benchmark in USD/MT and INR/MT, and active corridor recommendations.
- **Port Congestion Index:** Live waiting-day estimates across East Coast Indian coal berths.
- **Scientific Cutoff Notice:** Transparent data environment indicator (`HISTORICAL_DEVELOPMENT` with 2019-07-31 cutoff), guaranteeing zero data fabrication.

---

### 2. Institutional Bilingual Accessibility (हिन्दी / English)
Full institutional localization adhering to the Official Language Policy of the Government of India for Public Sector Undertakings (PSUs), state electricity boards, and port authorities.

![Bilingual Hindi Interface](docs/screenshots/hindi_bilingual.png)

#### Localization Capabilities:
- **Complete Terminology Translation:** Every navigation link, header, button, KPI card, and decision banner dynamically translates into professional standard Hindi:
  - *डैशबोर्ड* (Dashboard), *चार्टर योजनाकार* (Charter Planner), *भाड़ा पूर्वानुमान* (Freight Forecast), *बंदरगाह विश्लेषण* (Port Intelligence), *पोत अनुकूलक* (Vessel Optimizer), *रणनीति सिम्युलेटर* (Strategy Simulator), *जोखिम और अलर्ट* (Risk & Alerts).
- **Persistent Preference:** Language state is preserved across sessions and accessible via a single click in the top utility bar.

---

### 3. Screen Reader Access & GIGW 3.0 / WCAG 2.1 AA Compliance
Engineered to meet the **Guidelines for Indian Government Websites (GIGW 3.0)** and international **WCAG 2.1 Level AA** standards.

![Screen Reader Access & Accessibility Guide](docs/screenshots/screen_reader_access.png)

#### Accessibility Features:
- **Dedicated Accessibility Modal:** Accessible from any page, presenting an interactive compatibility guide for standard screen-reading tools:
  - **NVDA** (NonVisual Desktop Access) on Windows.
  - **JAWS** (Job Access With Speech).
  - **Apple VoiceOver** on macOS and iOS.
  - **Android TalkBack** and **Windows Narrator**.
- **Keyboard Navigation & Access Keys:** Complete skip-to-content anchors (`#main-content`), ARIA dialog roles, and screen-reader status announcements for live chart updates.
- **Dynamic Text Resizer:** One-click font sizing ($A-, A, A+$) adjusting root typography without breaking layout proportions.

---

### 4. Probabilistic Freight Forecasting Engine
Machine-learned quantile regression replacing guesswork with mathematical certainty bands.

![Probabilistic Freight Forecast](docs/screenshots/freight_forecast.png)

#### Technical Rationale:
- **Quantile Fan Chart ($P_{10}, P_{50}, P_{90}$):** Visualizes the full probability distribution over 6 discrete trading session horizons ($h \in \{7, 14, 28, 60, 90, 180\}$ days).
- **Split-Conformal Calibration ($\pm \hat{q}$):** Empirically calibrated adjustment factors ensuring at least 80% coverage on out-of-sample market observations.
- **Monotonic Non-Crossing Enforcement:** Mathematical guarantee that $P_{10} \le P_{50} \le P_{90}$ holds across all time steps.

---

### 5. Charter Planner & Landed Cost Breakdown
The operational freight desk workflow translating corporate orders into optimized fixtures.

![Charter Planner](docs/screenshots/charter_planner.png)

#### Decision Workflow:
- **Cargo Specification:** Commodity selection (Coking Coal, Thermal Coal, Iron Ore), parcel tonnage, and laycan window.
- **Constraint Pruning:** Physical draft, beam, and LOA validation against selected destination terminal.
- **Itemized Cost Accounting:** Landed cost in USD/MT and INR/MT detailing ocean freight, bunker burn, port tariffs, demurrage risk, and lighterage fees.
- **Explainable Decision Drivers:** Human-readable reasoning explaining why the recommended vessel/contract was selected and why alternatives were ruled out.

---

### 6. Interactive Maritime Terminal Radar & Navigational Corridors
The geographic intelligence and route-planning simulation engine mapping international bulk supply chains into India's maritime gateways.

![Maritime Terminal Radar & Navigational Corridors](docs/screenshots/maritime_radar_corridors.png)

#### Operational Capabilities & Navigational Rationale:
- **9-Stage End-to-End Decision Workflow Banner:** A structured, guided procurement sequence across the top of the interface:
  $$\text{Cargo Requirement} \to \text{Freight Forecast} \to \mathbf{Port\ Constraints} \to \text{Vessel Feasibility} \to \text{Charter Strategies} \to \text{Monte Carlo Sim} \to \text{Risk-Adjusted Cost} \to \text{Recommendation} \to \text{Why This Decision?}$$
- **Dynamic Maritime Corridors:** Interactive geodesic route simulator dynamically rendering Great Circle sailing tracks from primary overseas loading origins to Indian receiving terminals (e.g. **Richards Bay, South Africa $\to$ Dhamra Port, India** shown above with active green dotted corridor line).
- **6 Global Loading Origins Supported:**
  - **AUHPT:** Hay Point (Australia) — Premium Hard Coking Coal.
  - **AUGLT:** Gladstone (Australia) — Coking & Thermal Coal.
  - **IDTBA:** Taboneo (Indonesia) — High-Moisture Sub-Bituminous Thermal Coal.
  - **ZARBY:** Richards Bay (South Africa) — High-CV RB1/RB2 Thermal Coal.
  - **USHAM:** Hampton Roads / Norfolk (USA) — Low-Vol Coking Coal.
  - **MZBEW:** Beira (Mozambique) — Hard Coking Coal.
- **7 Major East Coast Receiving Terminals & Anchorages:**
  - **Dhamra (INDHA):** 17.5m draft deep-water private terminal accommodating fully-laden Capesize bulkers.
  - **Gangavaram (INGGV):** 18.0m draft deep-water terminal with rapid conveyor discharge.
  - **Paradip (INPRT):** 16.5m draft major port with mechanized and semi-mechanized coal berths.
  - **Visakhapatnam (INVTZ):** 14.5m inner / 18.0m outer harbor berths handling Panamax/Capesize.
  - **Haldia (INHAL):** Riverine port restricted to 9.0m draft requiring Sandheads transshipment.
  - **Gopalpur (INGPR):** 9.2m draft commercial facility suited for Supramax parcels.
  - **Sagar / Sandheads Anchorage (INSGD):** 18.0m draft deep-water lighterage zone for ocean bulk transshipment.

---

### 7. Port Technical Constraints & Berth Intelligence Dossier
Detailed technical engineering specifications for all registered East Coast berths.

![Port Intelligence Dossier](docs/screenshots/port_intelligence.png)

#### Terminal Technical Dossier:
- **Berth-Level Engineering Specs:** Verified maximum permissible draft, under-keel clearance (UKC $\ge 10\%$), maximum LOA, beam restrictions, and seasonal monsoonal weather stoppages.
- **Discharge Rates & Demurrage Exposure:** Sourced from official Port Gazette schedules (TAMP) to compute accurate demurrage exposure and berth turn-around times.
- **Sandheads Lighterage Calculator:** Evaluates double-banking and barge transfer costs for Haldia-bound parcels.

---

### 8. Vessel Fleet Optimizer Matrix
Engineering evaluation across standard bulk carrier classes against active trade corridors.

![Vessel Fleet Optimizer](docs/screenshots/vessel_optimizer.png)

#### Vessel Classes Evaluated:
- **Capesize (180,000 DWT / 18.2m Draft):** Maximum scale economy for deep-water berths.
- **Panamax / Kamsarmax (82,000 DWT / 14.5m Draft):** Core coal import workhorse.
- **Supramax / Ultramax (58,000 DWT / 12.8m Draft):** Geared with 4x30T cranes for ports lacking shore crane infrastructure.
- **Handysize (38,000 DWT / 10.5m Draft):** Shallow-draft vessel clearing all East Coast berths without lighterage.

---

### 9. Operational Risk Engine & Active Maritime Alert Simulator
Multi-factor risk scorecard tracking threats to shipping schedule integrity with live crisis scenario injection and mathematical component sensitivity decomposition.

![Operational Risk Engine & Active Maritime Alert Simulator](docs/screenshots/risk_alerts.png)

#### Operational Crisis & Scenario Control:
- **Interactive Crisis Simulator:** Test system resilience and procurement reactions across 5 live operational scenarios:
  1. **Baseline / Normal Operations:** Standard seasonal conditions with baseline tariffs.
  2. **Bay of Bengal Cyclone Warning (Category 4):** Simulates terminal shutdown at Paradip/Dhamra, pre-berthing wait spikes (+7.5 days), and storm demurrage.
  3. **Bunker Fuel Shock (+35%):** VLSFO price spike to $820/MT, re-evaluating time charter hire economics.
  4. **Port Congestion Crisis:** Severe vessel bunching at East Coast coal berths with 12-day pre-berthing queues.
  5. **Red Sea / Chokepoint Escalation:** Cape of Good Hope diversion (+14 sailing days), shifting optimal contract choice toward COA structures.
- **Live Active Alerts Banner:** Dynamic contextual alert stream with automated decision rules and direct in-page anchor navigation to the Risk Registry.

#### Component Risk Decomposition & Perturbation Contribution:
- **Mathematical Sensitivity Methodology ($\pm 1\sigma$):** Component-level risk attributions are computed strictly from partial derivatives of risk-adjusted landed cost under $\pm 1\sigma$ simulation perturbations — **zero hand-tuned or arbitrary weights**.
- **6 Orthogonal Monitored Risk Vectors:**
  1. **Market Freight Risk ($38\%$ typical contribution):** Evaluated from 20-day realized volatility annualized against its 7-year historical distribution.
  2. **Port Congestion Risk:** Monitored against historical P90 pre-berthing waiting telemetry at East Coast receiving terminals (Paradip, Dhamra, Haldia, Visakhapatnam).
  3. **Weather & Cyclone Hazard:** Based on Bay of Bengal IMD cyclone track records and seasonal monsoon stoppage climatology (June–September monsoon and October–November cyclone transition).
  4. **Vessel Availability Risk:** Tonnage supply tightness across Capesize, Panamax, and Supramax vessel classes.
  5. **Route & Corridor Economics:** Bunkering hub spreads (Singapore / Fujairah) and canal detour penalties.
  6. **Demand Volatility:** Macro raw material import velocity and plant inventory depletion rates.
- **Explainable Decision Rules ("What Conditions Would Change This Risk Verdict?"):**
  - Identifies transparent operational triggers required to lower the composite risk score (e.g., market volatility reverting to 12-month median, expected port wait dropping below 2.8 days, or shifting laycan outside the October–December cyclone window).

---

## 🏛️ Canonical Architecture & Repository Structure

```text
SIH26006/
│
├── ml-work/                          # Machine Learning, Econometrics & Route Modeling
│   ├── data/                         # Verified Baltic series (Mendeley Data CC-BY 4.0) + Macro indicators
│   ├── features/                     # Multivariate feature engineering across 6 discrete horizons
│   ├── models/                       # LightGBM quantile regression & split-conformal calibrators
│   │   ├── saved_models/v2/          # 24 authoritative v2 model artifacts + SHA256 checksum manifest
│   │   └── inference.py              # ML inference service & backtest verification
│   ├── forecast_v2/                  # Production LightGBM v2 forecasting pipeline & serving
│   ├── route/                        # Voyage economics, vessel mapping, port constraints, bunker model
│   ├── pipeline/                     # Data cleaning, validation, split configs, readiness checks
│   ├── reports/                      # Benchmark audits, calibration logs, and quality verification
│   └── tests/                        # 254 unit and integration tests (100% passing)
│
├── backend-work/                     # Decision-Support Engine & FastAPI Service
│   ├── app/                          # Routers, schemas, domain services, optimization, simulation
│   │   ├── routers/                  # API endpoints (forecast, optimize, simulate, ports, vessels, health)
│   │   ├── services/                 # Simulator, cost model, optimizer, forecast_v2 adapter
│   │   ├── models.py                 # SQLAlchemy relational domain models
│   │   └── config.py                 # Settings with dynamic Render PORT and environment discovery
│   ├── data/reference/               # Authoritative ports, berths, routes, vessel classes, tariffs
│   ├── scripts/                      # DB bootstrap, shadow freight calibration, production verification
│   ├── tests/                        # 139 API, constraint, and simulation tests (100% passing)
│   ├── requirements.txt              # Production Python dependencies
│   └── Dockerfile                    # Container configuration
│
├── frontend-work/                    # Interactive Web Dashboard (React 18 + Vite)
│   ├── src/                          # Dashboard, Charter Planner, Strategy Simulator, Port Map
│   │   ├── components/               # TornadoChart, CostDistributionChart, PortMap, ProvenanceBadge
│   │   └── pages/                    # 7 primary pages with English/Hindi localization
│   ├── package.json                  # Node dependencies and scripts
│   └── vite.config.js                # Vite dev server with reverse proxy
│
├── docs/                             # Authoritative System & API Documentation
│   ├── screenshots/                  # High-resolution platform demonstration captures
│   ├── api_contract.md               # Full REST endpoint contract & schema documentation
│   ├── assumptions.md                # Complete physical, operational, and commercial assumptions register
│   ├── openapi.json                  # Authoritative OpenAPI v3 specification
│   ├── PROJECT_STATUS.md             # Verification logs & test audit reports
│   └── model_card.md                 # ML model provenance, architecture, and metrics card
│
├── Dockerfile                        # Production-hardened container image for Render deployment
├── docker-compose.yml                # Full-stack local orchestration (backend + frontend)
└── .dockerignore                     # Build context optimization
```

---

## 🔬 Scientific & Data Integrity Guarantees

This platform was developed under strict academic and industrial integrity standards:

1. **Category A Ground-Truth Data:** Baltic Exchange sub-indices ($BCI, BPI, BSI, BHSI$) are sourced directly from verified historical records published under Creative Commons CC-BY 4.0 via Mendeley Data (14,432 observations covering 2012–2019).
2. **Strict Anti-Leakage Cutoff (2019-07-31):** Every model feature, lag, and rolling statistic is computed strictly using observations on or before the forecast origin date ($t \le T$). Target values at $T+h$ are reserved exclusively for out-of-sample skill assessment.
3. **No Fabricated or Synthetic Market Observations:** If legitimate post-2020 Baltic observations are not present in an environment, the system transparently reports `HISTORICAL_DEVELOPMENT` mode with explicit data cutoff notices, rather than generating misleading artificial prices.
4. **Transparent Data Provenance:** Every single response carries an explicit provenance tag:
   - `measured`: Sourced from official published records (e.g. Baltic indices, port gazettes).
   - `derived`: Calculated mathematically by our models (e.g. voyage speed/consumption curves).
   - `estimated`: Documented engineering judgements where no publication exists.
   - `expert_set`: Hand-curated parameters reviewed by maritime experts.

---

## 🧪 Comprehensive Verification & Test Suite

```bash
# 1. Run Complete 20-Gate Production Verification Suite
python scripts/verify_production.py

# 2. Run Backend Unit & Integration Tests (139 tests)
pytest backend-work/tests/

# 3. Run ML Pipeline, Conformal Calibration & Route Tests (254 tests)
pytest ml-work/tests/
```

### Production Verification Gates (20/20 Deterministic Pass)
```text
================================================================================
  SIH26006 PRODUCTION SYSTEM VERIFICATION — 20 CRITICAL GATES
================================================================================
[PASS] 01. Model Artifacts ........................... 24 artifacts (72 quantile models)
[PASS] 02. Model Manifest ............................ 24 manifest records with sha256 checksums
[PASS] 03. LightGBM Runtime .......................... Engine active: lightgbm_v2
[PASS] 04. Conformal Calibration ..................... Split-conformal prediction intervals active
[PASS] 05. Training Cutoff ........................... Cutoff verified: 2019-07-31
[PASS] 06. Health Endpoint ........................... HTTP 200, status=ok, engine=lightgbm_v2
[PASS] 07. Readiness Probe ........................... HTTP 200, ready=True
[PASS] 08. Liveness Probe ............................ HTTP 200, live=True
[PASS] 09. Provenance Registry ....................... 12 sources tracked, model cutoff verified
[PASS] 10. Freight Forecast .......................... BPI 28d P10=1165.1, P50=1322.0, P90=1893.1
[PASS] 11. Charter Optimizer ......................... Winner: Supramax (short_term_multi_voyage)
[PASS] 12. Simulation Engine ......................... N=200/500/1000 tested, Winner=S5
[PASS] 13. Tornado Sensitivity ....................... 7 authoritative shocks computed
[PASS] 14. Multi-Origin Matrix ....................... 6 origins verified: AUHPT, AUGLT, IDTBA, ZARBY, USHAM, MZBEW
[PASS] 15. Ports Registry ............................ 14 reference ports loaded
[PASS] 16. Vessels Registry .......................... 4 standard classes: Handysize, Supramax, Panamax, Capesize
[PASS] 17. Input Validation .......................... Correctly rejects negative tonnage, N > 5000, past deadlines
[PASS] 18. Strict Fallback Guard ..................... require_v2_forecast enforces authoritative v2 delivery
[PASS] 19. Production Config ......................... Wildcard CORS prohibited when DEMO_MODE=false
[PASS] 20. Security Headers .......................... nosniff, SAMEORIGIN, X-XSS-Protection verified
================================================================================
ALL 20 PRODUCTION GATES PASSED DETERMINISTICALLY (20/20)!
TOTAL TESTS PASSING: 393 / 393
```

---

## 🚀 Quickstart & Local Development

### Prerequisites
- Python 3.12+
- Node.js 18+ (for frontend development)
- Docker & Docker Compose (optional for containerized deployment)

### 1. Run the Backend API Server
```bash
# Clone the repository
git clone https://github.com/sam9334545/sih_deploy_final.git
cd sih_deploy_final/backend-work

# Install dependencies
pip install -r requirements.txt

# Seed the reference database (ports, berths, tariffs, demo series)
python -m app.seed

# Start the development server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **API Root:** [http://localhost:8000/](http://localhost:8000/)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Container Readiness Check:** [http://localhost:8000/health/ready](http://localhost:8000/health/ready)

### 2. Run the Frontend Dashboard
```bash
cd ../frontend-work

# Install frontend dependencies
npm install

# Start Vite dev server with proxy to backend
npm run dev
```
- **Web UI:** [http://localhost:5173/](http://localhost:5173/)

### 3. Run with Docker Compose
```bash
# From repository root:
docker-compose up --build
```
- Backend served at `http://localhost:8000`
- Frontend served at `http://localhost:80`

---

## 🚢 Render Deployment Instructions

To deploy this repository to Render as a Web Service:

1. Connect your GitHub account and select repository: `sam9334545/sih_deploy_final`
2. **Environment:** `Docker`
3. **Branch:** `main`
4. **Root Directory:** *(leave blank to use repository root)*
5. **Dockerfile Path:** `./Dockerfile`
6. **Health Check Path:** `/health/ready`
7. **Environment Variables:**
   ```env
   DEMO_MODE=true
   REQUIRE_V2_FORECAST=false
   LOG_LEVEL=info
   CORS_ORIGINS=*
   ```
   *(Render will automatically provide the `PORT` environment variable, which our container dynamically binds to).*

---

## 📜 Academic Citation & Provenance
- Mendeley Data: *Baltic Dry Index Historical Time Series & Fleet Data (2012–2019)*, CC-BY 4.0.
- Federal Reserve Bank of St. Louis (FRED): *Global Macroeconomic & Commodity Indicators*.
- Ministry of Ports, Shipping and Waterways, Government of India: *East Coast Port Handbooks & Tariff Authority for Major Ports (TAMP) Schedules*.
- Smart India Hackathon (SIH 2026) Problem Statement **SIH26006**.
