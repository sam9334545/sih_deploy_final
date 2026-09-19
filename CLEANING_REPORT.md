# DATA CLEANING REPORT: Baltic Panamax Index (BPI)

**Project:** SIH26006 — Intelligent Freight Forecasting System  
**Component:** ML Dataset Preparation Pipeline  
**Execution Script:** [`scripts/clean_bpi.py`](file:///c:/Users/win11/Downloads/sih/scripts/clean_bpi.py)  
**Input (Raw):** [`data/raw/original_dataset.csv`](file:///c:/Users/win11/Downloads/sih/data/raw/original_dataset.csv)  
**Output (Cleaned):** [`data/processed/bpi_cleaned.csv`](file:///c:/Users/win11/Downloads/sih/data/processed/bpi_cleaned.csv)  
**Execution Timestamp:** 2026-09-19 00:40:30 UTC  
**Blueprint Reference:** [`SIH26006_Blueprint (1).md`](file:///c:/Users/win11/Downloads/sih/SIH26006_Blueprint%20%281%29.md) (§9.1, §17.1, §22, §44)

---

## 1. Executive Summary of Operations

| Metric / Parameter | Value |
|:---|:---|
| **Original Raw Dataset Total Rows** | 10,055 rows (multi-series: BDI, BCI, BPI, BSI, BHSI) |
| **Initial Filtered BPI Rows** | 2,011 rows |
| **Cleaned Output Rows** | **2,011 rows** |
| **Rows Removed** | **0 rows** (all 2,011 observations are valid and preserved) |
| **Exact Duplicate Rows Found** | 0 |
| **Duplicate Dates Found** | 0 |
| **Missing Values in `value` / `tc_avg_usd_day`** | 0 (0.00%) |
| **Invalid / Unparseable Dates** | 0 |
| **Missing Monday–Friday Business Days** | 0 (complete 5-day trading calendar) |
| **Weekend Observations** | 0 (all weekend rows excluded) |
| **IQR Statistical Outliers Identified** | 63 observations ($[1066.26, 2102.64]$ bounds) |
| **Outliers Intentionally NOT Removed** | 63 observations (100% preserved) |
| **Extreme Daily Jumps (> 10%)** | 8 observations (preserved as valid market dynamics) |
| **Final Columns** | `obs_date`, `index_code`, `bpi_value`, `tc_avg_usd_day`, `source_url`, `provenance_tag` |
| **Final Date Range** | **2019-01-01** to **2026-09-15** (2,815 calendar days; 2,011 business days) |

---

## 2. Detailed Inspection of the Raw Dataset

Prior to running any transformation or extraction, the raw file [`data/raw/original_dataset.csv`](file:///c:/Users/win11/Downloads/sih/data/raw/original_dataset.csv) was inspected in an immutable manner:

1. **Multi-Series Structure**:
   - The file contains 5 dry bulk indices generated for the blueprint's benchmark suite:
     - `BDI` (Baltic Dry Index composite): 2,011 rows
     - `BCI` (Baltic Capesize Index): 2,011 rows
     - `BPI` (Baltic Panamax Index): 2,011 rows
     - `BSI` (Baltic Supramax Index): 2,011 rows
     - `BHSI` (Baltic Handysize Index): 2,011 rows
   - Total rows: $5 \times 2,011 = 10,055$ records.
2. **Column Names and Formats**:
   - `obs_date` (string format: `YYYY-MM-DD`)
   - `index_code` (categorical string: `BPI`, `BCI`, etc.)
   - `value` (numeric index points, float64)
   - `tc_avg_usd_day` (numeric daily hire rate in USD/day, float64)
   - `source_url` (provenance string)

---

## 3. Cleaning & Handling Methodology

### 3.1 Filtering and Isolation
- The BPI series was isolated using `index_code == 'BPI'`.
- The raw multi-series file remains completely untouched in [`data/raw/original_dataset.csv`](file:///c:/Users/win11/Downloads/sih/data/raw/original_dataset.csv).

### 3.2 Duplicate Handling
- **Exact Duplicate Rows:** Checked across all fields (`obs_date`, `index_code`, `value`, `tc_avg_usd_day`). Found: **0**.
- **Duplicate Dates:** Checked for multiple price postings on the same timestamp. Found: **0**. Each observation maps uniquely to one calendar date.

### 3.3 Date Parsing and Calendar Continuity
- Standardized `obs_date` via `pd.to_datetime(..., format='%Y-%m-%d')`.
- Verified zero invalid or out-of-bounds dates.
- Verified chronological ordering: the series is strictly monotonically increasing from `2019-01-01` to `2026-09-15`.
- **Trading Calendar Assessment**:
  - In international maritime economics, the Baltic Exchange calculates benchmarks exclusively on London banking/business days.
  - Generating a synthetic calendar of all standard Monday–Friday dates between `2019-01-01` and `2026-09-15` yields exactly **2,011 business days**.
  - The dataset contains observations on all 2,011 business days, with 0 missing business days and 0 weekend postings.

### 3.4 Missing-Value Handling & Imputation Policy
- Missing values in `value`: **0**
- Missing values in `tc_avg_usd_day`: **0**
- **Imputation Policy**: In accordance with the prompt's instructions (*"never randomly shuffle the time series; do not fill missing values blindly; document any imputation rather than silently filling"*), **NO synthetic imputation, forward-filling, or linear interpolation was applied**. The observed series was kept intact.

### 3.5 Data-Type Conversions
- `obs_date` cast explicitly to ISO-8601 string (`YYYY-MM-DD`).
- `bpi_value` cast to `float64` and rounded to 2 decimal places.
- `tc_avg_usd_day` cast to `float64` and rounded to 2 decimal places.
- `provenance_tag` created as categorical string (`simulated_demo`).

---

## 4. Anomaly, Outlier & Discontinuity Analysis

### 4.1 Statistical Outliers (1.5 × IQR Rule)
Using standard non-parametric quartile thresholds:
- First Quartile ($Q_1$): 1,454.91 points
- Median ($Q_2$): 1,568.35 points
- Third Quartile ($Q_3$): 1,714.00 points
- Interquartile Range ($IQR$): 259.10 points
- Lower Bound ($Q_1 - 1.5 \times IQR$): 1,066.26 points
- Upper Bound ($Q_3 + 1.5 \times IQR$): 2,102.64 points

A total of **63 observations** fall above the upper bound (values between 2,102.64 and 2,478.45).

### 4.2 Why Outliers Were Intentionally NOT Removed

> [!IMPORTANT]
> **DOMAIN KNOWLEDGE DISTINCTION: Market Volatility vs Data Error**  
> In shipping economics, dry bulk freight rates exhibit extreme right-skewness and episodic super-cycles driven by inelastic short-run fleet supply and demand shocks (e.g. port congestion, grain harvest seasons, post-pandemic demand spikes).
>
> 1. The observed peaks (e.g. April 2022 levels reaching 2,200–2,478 points) are economically realistic for the Panamax market (historically, during the 2007–2008 commodity boom, the BPI exceeded 10,000 points; during the 2021–2022 post-COVID supply chain crunch, BPI regularly traded between 2,500 and 4,000 points).
> 2. The values are non-negative, well within historical physical bounds, and display smooth autoregressive continuity rather than single-day isolated spikes.
> 3. Arbitrarily clipping or deleting these values would distort the empirical tail distribution, understate market volatility, and lead to overly optimistic (and catastrophic) freight cost estimates in the Charter Strategy Simulator.

### 4.3 Daily Jumps and Discontinuities
- Daily returns were evaluated: $\Delta = \frac{v_t - v_{t-1}}{v_{t-1}}$.
- Only **8 days** out of 2,011 exhibited daily price movements $> 10\%$:
  - `2020-01-13`: $+11.59\%$
  - `2020-03-02`: $-11.03\%$
  - `2022-06-06`: $-12.17\%$
  - `2023-04-03`: $-10.68\%$
  - `2024-02-26`: $+11.89\%$
  - `2024-08-12`: $-10.85\%$
  - `2025-12-01`: $+13.78\%$
  - `2026-01-05`: $+10.06\%$
- None of these jumps indicate single-point transcription corruption; they represent modeled seasonal or market transitions.

### 4.4 Consecutive Identical Values
- Exactly **1 occurrence** of consecutive identical values was identified:
  - `2025-06-06` (Friday): $1676.30$
  - `2025-06-09` (Monday): $1676.30$
- Because this occurs across a non-trading weekend where market levels opened unchanged on Monday, this is completely normal market behavior.

---

## 5. Cleaned Dataset Schema

The cleaned dataset [`data/processed/bpi_cleaned.csv`](file:///c:/Users/win11/Downloads/sih/data/processed/bpi_cleaned.csv) contains:

| Column Name | SQL / Python Type | Description | Null Count | Sample Value |
|:---|:---|:---|:---|:---|
| `obs_date` | `VARCHAR(10)` / `object` | Observation date in ISO-8601 format (`YYYY-MM-DD`) | 0 | `2019-01-01` |
| `index_code` | `VARCHAR(10)` / `object` | Baltic index classification code (`BPI`) | 0 | `BPI` |
| `bpi_value` | `NUMERIC(10,2)` / `float64` | Baltic Panamax Index assessment in points | 0 | `1686.06` |
| `tc_avg_usd_day` | `NUMERIC(10,2)` / `float64` | Panamax 5TC average charter rate ($/day) | 0 | `15174.54` |
| `source_url` | `TEXT` / `object` | Attribution and origin URL | 0 | `https://www.balticexchange.com/ (simulated demo series)` |
| `provenance_tag` | `VARCHAR(20)` / `object` | Data authenticity flag (`simulated_demo`) | 0 | `simulated_demo` |

---

## 6. Unresolved Problems & Pre-ML Requirements

1. **Synthetic Lineage**: The series is generated by an Ornstein–Uhlenbeck process. While statistically well-behaved (mean = 1,599, std = 221), it lacks genuine geopolitical regime changes, actual canal blockage shocks (e.g. Red Sea/Suez crisis or Panama Canal drought draft restrictions), and real forward freight curve dynamics.
2. **Fixed Linear TC Ratio**: In this raw series, `tc_avg_usd_day` is strictly $9.00 \times \text{value}$ with zero residual variance. In real Baltic Exchange assessments, the conversion factor fluctuates based on bunker fuel prices, scrubber premiums, and ballast leg economics.
3. **Transition to Production Feed**: To transition from prototype to production, the ingestion pipeline must be pointed to a verified historical Baltic Exchange feed (or licensed third-party mirror) as specified in Blueprint §11.2 and §44.
