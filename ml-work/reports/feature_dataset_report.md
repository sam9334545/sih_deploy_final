# SIH26006 — Supervised Forecasting Feature Dataset Report

**Project Title:** Intelligent Freight Forecasting for Optimized Vessel Chartering & Bulk Cargo Procurement  
**Problem Statement ID:** SIH26006  
**Component:** `ml-work/features`  
**Phase:** Phase 3 — Define the Forecasting Dataset  
**Input Source:** `ml-work/data/processed/real_baltic_multivariate.csv` (1,749 clean trading sessions, 2012-08-01 to 2019-07-31)  
**Output Directory:** `ml-work/data/features/` (24 datasets: 4 indices × 6 horizons)  
**Status:** COMPLETE & 100% LEAKAGE-FREE  

---

## 1. Executive Summary

Phase 3 transitions the verified real Baltic multivariate historical data into a rigorous, leakage-safe, supervised tabular forecasting dataset. In compliance with the SIH26006 blueprint:
1. **Target Indices:** BPI (Panamax), BCI (Capesize), BSI (Supramax), BHSI (Handysize).
2. **Forecasting Horizons:** $h \in \{7, 14, 28, 60, 90, 180\}$ trading sessions.
3. **No Model Training:** Models (LightGBM, SARIMA, Baselines) are strictly deferred to Phase 4.
4. **No Exogenous Contamination:** Macro and commodity data (Brent, bunker, iron ore, coal, FX) are reserved for a future phase after establishing pure freight sub-index baselines.
5. **Zero Data Leakage:** Mathematical point-in-time isolation was enforced and empirically verified via automated future-perturbation shock tests.

---

## 2. Horizon Definition

### Formal Decision: Discrete Trading Sessions ($h$ Exchange Business Days)

For any forecast origin trading session $t$, the forecast horizon $h$ represents:
$$\text{target}(t, h) = \text{index\_value at trading session } t + h$$

### Rationale & Justification:
* **Exchange Reality:** Baltic dry-bulk sub-indices are published only on active business days by the Baltic Exchange panellists (excluding weekends and UK bank holidays).
* **Calendar Ambiguity Avoidance:** Fixed calendar horizons (e.g. $t + 7 \text{ calendar days}$) regularly fall on non-trading Saturdays, Sundays, or bank holidays. Forward-filling or backward-filling calendar days introduces synthetic interpolations and artificial autocorrelation artifacts.
* **Operational Alignment:** A 7-trading-session forecast represents approximately 9 to 11 calendar days, 14 trading sessions ~ 20 calendar days, 28 trading sessions ~ 40 calendar days, 60 trading sessions ~ 3 calendar months, 90 trading sessions ~ 4.5 calendar months, and 180 trading sessions ~ 9 calendar months (representing short-, medium-, and long-term procurement charters).
* **Metadata Preservation:** To ensure zero loss of temporal context, every generated supervised record explicitly stores `origin_date`, `target_date`, and `calendar_days_elapsed` ($(\text{target\_date} - \text{origin\_date}).\text{days}$).

---

## 3. Supervised Feature Set (39 Feature Columns)

To maintain high interpretability and prevent curse-of-dimensionality overfitting, exactly 39 engineered features are constructed for each forecast origin $t$. Every feature is strictly backward-looking ($\le t$).

### A. Own-Index Historical Lags (10 Features)
* **Lookback Grid:** $k \in \{1, 2, 3, 5, 7, 10, 14, 21, 30, 60\}$
* **Features:** `own_lag_1`, `own_lag_2`, `own_lag_3`, `own_lag_5`, `own_lag_7`, `own_lag_10`, `own_lag_14`, `own_lag_21`, `own_lag_30`, `own_lag_60`.
* **Formula:** $\text{own\_lag\_k}(t) = y(t - k)$
* **Purpose:** Captures short-term persistence, weekly autocorrelations, and monthly momentum patterns.

### B. Own-Index Rolling Window Statistics (10 Features)
* **Windows:** $W \in \{7, 14, 30, 60, 90\}$ trading sessions.
* **Rolling Means:** `own_rolling_mean_7`, `own_rolling_mean_14`, `own_rolling_mean_30`, `own_rolling_mean_60`, `own_rolling_mean_90`.
  $$\text{rolling\_mean\_W}(t) = \frac{1}{W} \sum_{i=0}^{W-1} y(t - i)$$
* **Rolling Volatilities:** `own_rolling_std_7`, `own_rolling_std_14`, `own_rolling_std_30`, `own_rolling_std_60`, `own_rolling_std_90`.
  $$\text{rolling\_std\_W}(t) = \sqrt{\frac{1}{W-1} \sum_{i=0}^{W-1} (y(t - i) - \mu_W)^2}$$
* **Purpose:** Quantifies prevailing market price levels and dynamic charter rate volatility regimes.

### C. Own-Index Momentum & Relative Changes (4 Features)
* **Return Intervals:** $k \in \{1, 7, 14, 30\}$ trading sessions.
* **Features:** `own_return_1`, `own_return_7`, `own_return_14`, `own_return_30`.
* **Formula:** $\text{return\_k}(t) = \frac{y(t) - y(t - k)}{y(t - k)}$
* **Purpose:** Measures percentage rate of acceleration or correction across daily, weekly, bi-weekly, and monthly intervals.

### D. Cross-Index Historical Predictors (9 Features)
* **Indices Used:** The 3 complementary vessel classes. For example, when predicting BPI (Panamax), features incorporate BCI (Capesize), BSI (Supramax), and BHSI (Handysize).
* **Lookback Grid:** $k \in \{0, 1, 7\}$. Note that lag 0 is the contemporaneous value on the close of origin date $t$, fully known before making the $t+h$ forecast.
* **Features (example for BPI):**
  * Capesize: `cross_BCI_lag_0`, `cross_BCI_lag_1`, `cross_BCI_lag_7`
  * Supramax: `cross_BSI_lag_0`, `cross_BSI_lag_1`, `cross_BSI_lag_7`
  * Handysize: `cross_BHSI_lag_0`, `cross_BHSI_lag_1`, `cross_BHSI_lag_7`
* **Purpose:** Captures vessel substitution dynamics and market spillover effects (e.g. Capesize cargo splitting onto multiple Panamax vessels or Supramax fleet tightness).

### E. Deterministic Annual Seasonality / Fourier Harmonics (4 Features)
* **Harmonics:** $K = 2$ annual harmonic pairs (period $P = 365.25$ calendar days).
* **Features:** `fourier_sin_1`, `fourier_cos_1`, `fourier_sin_2`, `fourier_cos_2`.
  $$\text{fourier\_sin\_k}(t) = \sin\left(\frac{2\pi k \cdot \text{day\_of\_year}(t)}{365.25}\right), \quad \text{fourier\_cos\_k}(t) = \cos\left(\frac{2\pi k \cdot \text{day\_of\_year}(t)}{365.25}\right)$$
* **Justification:** Captures well-documented dry-bulk calendar regularities (e.g. South American grain export peaks in Q2, Australian iron ore lulls during Chinese Lunar New Year in Q1) using strictly calendar-derived math that does not leak future values.

### F. Calendar Day of Week (2 Features)
* `day_of_week_sin`, `day_of_week_cos` encoding trading day cyclicality.

**Total Feature Dimension:** 39 numeric columns per forecasting record.

---

## 4. Target Generation & Truncation

* For target index $Y$ and horizon $h$:
  $$\text{target}(t, h) = Y(t + h)$$
* **Warmup Lookback:** 90 trading sessions (the maximum rolling window size). The first 90 rows (`2012-08-01` to `2012-12-10`) provide historical history so all rows starting from `2012-12-11` have 100% complete features without synthetic imputation or NaNs.
* **Unobserved Future Truncation:** For horizon $h$, the final $h$ trading sessions of the dataset have not yet lived long enough to experience a realized $t+h$ outcome. These rows are strictly excluded.
* **No Backfilling:** Missing future targets are dropped; under no circumstance are targets interpolated or backfilled.

---

## 5. Dataset Inventory & Sample Sizes

| Target Index | Horizon ($h$) | Usable Supervised Rows | Train ($n$) | Validation ($n$) | Test ($n$) | Total Dropped (Warmup + Horizon) |
|:-------------|:--------------|:-----------------------|:------------|:-----------------|:-----------|:---------------------------------|
| **BPI** | 7d | 1,652 | 1,159 | 250 | 243 | 97 rows (90 warmup + 7 horizon) |
| **BPI** | 14d | 1,645 | 1,159 | 250 | 236 | 104 rows (90 warmup + 14 horizon) |
| **BPI** | 28d | 1,631 | 1,159 | 250 | 222 | 118 rows (90 warmup + 28 horizon) |
| **BPI** | 60d | 1,599 | 1,159 | 250 | 190 | 150 rows (90 warmup + 60 horizon) |
| **BPI** | 90d | 1,569 | 1,159 | 250 | 160 | 180 rows (90 warmup + 90 horizon) |
| **BPI** | 180d | 1,479 | 1,159 | 250 | 70 | 270 rows (90 warmup + 180 horizon) |
| **BCI** | 7d | 1,652 | 1,159 | 250 | 243 | 97 rows |
| **BCI** | 14d | 1,645 | 1,159 | 250 | 236 | 104 rows |
| **BCI** | 28d | 1,631 | 1,159 | 250 | 222 | 118 rows |
| **BCI** | 60d | 1,599 | 1,159 | 250 | 190 | 150 rows |
| **BCI** | 90d | 1,569 | 1,159 | 250 | 160 | 180 rows |
| **BCI** | 180d | 1,479 | 1,159 | 250 | 70 | 270 rows |
| **BSI** | 7d | 1,652 | 1,159 | 250 | 243 | 97 rows |
| **BSI** | 14d | 1,645 | 1,159 | 250 | 236 | 104 rows |
| **BSI** | 28d | 1,631 | 1,159 | 250 | 222 | 118 rows |
| **BSI** | 60d | 1,599 | 1,159 | 250 | 190 | 150 rows |
| **BSI** | 90d | 1,569 | 1,159 | 250 | 160 | 180 rows |
| **BSI** | 180d | 1,479 | 1,159 | 250 | 70 | 270 rows |
| **BHSI** | 7d | 1,652 | 1,159 | 250 | 243 | 97 rows |
| **BHSI** | 14d | 1,645 | 1,159 | 250 | 236 | 104 rows |
| **BHSI** | 28d | 1,631 | 1,159 | 250 | 222 | 118 rows |
| **BHSI** | 60d | 1,599 | 1,159 | 250 | 190 | 150 rows |
| **BHSI** | 90d | 1,569 | 1,159 | 250 | 160 | 180 rows |
| **BHSI** | 180d | 1,479 | 1,159 | 250 | 70 | 270 rows |

*Note: All 24 files are saved in CSV format at `ml-work/data/features/dataset_{target}_h{horizon}.csv`.*

---

## 6. Time-Aware Benchmark Split

Random shuffling was strictly prohibited. The temporal integrity is preserved using chronologically partitioned splits:

```
[--- 90-day Warmup ---][-------------- TRAIN --------------][---- VALIDATION ----][------- TEST -------]
2012-08-01   2012-12-10 2012-12-11               2017-07-31 2017-08-01  2018-07-31 2018-08-01    2019-07-31
(Lookback only)        (1,159 origins)                      (250 origins)          (70 to 243 origins)
```

1. **Train Set:** Origins from `2012-12-11` to `2017-07-31` (1,159 origins, ~4.6 years).
2. **Validation Set:** Origins from `2017-08-01` to `2018-07-31` (250 origins, exactly 1 calendar year).
3. **Test Set:** Origins from `2018-08-01` to the cutoff (up to 243 origins depending on horizon $h$, exactly 1 calendar year).

### Walk-Forward Cross-Validation Engine
In [`ml-work/features/validation.py`](file:///c:/Users/win11/Downloads/sih/ml-work/features/validation.py), the `walk_forward_folds()` generator supports expanding-window evaluation:
* Fold $k$ trains on $[t_0, t_k]$ and validates on $[t_k + 1, t_k + \text{val\_size}]$.
* Window expands chronologically with zero backward contamination.

---

## 7. Anti-Leakage Verification Results

A suite of automated anti-leakage tests was executed:

| Test Property | Verification Mechanism | Result |
|:--------------|:-----------------------|:-------|
| **Past-Only Isolation ($t \le \tau$)** | Reconstructed feature matrix using isolated slice $\text{data}[\le t]$. Evaluated feature identity against full-series calculations. | **PASSED (Bit-for-bit identical)** |
| **Future Perturbation Invariance** | Artificially shocked observations occurring after $t$ ($t+1 \dots T$) by $+999,999.0$. Recomputed feature matrix at date $t$. | **PASSED (Absolute difference = 0.0)** |
| **Target Exclusion from Features** | Audited all 39 feature names and values against future target values. | **PASSED (Target not in features)** |
| **Strict Forward Ordering** | Checked that $\text{target\_date} > \text{origin\_date}$ for all rows across all 24 datasets. | **PASSED (100% verified)** |
| **End-of-Series Dropping** | Checked that rows lacking $t+h$ targets are excluded and not backfilled. | **PASSED (No NaNs in targets)** |

---

## 8. Limitations & Scope Boundaries

1. **Historical Period:** Real dataset covers 2012 to 2019. While it enables rigorous historical benchmarking, it does not yet extend to 2023–2025.
2. **Exogenous Factors:** Brent, bunker fuels, and macro indicators are intentionally omitted until Phase 5 to establish a pure freight benchmark first.
3. **No Model Training in Phase 3:** Feature engineering and supervised dataset generation are complete; model fitting is reserved for Phase 4.
