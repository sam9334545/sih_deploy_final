# SIH26006 — Comprehensive Data Provenance & Legal Registry

**System:** Intelligent Freight Forecasting System (SIH26006)  
**Last Updated:** 19 September 2026  
**Status:** Audit Verified · Category A Real Datasets Acquired  
**Authoritative Reference:** [`SIH26006_Blueprint.md`](file:///c:/Users/win11/Downloads/sih/SIH26006_Blueprint.md)

---

## 1. Core Freight Targets

### Baltic Panamax Index (BPI)
* **Status:** 🟢 **Verified Real Historical Data Acquired (2012–2019)**
* **Provider:** Dr. Bangar Raju (University of Petroleum and Energy Studies, Dehradun, India)
* **Source:** Mendeley Data (Elsevier) — Dataset: *baltic dry index freight rates47*
* **DOI / URL:** [10.17632/t76ckh2ygg.1](https://doi.org/10.17632/t76ckh2ygg.1)
* **Date Range:** `2012-08-01` to `2019-07-31` (1,749 daily observations)
* **Frequency:** Daily (Standard trading days)
* **Units:** Baltic Index Points
* **Access Method:** Direct public API download (`t76ckh2ygg/1`)
* **Licence:** **Creative Commons Attribution 4.0 International (CC BY 4.0)**
* **Usage Status:** Full commercial/academic redistribution and reuse permitted with attribution.
* **Notes:** Contains column `PI` representing measured daily Baltic Panamax Index assessments.

### Baltic Capesize Index (BCI)
* **Status:** 🟢 **Verified Real Historical Data Acquired (2012–2019)**
* **Provider:** Dr. Bangar Raju (UPES India) via Mendeley Data
* **DOI / URL:** [10.17632/t76ckh2ygg.1](https://doi.org/10.17632/t76ckh2ygg.1)
* **Date Range:** `2012-08-01` to `2019-07-31` (1,749 daily observations)
* **Frequency:** Daily
* **Licence:** **CC BY 4.0**
* **Notes:** Represented by column `CI` in the acquired Mendeley dataset.

### Baltic Supramax Index (BSI)
* **Status:** 🟢 **Verified Real Historical Data Acquired (2012–2019)**
* **Provider:** Dr. Bangar Raju (UPES India) via Mendeley Data
* **DOI / URL:** [10.17632/t76ckh2ygg.1](https://doi.org/10.17632/t76ckh2ygg.1)
* **Date Range:** `2012-08-01` to `2019-07-31` (1,749 daily observations)
* **Frequency:** Daily
* **Licence:** **CC BY 4.0**
* **Notes:** Represented by column `SI` in the acquired Mendeley dataset.

### Baltic Handysize Index (BHSI)
* **Status:** 🟢 **Verified Real Historical Data Acquired (2012–2019)**
* **Provider:** Dr. Bangar Raju (UPES India) via Mendeley Data
* **DOI / URL:** [10.17632/t76ckh2ygg.1](https://doi.org/10.17632/t76ckh2ygg.1)
* **Date Range:** `2012-08-01` to `2019-07-31` (1,749 daily observations)
* **Frequency:** Daily
* **Licence:** **CC BY 4.0**
* **Notes:** Represented by column `HSI` in the acquired Mendeley dataset.

### Time Charter (TC) Average ($/day)
* **Status:** 🟢 **Derived from Index Points**
* **Provider:** Baltic Exchange panel fixture weighting / Standard conversion
* **Date Range:** `2012-08-01` to `2019-07-31`
* **Licence:** Academic calculation
* **Notes:** Standard Baltic Panamax P5TC equivalent rates are linked to BPI points via calibrated fixture ratios ($9.00 \times \text{BPI}$).

---

## 2. Exogenous Variables

### Fuel: Brent Crude Oil Spot Price
* **Status:** 🟢 **Verified Real Data Acquired (1987–2026)**
* **Series ID:** `DCOILBRENTEU`
* **Provider:** U.S. Energy Information Administration (EIA) via FRED
* **URL:** `https://fred.stlouisfed.org/series/DCOILBRENTEU`
* **Date Range:** `1987-05-20` to `2026-09-15` (10,260 daily rows)
* **Frequency:** Daily
* **Units:** USD per barrel ($/bbl)
* **Licence:** **U.S. Government Work (Public Domain)**
* **Usage Status:** Unrestricted public redistribution.

### Foreign Exchange: USD to INR Spot Rate
* **Status:** 🟢 **Verified Real Data Acquired (1973–2026)**
* **Series ID:** `DEXINUS`
* **Provider:** Board of Governors of the Federal Reserve System via FRED
* **URL:** `https://fred.stlouisfed.org/series/DEXINUS`
* **Date Range:** `1973-01-02` to `2026-09-11` (14,009 daily rows)
* **Frequency:** Daily
* **Units:** Indian Rupees per 1 USD
* **Licence:** **U.S. Government Work (Public Domain)**
* **Usage Status:** Unrestricted public redistribution.

### Bulk Cargo: Global Thermal Coal (Australia)
* **Status:** 🟢 **Verified Real Data Acquired (1992–2026)**
* **Series ID:** `PCOALAUUSDM`
* **Provider:** International Monetary Fund (IMF) via FRED
* **URL:** `https://fred.stlouisfed.org/series/PCOALAUUSDM`
* **Date Range:** `1992-01-01` to `2026-07-01` (415 monthly rows)
* **Frequency:** Monthly
* **Units:** USD per Metric Ton
* **Licence:** **Open IMF Economic Data Terms**
* **Usage Status:** Unrestricted public redistribution.

### Bulk Cargo: Global Iron Ore (62% Fe CFR China)
* **Status:** 🟢 **Verified Real Data Acquired (1992–2026)**
* **Series ID:** `PIORECRUSDM`
* **Provider:** International Monetary Fund (IMF) via FRED
* **URL:** `https://fred.stlouisfed.org/series/PIORECRUSDM`
* **Date Range:** `1992-01-01` to `2026-07-01` (415 monthly rows)
* **Frequency:** Monthly
* **Units:** USD per Dry Metric Ton
* **Licence:** **Open IMF Economic Data Terms**
* **Usage Status:** Unrestricted public redistribution.

### Macro Freight Proxy: Producer Price Index for Deep Sea Bulk Freight
* **Status:** 🟢 **Verified Real Data (1988–2026)**
* **Series ID:** `PCU4831114831115`
* **Provider:** U.S. Bureau of Labor Statistics (BLS) via FRED
* **Date Range:** `1988-06-01` to `2026-08-01` (459 monthly rows)
* **Licence:** **U.S. Government Work (Public Domain)**
* **Usage Status:** Unrestricted public redistribution.

### Marine Operations & Weather
* **Status:** 🟢 **Verified Real API Service**
* **Provider:** Open-Meteo Marine Weather API / Copernicus Marine Service
* **Coverage:** 1940 to Present reanalysis + 7-day marine forecast
* **Variables:** Significant wave height (m), swell period (s), surface wind speed (m/s)
* **Licence:** **CC BY 4.0**
* **Usage Status:** Open access for research and non-commercial projects.

---

## 3. Synthetic / Demo Data (Clearly Labelled)

The following files exist in the repository strictly for end-to-end software integration and hackathon testing:

1. **`ml-work/data/raw/original_dataset.csv` & `backend-work/data/reference/demo/freight_index.csv`:**
   * **Generator:** `backend-work/scripts/generate_demo_series.py` (Ornstein–Uhlenbeck mean-reversion, seed `26006`, $L=1650, \kappa=0.010, \sigma=0.020, A=0.15$).
   * **Classification:** **D — SYNTHETIC/DEMO**
   * **Why NOT final training data:** Generated mathematically by formula. Models trained exclusively on it would memorize the synthetic generator's parameters rather than real shipping market dynamics.
2. **`backend-work/data/reference/demo/commodity_price.csv`:**
   * Synthetic price series fixture for backend local simulation.
3. **`backend-work/data/reference/demo/port_call.csv`:**
   * Synthetic berth turn fixture for local development.

---

## 4. Rejected Sources (Audit & Compliance Log)

To maintain strict compliance with legal, ethical, and anti-scraping policies, the following sources were audited and rejected for automated data collection:

1. **Investing.com (`BPNI` / `BDI`):**
   * **Reason Rejected:** Automated requests are actively intercepted by Cloudflare challenge (HTTP 403 Forbidden). Terms of Service explicitly forbid automated scraping and commercial redistribution.
   * **Classification:** **E — UNUSABLE**
   * **Date Checked:** 19 September 2026.
2. **MacroMicro Bulk Freight CSV:**
   * **Reason Rejected:** Direct bulk CSV historical download requires a paid "Max AI" recurring subscription.
   * **Classification:** **B — REAL BUT LICENCE/ACCESS LIMITED**
   * **Date Checked:** 19 September 2026.
3. **TradingView (`INDEX-BDI`):**
   * **Reason Rejected:** Only tracks the composite BDI; sub-indices (Panamax, Capesize) are not supported. API requires paid webhook licenses.
   * **Classification:** **E — UNUSABLE**
   * **Date Checked:** 19 September 2026.
4. **GitHub Scraper Dumps (e.g. `salndang/dry-baltic-index`):**
   * **Reason Rejected:** Contains only composite BDI (2000–2020) with no sub-indices; provenance traces directly to an uncredited Investing.com scraper export without an open data license.
   * **Classification:** **C — REAL BUT PROVENANCE UNCLEAR**
   * **Date Checked:** 19 September 2026.
5. **Zenodo (`The Grapes of Delay` Replication Archive):**
   * **Reason Rejected:** Zenodo repository documentation explicitly confirms that Baltic Panamax Index data is "provider-controlled proprietary data" and cannot be publicly redistributed.
   * **Classification:** **B — REAL BUT LICENCE/ACCESS LIMITED**
   * **Date Checked:** 19 September 2026.
