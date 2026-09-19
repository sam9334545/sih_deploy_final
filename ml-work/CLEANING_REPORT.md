# SIH26006 — Real Baltic Multivariate Dataset Cleaning & Validation Report

## Executive Summary
This report is generated deterministically by the modular data pipeline (`ml-work/pipeline/`). It audits the real historical Baltic sub-index dataset (`mendeley_baltic_subindices_2012_2019.csv`, DOI: `10.17632/t76ckh2ygg.1`, CC BY 4.0), validating date continuity, data types, physical constraints, and price jump discontinuities across all four vessel classes without hard-coding individual observations.

---

## 1. Dataset Volume & Pipeline Transformation
* **Original Raw Rows:** 1,749
* **Raw Columns:** `['Date', 'HSI', 'SI', 'PI', 'CI', 'DTI', 'CTI']`
* **Dataset Type:** Verified Real Multivariate Baltic Sub-Indices
* **Exact Duplicate Rows Removed:** 0
* **Conflicting Duplicate Dates:** 0
* **Invalid/Unparseable Dates:** 0
* **Cleaned Target Rows:** 1,749
* **Earliest Observation:** `2012-08-01`
* **Latest Observation:** `2019-07-31`
* **Tanker Indices Dropped:** `DTI` (Dirty Tanker Index) and `CTI` (Clean Tanker Index) were dropped because SIH26006 is strictly for dry bulk vessel chartering (coal and iron ore).

---

## 2. Structural & Statistical Audit
* **Calendar Span:** 2012-08-01 to 2019-07-31 (2,556 calendar days)
* **Actual Trading Days:** 1,749 days
* **Expected Business Days (Mon–Fri):** 1,826 days
* **Missing Business Days:** 77 days (market holidays, zero blind imputation applied)

### Baltic Sub-Indices Summary Statistics
| Index Name | Processed Column | Min Points | Max Points | Mean | Std Dev | IQR Outliers |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Baltic Panamax Index (BPI) | `bpi_value` | 282.00 | 2219.00 | 1030.34 | 388.25 | 1 (Preserved) |
| Baltic Capesize Index (BCI) | `bci_value` | 92.00 | 4438.00 | 1704.38 | 905.08 | 23 (Preserved) |
| Baltic Supramax Index (BSI) | `bsi_value` | 243.00 | 1562.00 | 832.87 | 213.60 | 37 (Preserved) |
| Baltic Handysize Index (BHSI) | `bhsi_value` | 183.00 | 821.00 | 480.94 | 119.34 | 8 (Preserved) |


---

## 3. Daily Jump Discontinuities (|Return| > 10% on BPI)
The pipeline flags price jumps exceeding 10% in a single trading session:

| Date | Previous Value | Current Value | % Change | Policy Action |
| :--- | :--- | :--- | :--- | :--- |
| 2012-10-09 | 647.0 | 712.0 | +10.05% | Preserved (legitimate market volatility) |
| 2012-10-10 | 712.0 | 784.0 | +10.11% | Preserved (legitimate market volatility) |
| 2014-07-03 | 485.0 | 557.0 | +14.85% | Preserved (legitimate market volatility) |
| 2014-07-04 | 557.0 | 640.0 | +14.90% | Preserved (legitimate market volatility) |
| 2015-01-29 | 620.0 | 550.0 | -11.29% | Preserved (legitimate market volatility) |

---

## 4. Final Output Schema
The processed output file [`ml-work/data/processed/real_baltic_multivariate.csv`](file:///c:/Users/win11/Downloads/sih/ml-work/data/processed/real_baltic_multivariate.csv) contains:
1. `obs_date`: ISO-8601 Date (`YYYY-MM-DD`), monotonically increasing.
2. `bpi_value`: Real Baltic Panamax Index points (Float64).
3. `bci_value`: Real Baltic Capesize Index points (Float64).
4. `bsi_value`: Real Baltic Supramax Index points (Float64).
5. `bhsi_value`: Real Baltic Handysize Index points (Float64).
6. `source_url`: Tracking URI (`https://doi.org/10.17632/t76ckh2ygg.1`).
7. `provenance_tag`: `verified_real_mendeley_cc_by_4.0`.

---

## 5. Pipeline Reproducibility Guarantee
Any team member can rerun the pipeline via:
```bash
python ml-work/scripts/run_pipeline.py --input ml-work/data/raw/mendeley_baltic_subindices_2012_2019.csv --output ml-work/data/processed/real_baltic_multivariate.csv --report ml-work/CLEANING_REPORT.md
```
