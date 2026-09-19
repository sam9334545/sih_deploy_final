# SIH26006 — Real Baltic Dataset Quality & Audit Report

**Phase:** Phase 2 — Rebuilding the ML Data Pipeline Around Verified Real Data  
**Date:** 19 September 2026  
**Status:** Validated · Tested · Reproducible  
**Target File:** [`ml-work/data/processed/real_baltic_multivariate.csv`](file:///c:/Users/win11/Downloads/sih/ml-work/data/processed/real_baltic_multivariate.csv)  
**Raw Source File:** [`ml-work/data/raw/mendeley_baltic_subindices_2012_2019.csv`](file:///c:/Users/win11/Downloads/sih/ml-work/data/raw/mendeley_baltic_subindices_2012_2019.csv)  
**Authoritative Blueprint:** [`SIH26006_Blueprint.md`](file:///c:/Users/win11/Downloads/sih/SIH26006_Blueprint.md)

---

## 1. Source
* **Repository:** Mendeley Data (Elsevier)
* **Dataset Title:** *baltic dry index freight rates47*
* **Author / Provider:** Dr. Bangar Raju (Professor and Maritime Transportation Researcher, University of Petroleum and Energy Studies, India)
* **Permanent DOI:** [10.17632/t76ckh2ygg.1](https://doi.org/10.17632/t76ckh2ygg.1)
* **Original Distribution File:** `edited BDI data1.xls` (Excel Workbook, Sheet: `MASTER EXCEL SHEET BDI `)

---

## 2. Dataset Definition
* **Subject Matter:** Measured daily assessment rates for the primary sub-indices of the Baltic Dry Index (BDI), representing dry bulk shipping freight costs across four standard commercial vessel segments.
* **Measurement Basis:** Baltic Exchange panellist assessments of daily fixtures, voyage fixtures, and time-charter equivalent earnings across designated benchmark international trade routes.

---

## 3. Licence & Provenance
* **Licence:** **Creative Commons Attribution 4.0 International (CC BY 4.0)**
* **Redistribution Rights:** Unrestricted. Legally permissible to share, adapt, commercialize, commit to GitHub, and utilize in student competitions with appropriate attribution.
* **Attribution Requirement:** Citing Dr. Bangar Raju and Mendeley Data DOI `10.17632/t76ckh2ygg.1`.

---

## 4. SHA-256 Hashes
* **Raw Extracted CSV:** `3c5740445d454fa3fa53303666fe2f3ba1f0d3fc1087dd47f48035ee8b4d13e7` ([`mendeley_baltic_subindices_2012_2019.csv`](file:///c:/Users/win11/Downloads/sih/ml-work/data/raw/mendeley_baltic_subindices_2012_2019.csv))
* **Original Binary XLS:** `0689b716f21a10d9510bb6f1739a18c296c1efb8a8c5e4450788e480a15791d4` (`mendeley_bdi.xls`)
* **Processed ML Dataset:** Calculated upon pipeline completion and verified via deterministic test assertions.

---

## 5. Date Range
* **Earliest Observation:** `2012-08-01` (1 August 2012)
* **Latest Observation:** `2019-07-31` (31 July 2019)
* **Total Continuous Horizon:** **7.00 calendar years** (2,556 calendar days)

---

## 6. Frequency
* **Frequency:** Daily (Business / Trading Days).
* **Calendar Model:** Monday through Friday, omitting major international maritime exchange non-trading holidays.

---

## 7. Row Count
* **Raw Input Rows:** 1,749 rows
* **Final Processed Rows:** **1,749 rows**
* **Rows Removed:** **0 rows removed** (100% data retention of valid trading sessions).

---

## 8. Column Definitions & Semantics Mapping

| Dataset Raw Column | Project Standardized Name | Target Vessel Class | Benchmark DWT Range | Units |
| :--- | :--- | :--- | :--- | :--- |
| `Date` | `obs_date` | Trading Session Date | N/A | ISO-8601 (`YYYY-MM-DD`) |
| `PI` | `bpi_value` | Baltic Panamax Index (BPI) | ~60,000 – 85,000 DWT (Kamsarmax 82,500 DWT) | Baltic Index Points |
| `CI` | `bci_value` | Baltic Capesize Index (BCI) | ~150,000 – 210,000 DWT (Standard 180,000 DWT) | Baltic Index Points |
| `SI` | `bsi_value` | Baltic Supramax Index (BSI) | ~50,000 – 65,000 DWT (Tess 58 / Ultramax 64k) | Baltic Index Points |
| `HSI` | `bhsi_value` | Baltic Handysize Index (BHSI)| ~25,000 – 40,000 DWT (Standard 38,200 DWT) | Baltic Index Points |
| `DTI` | *Dropped* | Baltic Dirty Tanker Index (BDTI) | Crude Oil Tankers (VLCC, Suezmax, Aframax) | *Not applicable to bulk coal/ore* |
| `CTI` | *Dropped* | Baltic Clean Tanker Index (BCTI) | Refined Product Tankers (LR1, LR2, MR) | *Not applicable to bulk coal/ore* |

---

## 9. Missing-Value Analysis
* **Dry Bulk Columns (`PI`, `CI`, `SI`, `HSI`):** **0 missing values (0.00%)**. Every single trading session across all 7 years has a measured assessment.
* **Date Column (`Date`):** **0 missing values (0.00%)**.
* **Dropped Tanker Columns:** `CTI` contained 846 missing values in early historical records (2012–2014); this confirmed the decision to drop non-relevant tanker series.
* **Imputation Action:** **Zero blind imputation or forward-fill was performed**. The trading days are natural market observations.

---

## 10. Duplicate Analysis
* **Exact Duplicate Rows:** 0 rows (0.00%)
* **Duplicate Dates:** 0 duplicate dates (0.00%)
* **Conclusion:** The raw Mendeley dataset contains zero duplicate session entries.

---

## 11. Date-Gap Analysis
* **Expected Monday–Friday Business Days (`2012-08-01` to `2019-07-31`):** 1,826 days
* **Actual Trading Days Present:** 1,749 days
* **Missing Business Days (Non-Trading Calendar Days):** 77 days
* **Audit of Gaps:**
  * Every single gap of 1 or 2 business days corresponds to official UK / Singapore Baltic Exchange exchange holidays (Christmas Day, Boxing Day, New Year's Day, Good Friday, Easter Monday, UK Early May Bank Holiday, Spring Bank Holiday, Late Summer Bank Holiday).
  * **Policy Decision:** These gaps are **not** missing data in an operational sense; they are days when the market is closed. They are **not** linearly interpolated or filled, which preserves true financial returns and volatility structures.

---

## 12. Numeric Validity Checks

| Index | Min | Max | Mean | Median | Std Dev | Physical Check (< 0) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **BPI (`bpi_value`)** | 282.00 | 2,219.00 | 1,030.34 | 992.00 | 388.25 | None (0 negative values) |
| **BCI (`bci_value`)** | 92.00 | 4,438.00 | 1,704.38 | 1,587.00 | 905.08 | None (0 negative values) |
| **BSI (`bsi_value`)** | 243.00 | 1,562.00 | 832.87 | 845.00 | 213.60 | None (0 negative values) |
| **BHSI (`bhsi_value`)** | 183.00 | 821.00 | 480.94 | 475.00 | 119.34 | None (0 negative values) |

All values satisfy the physical non-negativity constraint ($> 0.00$).

---

## 13. Anomaly & Outlier Handling

### The Q1 2016 Shipping Downturn Minimums
* In early 2016, BPI hit **282**, BCI dropped to **92**, BSI touched **243**, and BHSI hit **183**.
* **Audit Determination:** These are **NOT** data quality errors. On 10 February 2016, the global Baltic Dry Index (BDI) collapsed to its all-time record low of 290 points due to a simultaneous global commodity slump and severe vessel oversupply.
* **Policy Action:** **Strictly preserved**. Removing these points would blind the downstream forecasting models to severe downside freight market regimes.

### Statistical Outliers (IQR Method)
* `BPI`: 1 outlier (> 2,213.00)
* `BCI`: 23 outliers (> 4,028.50)
* `BSI`: 37 outliers (> 1,365.50)
* `BHSI`: 8 outliers (> 804.00)
* **Policy Action:** **All preserved**. Dry bulk shipping freight rates exhibit classic fat-tailed, positive-skew distributions during market rallies. Trimming these would introduce artificial underprediction of freight spikes.

### Single-Day Jump Discontinuities (|Return| > 10% on BPI)
Five single-day jumps exceeded 10%:
1. `2012-10-09`: +10.05% (647 to 712)
2. `2012-10-10`: +10.11% (712 to 784)
3. `2014-07-03`: +14.85% (485 to 557)
4. `2014-07-04`: +14.90% (557 to 640)
5. `2015-01-29`: -11.29% (620 to 550)
* **Policy Action:** **Preserved**. Verified as legitimate historical freight rate volatility following FFA market contract movements.

---

## 14. Transformations Performed
1. **Date Standardisation:** Converted Excel date strings (e.g. `Jul 31, 2019`) into ISO-8601 strings (`YYYY-MM-DD`).
2. **Chronological Reversal:** The raw sheet was stored in descending order (`2019` to `2012`). The pipeline strictly sorted rows chronologically ascending (`2012-08-01` to `2019-07-31`).
3. **Column Renaming:** Renamed `PI`, `CI`, `SI`, `HSI` to standardized names `bpi_value`, `bci_value`, `bsi_value`, `bhsi_value`.
4. **Tanker Column Removal:** Dropped `DTI` and `CTI` to isolate the dry bulk fleet required by the SIH26006 blueprint.
5. **Precision Formatting:** Explicit rounding to 2 decimal places for consistency.
6. **Provenance Tagging:** Attached `source_url` (`https://doi.org/10.17632/t76ckh2ygg.1`) and `provenance_tag` (`verified_real_mendeley_cc_by_4.0`).

---

## 15. Transformations NOT Performed (Intentionally Avoided)
1. **NO Outlier Deletion:** No high or low freight observations were clipped or dropped.
2. **NO Synthetic Imputation:** No artificial rows were injected for weekend or holiday closures.
3. **NO Future Leakage:** No forward-looking smoothing, future rolling means, or bidirectional interpolation was applied.
4. **NO Synthetic Mixing:** No synthetic 2019–2026 rows from `original_dataset.csv` were appended to the real dataset.
5. **NO Unverified P5TC Derivation:** Time Charter rates were not synthesized or claimed to be observed values.

---

## 16. Final Processed Row Count & File Location
* **Storage Location:** [`ml-work/data/processed/real_baltic_multivariate.csv`](file:///c:/Users/win11/Downloads/sih/ml-work/data/processed/real_baltic_multivariate.csv)
* **Final Processed Rows:** **1,749 rows**
* **Final Processed Columns:** `['obs_date', 'bpi_value', 'bci_value', 'bsi_value', 'bhsi_value', 'source_url', 'provenance_tag']`

---

## 17. Known Limitations
1. **Horizon Ceiling (July 2019):** The real public CC BY 4.0 series terminates on 31 July 2019. The post-2020 Baltic sub-index series remains commercially licensed by the Baltic Exchange.
2. **Recommended Modeling Strategy:** 
   * Train, validate, and test the core ML models on this verified real dataset (`2012-08-01` to `2019-07-31`) using a 5-year train / 1-year val / 1-year test time-aware split.
   * Maintain the calibrated synthetic demo dataset (`original_dataset.csv`) solely for testing 2026 live backend simulation endpoints and frontend UI integration.
