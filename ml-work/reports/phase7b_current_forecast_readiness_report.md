# Phase 7B Current Forecast Readiness Report
**Project:** SIH26006 — Intelligent Freight Forecasting & Charter Decision Support  
**Evaluation Date:** September 2026  
**Auditor:** Antigravity (Lead System Integration Engineer)  

---

## 1. System Readiness Declaration

| Parameter | State | Audit Notes |
| :--- | :--- | :--- |
| **CURRENT FORECAST READY** | **NO (BLOCKED)** | In strict compliance with Absolute Data Integrity Rules. Awaiting authorized post-2019 dataset. |
| **HISTORICAL BACKTEST READY** | **YES (ACTIVE)** | Operating on 1,749 verified Baltic Exchange trading sessions (2012-08-01 to 2019-07-31). |
| **DATA CUTOFF** | **2019-07-31** | Real data boundary. Zero extrapolation into 2020–2026. |
| **DATASET VERSION** | `baltic_dry_subindices_v20190731_1749` | SHA-256 verified sidecar registered. |
| **MODEL VERSION** | `phase5_quantile_lgbm_conformal_v1` | 72 Quantile LightGBM models (24 task triplets) in `ml-work/models/saved_models/`. |
| **CALIBRATION VERSION** | `split_conformal_val_only_80pct_v1` | Validation-only nonconformity calibration ($\hat{q}$). |

---

## 2. Target Index Availability Matrix

| Target Index | Vessel Class | Historical Availability (2012–2019) | Post-2019 Availability | Status |
| :--- | :--- | :--- | :--- | :--- |
| **BCI** | Capesize (180k DWT) | 1,749 sessions | NOT AVAILABLE | Operating in Historical Backtest Mode |
| **BPI** | Panamax (75–82k DWT) | 1,749 sessions | NOT AVAILABLE | Operating in Historical Backtest Mode |
| **BSI** | Supramax (58–64k DWT) | 1,749 sessions | NOT AVAILABLE | Operating in Historical Backtest Mode |
| **BHSI** | Handysize (38k DWT) | 1,749 sessions | NOT AVAILABLE | Operating in Historical Backtest Mode |

---

## 3. Approved Temporal Split Architecture

When authorized post-2019 data is deposited into `ml-work/data/raw/post_2019/candidate_sources/`, the pipeline will automatically execute:

- **TRAIN SPLIT:** `2015-01-01` to `2022-12-31` (Model fitting on multi-year post-crash regime)
- **VALIDATION SPLIT:** `2023-01-01` to `2024-12-31` (Hyperparameter tuning, model selection & conformal calibration)
- **TEST SPLIT:** `2025-01-01` to present (Frozen single-pass out-of-sample evaluation)

---

## 4. Current Mode Blockers & Next Human Action

### Blockers:
1. Candidate source directory `ml-work/data/raw/post_2019/candidate_sources/` currently contains 0 data files.
2. Official Baltic Exchange API requires commercial licensing credentials not present in local environment variables.
3. No composite $BDI$ dataset or unauthorized scrape will be accepted as a substitute for legitimate $BCI, BPI, BSI, BHSI$ sub-indices.

### Next Action Required from Human:
Export or obtain authorized daily CSV observations for BCI, BPI, BSI, BHSI (from 2019-08-01 to present) via official Baltic Exchange credentials or an institutional library terminal, deposit into `ml-work/data/raw/post_2019/candidate_sources/`, and run:
```bash
python ml-work/scripts/validate_post_2019.py
python ml-work/scripts/build_extended_features.py
python ml-work/scripts/train_final_models.py
```
Upon successful validation and retraining, `readiness_checker.py` will flip `current_forecast_ready = True` and enable **CURRENT MARKET MODE** across both FastAPI and the React dashboard.
