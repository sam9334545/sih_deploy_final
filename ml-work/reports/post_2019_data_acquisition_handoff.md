# Post-2019 Baltic Market Data Acquisition Handoff
**Project:** SIH26006 — Intelligent Freight Forecasting & Charter Optimization  
**Phase:** 7A Operational Handoff  
**Date:** September 2026  

---

## 1. Current Verified Baseline

| Parameter | Current Status |
| :--- | :--- |
| **Temporal Coverage** | 2012-08-01 through 2019-07-31 |
| **Session Count** | 1,749 verified daily trading sessions |
| **Indices Covered** | BCI (Capesize), BPI (Panamax), BSI (Supramax), BHSI (Handysize) |
| **Dataset Source** | Mendeley Data (DOI: 10.17632/m645w433cx.1), CC BY 4.0 |
| **Completeness** | 0 nulls, 0 duplicates, 100% real Baltic Exchange observations |

---

## 2. Exact Data Requirements Needed for Production Retraining

To transition the software from **HISTORICAL DEVELOPMENT MODE** to **CURRENT MARKET MODE**, the following dataset is required:

- **Target Indices Required:**
  - `BCI` — Baltic Capesize Index
  - `BPI` — Baltic Panamax Index
  - `BSI` — Baltic Supramax Index
  - `BHSI` — Baltic Handysize Index
- **Frequency:** Daily trading sessions (Baltic Exchange publication calendar)
- **Time Horizon Needed:** **2019-08-01 through latest available (2025/2026)**
- **Minimum Acceptable Format:** CSV with `obs_date`, `bci_value`, `bpi_value`, `bsi_value`, `bhsi_value`.

---

## 3. Preferred Authorized Sources

The following legitimate sources have been identified and catalogued in `ml-work/data/source_registry.json`:

1. **The Baltic Exchange Market Data API**
   - *Provider:* The Baltic Exchange Ltd.
   - *Interface:* Direct REST API / Baltic-code data feed.
   - *Status:* `REQUIRES_AUTHORIZED_ACCESS` (Corporate / institutional API credentials needed).
2. **ICE Freight Market Data Feed**
   - *Provider:* Intercontinental Exchange (ICE Data Services).
   - *Interface:* Commercial terminal / API subscription.
   - *Status:* `REQUIRES_AUTHORIZED_ACCESS`.
3. **University / Institutional Library Access**
   - *Provider:* Refinitiv Eikon, Bloomberg Terminal, or Datastream academic license with Baltic Exchange add-on.
   - *Status:* `REQUIRES_AUTHORIZED_ACCESS`.

---

## 4. Sources Evaluated and Rejected

| Source | Reason for Rejection |
| :--- | :--- |
| **Investing.com / Yahoo Finance `^BDI`** | **Composite-only:** Provides headline Baltic Dry Index ($BDI$). $BDI$ cannot replace the four individual sub-indices. Automated scraping also violates Terms of Service. |
| **Public HTML Scrapes / Unofficial Repositories** | **Unauthorized & Unverified:** Scraping behind logins or paywalls violates SIH26006 Absolute Data Integrity Rules. Unverified GitHub dumps lack provenance attribution. |
| **Synthetic / Statistical Extrapolation** | **Fabrication:** Artificially extrapolating 2019 trends into 2020–2026 is strictly prohibited. |

---

## 5. Exact Next Action Required From a Human

1. **Obtain Authorized Access:** Acquire official API credentials or export licensed CSV observations for BCI, BPI, BSI, and BHSI (covering 2019-08-01 to present) via the Baltic Exchange, ICE, or an institutional terminal.
2. **Deposit Raw File:** Place the exported CSV into:
   ```text
   ml-work/data/raw/post_2019/candidate_sources/baltic_subindices_2019_present.csv
   ```
3. **Run Validation & Ingestion:**
   ```bash
   python ml-work/pipeline/validate_extended_data.py
   ```
4. **Trigger Retraining:**
   Once validated, execute the Phase 7 model training script on the 2015–2022 train / 2023–2024 validation / 2025–present test splits. The backend and frontend will automatically transition to **CURRENT MARKET MODE**.
