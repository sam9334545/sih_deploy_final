# Post-2019 Data Validation & Source Assessment Report
**Project:** SIH26006 — Intelligent Freight Forecasting & Charter Optimization  
**Phase:** 7A — Post-2019 Data Acquisition & Readiness  
**Date:** September 2026  
**Status:** BLOCKED_HISTORICAL_ONLY (No unverified/synthetic data fabricated)  

---

## 1. Executive Summary

Phase 7A evaluates all potential sources for post-July 2019 Baltic dry-bulk sub-indices ($BCI, BPI, BSI, BHSI$). In accordance with project rules, commercial licensing requirements are strictly respected and web scraping behind authentication or paywalls is rejected.

As of Phase 7A, **no legitimate open-access dataset containing daily post-2019 Baltic sub-indices exists in the workspace**. Consequently, the system operates in **HISTORICAL_DEVELOPMENT** mode on the verified 2012–2019 dataset, and the validation pipeline is fully built and ready to ingest extended data as soon as authorized access is granted.

---

## 2. Source Evaluation & Provenance Audit

| Source Identifier | Provider | Target Coverage | Access Requirement | License / Legal Status | Audit Decision |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `mendeley_dry_bulk_2012_2019` | Mendeley Data | BCI, BPI, BSI, BHSI (2012–2019) | Open Access (DOI: 10.17632/m645w433cx.1) | CC BY 4.0 | **VERIFIED BASELINE** (1,749 rows) |
| `baltic_exchange_official_api` | The Baltic Exchange Ltd. | BCI, BPI, BSI, BHSI (2000–present) | Commercial API Key / OAuth | Proprietary Commercial | **REQUIRES_AUTHORIZED_ACCESS** (Preferred Primary) |
| `ice_data_services_baltic` | Intercontinental Exchange | BCI, BPI, BSI, BHSI (2008–present) | ICE Terminal / Market Feed | Commercial Redistribution | **REQUIRES_AUTHORIZED_ACCESS** |
| `sp_global_platts_dry_bulk` | S&P Global Platts | Market assessments | Platts Subscription | Enterprise Proprietary | **REQUIRES_AUTHORIZED_ACCESS** |
| `investing_composite_bdi_feed` | Investing.com | BDI only (Composite) | Web / Unofficial | Non-commercial TOS | **REJECTED_AS_TARGET** ($BDI \ne BCI/BPI/BSI/BHSI$) |
| `unauthorized_html_scrapes` | Various portals | Fragmented | Web Scraping / Paywall bypass | Unauthorized | **REJECTED** (Violation of Absolute Integrity Rule) |

---

## 3. Dataset Audit: Baseline vs Post-2019 Candidate

### A. Current Verified Baseline
- **File:** `ml-work/data/processed/real_baltic_multivariate.csv`
- **Rows:** 1,749 official trading sessions
- **Date Span:** 2012-08-01 to 2019-07-31
- **Nulls / NaNs:** 0 across all 4 target indices
- **Extremes / Negatives:** 0
- **Integrity Status:** 100% verified real Baltic Exchange observations

### B. Post-2019 Candidate Search
- **Authorized Credentials in Environment:** None found.
- **Candidate Files in Workspace:** None with verified provenance.
- **Fabrication Policy:** Zero synthetic post-2019 points generated. Zero extrapolation from 2019.

---

## 4. Extended Ingestion Pipeline Architecture

To ensure immediate plug-and-play capability when authorized post-2019 data arrives:
1. **Raw Storage:** `ml-work/data/raw/post_2019/candidate_sources/`
2. **Automated Validation:** `ml-work/pipeline/validate_extended_data.py` enforces:
   - Chronological continuity and date overlap verification with 2012–2019 baseline.
   - Non-positive and NaN detection.
   - Session-over-session jump monitoring ($> 3.5\times$ flagged).
   - Strict index mapping ($CI \to BCI, PI \to BPI, SI \to BSI, HSI \to BHSI$).
3. **Dataset Versioning:** `ml-work/pipeline/dataset_versioning.py` generates deterministic SHA-256 sidecars.
4. **Processed Destination:** `ml-work/data/processed/extended_post_2019/real_baltic_multivariate_extended.csv`.

---

## 5. Known Limitations & Integrity Boundary
- The model cannot and will not claim knowledge of post-2019 market dynamics (e.g. COVID-19 dry bulk crash, 2021 post-lockdown surge, 2022 coal dislocation) until genuine data is ingested.
- Downstream endpoints will return `NOT_AVAILABLE` for any evaluation requested on target dates after 2019-07-31.
