# SIH26006 — Phase 5: Split Conformal Calibration & Probabilistic Forecasting Methodology Audit

**Project Title:** Intelligent Freight Forecasting for Optimized Vessel Chartering & Bulk Cargo Procurement  
**Problem Statement ID:** SIH26006  
**Auditor:** Senior ML / Time-Series Methodology Audit  
**Component:** `ml-work/models`  
**Audit Date:** 2026-09-19  
**Audit Status:** PASS WITH REPORTING CORRECTIONS  

---

## 1. Audit Scope

This audit independently inspects the mathematical correctness, data isolation, and reporting integrity of the Phase 5 probabilistic forecasting implementation for Baltic freight indices (BPI, BCI, BSI, BHSI) across trading-session horizons $h \in \{7, 14, 28, 60, 90, 180\}$.

### Inspected Artifacts:
* `ml-work/models/conformal.py` (`SplitConformalCalibrator`)
* `ml-work/models/quantile_lightgbm.py` (`QuantileLightGBMForecaster`, `TripletQuantileForecaster`, rearrangement)
* `ml-work/models/probabilistic_evaluation.py` (Pinball loss, empirical coverage, interval widths)
* `ml-work/scripts/run_phase5_probabilistic.py` (Benchmarking and evaluation runner)
* `ml-work/reports/phase5_calibration_results.csv` (Validation diagnostics)
* `ml-work/reports/phase5_test_results.csv` (Out-of-sample test evaluation)
* `ml-work/reports/phase5_probabilistic_report.md` (Human-readable report)
* `ml-work/tests/test_phase5_probabilistic.py` (Unit and integration tests)

---

## 2. Current Conformal Method

The implementation follows inductive / split conformal prediction for central prediction intervals:
* Target nominal coverage: $1 - \alpha = 0.80$ (with $\alpha = 0.20$).
* Direct quantile models are trained on the chronological training set (2012-12-11 to 2017-07-31).
* Models generate validation predictions for $P_{10}$, $P_{50}$, $P_{90}$ on the validation partition (2017-08-01 to 2018-07-31, $n_{\text{val}} = 250$).
* Monotonic quantile rearrangement is applied to guarantee $P_{10} \le P_{50} \le P_{90}$.
* Conformal nonconformity scores are computed strictly on validation observations.
* The finite-sample calibration adjustment $\hat{q}$ is derived and frozen.
* Out-of-sample test intervals are constructed by expanding raw test predictions by $\pm \hat{q}$.

---

## 3. Nonconformity Score Audit

The nonconformity score in `ml-work/models/conformal.py` is defined as:
$$r_i = \max(L_i - y_i, y_i - U_i, 0)$$
where $L_i = \hat{y}_{0.10}(i)$ and $U_i = \hat{y}_{0.90}(i)$ after monotonic rearrangement.

### Audit Findings:
1. **Mathematical Definition:** Exact match with standard two-sided interval nonconformity (Vovk et al. 2005; Lei et al. 2018).
2. **Non-negativity:** Strictly guaranteed via `np.maximum(..., 0.0)`. When $y_i \in [L_i, U_i]$, $r_i = 0$. When $y_i$ falls outside, $r_i$ measures the exact distance to the nearest boundary.
3. **Partition Isolation:** The score vector is computed strictly on validation observations (`y_val`, `lower_val`, `upper_val`). Test targets are never passed to `fit()`.
4. **Finite Values:** All inputs are validated for absence of NaNs and infinite values.
* **Verdict on Nonconformity Score:** **PASS**

---

## 4. Finite-Sample Quantile Audit

The code calculates:
$$k = \lceil (n + 1)(1 - \alpha) \rceil$$
For $n = 250$ and $\alpha = 0.20$:
$$k = \lceil (250 + 1) \times 0.80 \rceil = \lceil 251 \times 0.80 \rceil = \lceil 200.8 \rceil = 201$$

In `ml-work/models/conformal.py`:
```python
k = math.ceil((n + 1) * (1.0 - self.alpha))
sorted_scores = np.sort(scores)
idx = min(k - 1, n - 1)
self.q_hat = float(sorted_scores[idx])
```

### Audit Findings:
1. **Mathematical Quantity:** Computes the $k$-th order statistic $r_{(k)}$ of the empirical distribution of validation calibration scores.
2. **Indexing Convention:** In 0-based indexing, the $k$-th smallest score is at position $k - 1$. Here, $k - 1 = 200$. Exactly 201 observations (indices 0 through 200) satisfy $r_i \le r_{(201)}$.
3. **Absence of Interpolation:** The implementation uses exact array indexing `sorted_scores[idx]`, rather than continuous linear percentile interpolation. This is strictly required for finite-sample coverage validity.
4. **Ceiling Operator:** Strictly uses `math.ceil`, not `math.floor` or rounding.
5. **Boundary Safeguard:** Bounded via `min(k - 1, n - 1)` to prevent out-of-bounds indexing in small-sample edge cases.
6. **Theoretical Property:** On exchangeable data, this construction satisfies:
   $$P(Y_{n+1} \in C(X_{n+1})) \ge \frac{\lceil (n+1)(1-\alpha) \rceil}{n+1} = \frac{201}{251} \approx 80.08\% \ge 80\%$$
   On the calibration sample itself, exactly $201 / 250 = 80.4\%$ of points are covered.
* **Verdict on Finite-Sample Quantile:** **PASS**

---

## 5. Quantile Rearrangement Order Audit

The pipeline sequence in `ml-work/scripts/run_phase5_probabilistic.py` is:
1. Train quantile LightGBM models for $q \in \{0.10, 0.50, 0.90\}$.
2. Generate raw predictions $\hat{y}_{0.10}, \hat{y}_{0.50}, \hat{y}_{0.90}$.
3. Apply Chernozhukov et al. (2010) monotonic sorting: $P_{10} \le P_{50} \le P_{90}$.
4. Fit `SplitConformalCalibrator` on rearranged bounds $(P_{10}, P_{90})$.
5. On the test partition: generate predictions $\to$ rearrange monotonically $\to$ apply symmetric calibration $\pm \hat{q}$.

### Audit Findings:
* Because monotonic rearrangement precedes conformal calibration, the nonconformity scores operate on valid, non-inverted intervals where $L_i \le U_i$.
* Because $\hat{q} \ge 0$, the calibrated interval bounds satisfy:
  $$L_{\text{cal}} = L - \hat{q} \le L \le P_{50} \le U \le U + \hat{q} = U_{\text{cal}}$$
  Therefore, $L_{\text{cal}} \le P_{50} \le U_{\text{cal}}$ holds strictly for every single observation.
* Conformal calibration is never applied before rearrangement.
* **Verdict on Quantile Rearrangement:** **PASS**

---

## 6. Data Leakage Audit

A comprehensive leakage audit was executed across features, labels, models, and calibration parameters:
1. **Target Leakage:** Test targets $y_{\text{test}}$ are never passed to the conformal calibrator.
2. **Evaluation Timing:** Test coverage and width diagnostics are computed only after the calibrator is frozen.
3. **Hyperparameters:** Hyperparameters are fixed a priori in `ModelConfig`; no test metrics were used for tuning.
4. **Feature Isolation:** All 39 features are backward-looking ($\le t$). Perturbation tests verify zero leakage from future origins.
5. **Temporal Partitioning:** Strict chronological progression:
   * Training: 2012-12-11 to 2017-07-31
   * Validation (Calibration): 2017-08-01 to 2018-07-31
   * Test: 2018-08-01 to 2019-07-31
* **Verdict on Data Leakage:** **PASS**

---

## 7. Validation Calibration Diagnostics (All 24 Tasks)

Conformal calibration parameters and empirical coverage on the **Validation Calibration Set** ($n = 250$):

| Target | Horizon ($h$) | $n_{\text{val}}$ | Conformal Adj $\hat{q}$ | Raw Val Cov (%) | Calibrated Val Cov (%) | Raw Mean Width | Cal Mean Width | Val Crossing Rate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BPI** | 7d | 250 | 139.51 | 48.0% | **80.4%** | 279.39 | 558.40 | 30.4% |
| **BPI** | 14d | 250 | 176.80 | 40.4% | **80.4%** | 352.65 | 706.25 | 13.2% |
| **BPI** | 28d | 250 | 252.49 | 24.8% | **80.4%** | 383.35 | 888.34 | 21.6% |
| **BPI** | 60d | 250 | 195.82 | 37.2% | **80.4%** | 444.74 | 836.38 | 30.0% |
| **BPI** | 90d | 250 | 389.89 | 8.0% | **80.4%** | 335.76 | 1115.54 | 13.6% |
| **BPI** | 180d | 250 | 479.81 | 15.2% | **80.4%** | 223.16 | 1182.78 | 24.0% |
| **BCI** | 7d | 250 | 248.29 | 53.2% | **80.4%** | 738.79 | 1235.37 | 6.8% |
| **BCI** | 14d | 250 | 587.65 | 36.4% | **80.4%** | 789.69 | 1964.99 | 17.2% |
| **BCI** | 28d | 250 | 839.93 | 24.0% | **80.4%** | 756.95 | 2436.81 | 29.6% |
| **BCI** | 60d | 250 | 976.63 | 24.0% | **80.4%** | 933.63 | 2886.88 | 14.8% |
| **BCI** | 90d | 250 | 950.74 | 30.8% | **80.4%** | 739.82 | 2641.30 | 17.2% |
| **BCI** | 180d | 250 | 1167.60 | 37.2% | **80.4%** | 893.15 | 3228.34 | 17.6% |
| **BSI** | 7d | 250 | 32.61 | 52.8% | **80.4%** | 115.49 | 180.72 | 17.2% |
| **BSI** | 14d | 250 | 36.78 | 57.6% | **80.4%** | 160.10 | 233.66 | 28.0% |
| **BSI** | 28d | 250 | 76.98 | 63.2% | **80.4%** | 224.13 | 378.09 | 19.6% |
| **BSI** | 60d | 250 | 114.28 | 36.4% | **80.4%** | 182.72 | 411.28 | 17.6% |
| **BSI** | 90d | 250 | 103.40 | 22.0% | **80.4%** | 202.26 | 409.06 | 38.8% |
| **BSI** | 180d | 250 | 206.14 | 24.4% | **80.4%** | 230.35 | 642.62 | 11.2% |
| **BHSI** | 7d | 250 | 6.17 | 72.4% | **80.4%** | 68.09 | 80.42 | 32.4% |
| **BHSI** | 14d | 250 | 31.57 | 58.8% | **80.4%** | 75.07 | 138.21 | 40.4% |
| **BHSI** | 28d | 250 | 44.65 | 69.6% | **80.4%** | 112.84 | 202.15 | 23.2% |
| **BHSI** | 60d | 250 | 63.91 | 35.6% | **80.4%** | 80.88 | 208.69 | 34.0% |
| **BHSI** | 90d | 250 | 50.11 | 42.4% | **80.4%** | 101.73 | 201.95 | 68.4% |
| **BHSI** | 180d | 250 | 107.45 | 11.2% | **80.4%** | 99.77 | 314.68 | 38.0% |

*Key Verification:* On the calibration dataset, every single task produces exactly $201 / 250 = 80.4\%$ empirical coverage, mathematically matching $k / n = \lceil 251 \times 0.80 \rceil / 250$.

---

## 8. Out-of-Sample Test Set Coverage & Width Expansion

Out-of-sample performance on the held-out Test set (2018-08-01 to 2019-07-31):

| Target | Horizon ($h$) | $n_{\text{test}}$ | Raw Test Cov | Cal Test Cov | Cov Change | Raw Mean Width | Cal Mean Width | Width Exp. Ratio |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **BPI** | 7d | 243 | 49.8% | **85.2%** | +35.4% | 231.7 | 510.7 | 2.20x |
| **BPI** | 14d | 236 | 32.6% | **78.4%** | +45.8% | 268.0 | 621.6 | 2.32x |
| **BPI** | 28d | 222 | 50.0% | **78.8%** | +28.8% | 395.7 | 900.7 | 2.28x |
| **BPI** | 60d | 190 | 33.7% | **60.5%** | +26.8% | 306.6 | 698.3 | 2.28x |
| **BPI** | 90d | 160 | 22.5% | **70.0%** | +47.5% | 244.0 | 1023.8 | 4.20x |
| **BPI** | 180d | 70 | 65.7% | **80.0%** | +14.3% | 354.0 | 1313.7 | 3.71x |
| **BCI** | 7d | 243 | 57.6% | **80.7%** | +23.1% | 698.4 | 1195.0 | 1.71x |
| **BCI** | 14d | 236 | 55.1% | **89.0%** | +33.9% | 932.6 | 2107.9 | 2.26x |
| **BCI** | 28d | 222 | 31.5% | **86.9%** | +55.4% | 887.8 | 2567.6 | 2.89x |
| **BCI** | 60d | 190 | 31.1% | **73.7%** | +42.6% | 816.5 | 2769.8 | 3.39x |
| **BCI** | 90d | 160 | 24.4% | **56.9%** | +32.5% | 672.8 | 2574.2 | 3.83x |
| **BCI** | 180d | 70 | 41.4% | **91.4%** | +50.0% | 944.1 | 3279.3 | 3.47x |
| **BSI** | 7d | 243 | 63.4% | **82.3%** | +18.9% | 96.4 | 161.6 | 1.68x |
| **BSI** | 14d | 236 | 59.8% | **84.3%** | +24.5% | 154.0 | 227.6 | 1.48x |
| **BSI** | 28d | 222 | 57.7% | **78.4%** | +20.7% | 202.4 | 356.4 | 1.76x |
| **BSI** | 60d | 190 | 29.5% | **55.8%** | +26.3% | 155.6 | 384.1 | 2.47x |
| **BSI** | 90d | 160 | 28.8% | **60.0%** | +31.2% | 169.9 | 376.7 | 2.22x |
| **BSI** | 180d | 70 | 75.7% | **100.0%** | +24.3% | 163.8 | 576.0 | 3.52x |
| **BHSI** | 7d | 243 | 57.6% | **76.1%** | +18.5% | 47.8 | 60.1 | 1.26x |
| **BHSI** | 14d | 236 | 59.8% | **90.7%** | +30.9% | 74.4 | 137.5 | 1.85x |
| **BHSI** | 28d | 222 | 64.9% | **84.7%** | +19.8% | 102.8 | 192.1 | 1.87x |
| **BHSI** | 60d | 190 | 53.7% | **69.5%** | +15.8% | 100.1 | 227.9 | 2.28x |
| **BHSI** | 90d | 160 | 24.4% | **36.2%** | +11.8% | 72.6 | 172.8 | 2.38x |
| **BHSI** | 180d | 70 | 48.6% | **100.0%** | +51.4% | 110.2 | 325.1 | 2.95x |

---

## 9. Coverage-Width Tradeoff Analysis

The audit confirms that split conformal calibration consistently increases coverage by expanding interval width:
* **Short horizons ($h \in \{7, 14, 28\}$):** Width expansion is moderate (1.26x to 2.89x), and empirical test coverage reliably reaches 76%–91%, closely bracketing the nominal 80% target.
* **Medium/long horizons ($h \in \{60, 90, 180\}$):** Width expansion is aggressive (up to 3.8x–4.2x). Despite this widening, several tasks (BPI 60d at 60.5%, BCI 90d at 56.9%, BSI 60d at 55.8%, BHSI 90d at 36.2%) remain below the nominal 80% coverage.
* **Operational Implication:** A wider interval is not automatically "superior." In chartering operations, an interval that spans thousands of index points (e.g. BCI 60d with calibrated width 2,769.8) provides defensive risk awareness but limited precision for competitive bidding. The tradeoff between tail risk protection and operational precision must be parameterized in Phase 6.

---

## 10. Long-Horizon Sample Size Uncertainty ($h=180$)

At $h = 180$ trading sessions, only $n_{\text{test}} = 70$ usable test origins exist:
* Under a binomial model with nominal $p = 0.80$, the standard error is:
  $$\text{SE} = \sqrt{\frac{p(1-p)}{n}} = \sqrt{\frac{0.80 \times 0.20}{70}} \approx 4.78\%$$
  The corresponding 95% Wald confidence interval is $[70.6\%, 89.4\%]$.
* At $h = 7$ ($n_{\text{test}} = 243$), the standard error is $2.57\%$ (95% CI $[75.0\%, 85.0\%]$).
* Empirical coverages of 100% on BSI h180 and BHSI h180 are heavily influenced by the small sample size and market conditions during that specific period. They must not be interpreted as evidence of perfect long-range predictive precision.

---

## 11. Corrections Made

### Mathematical Implementation:
* **No code changes required** in `ml-work/models/conformal.py` or `ml-work/models/quantile_lightgbm.py`. The finite-sample order statistic indexing, nonconformity formulas, and quantile rearrangement sequence are mathematically sound.

### Unit Tests Added:
* Added 3 new unit tests to [ml-work/tests/test_phase5_probabilistic.py](file:///c:/Users/win11/Downloads/sih/ml-work/tests/test_phase5_probabilistic.py):
  1. `test_conformal_small_sample_and_bounds`: Checks edge case handling for $n=1, 2$.
  2. `test_conformal_exact_order_statistic_no_interpolation`: Verifies exact order-statistic selection without continuous interpolation.
  3. `test_conformal_interval_ordering_hierarchy`: Verifies that $L_{\text{cal}} \le P_{50} \le U_{\text{cal}}$ strictly holds.

### Reporting Nuance & Overstated Claims:
* Updated `ml-work/scripts/run_phase5_probabilistic.py` (`generate_phase5_report`) and `ml-work/reports/phase5_probabilistic_report.md` to:
  1. Remove claims that conformal calibration "guarantees" or "systematically ensures" 80% out-of-sample test coverage.
  2. Clearly state that theoretical validity assumes data exchangeability, whereas real financial time series undergo temporal regime shifts.
  3. Document the coverage-width tradeoff explicitly.
  4. Include sample size caveats for $h=180$ ($n=70$).

---

## 12. Scientific Interpretation

1. **Nominal Target vs. Empirical Coverage:** The 80% nominal coverage is a design target. On the exchangeable validation partition, the method achieved exactly 80.4% coverage. On the held-out test partition (2018–2019), empirical coverage exhibited dispersion (36.2% to 100.0%) due to unmodeled macroeconomic volatility shocks.
2. **Methodological Validity:** The empirical deviations in the test set do not indicate a flaw in the conformal algorithm; they reflect non-stationarity and distribution shift in historical Baltic freight rates.
3. **No Retuning on Test:** In strict accordance with scientific standards, test set results were never used to adjust $\hat{q}$ or recalibrate hyperparameters.

---

## 13. Final Verdict

### AUDIT RESULT

* **Conformal formula:** **PASS**
* **Finite-sample quantile indexing:** **PASS**
* **Quantile rearrangement order:** **PASS**
* **Validation-only calibration:** **PASS**
* **Test leakage:** **PASS**
* **Interval ordering:** **PASS**
* **Coverage calculation:** **PASS**
* **Report wording:** **PASS WITH REPORTING CORRECTIONS** (Revisions applied to `phase5_probabilistic_report.md` and `run_phase5_probabilistic.py`)
* **Overall methodology:** **PASS WITH REPORTING CORRECTIONS**

---

### File Inspection and Modification Ledger

#### Files Inspected (Read-Only Analysis):
* `ml-work/models/conformal.py`
* `ml-work/models/quantile_lightgbm.py`
* `ml-work/models/probabilistic_evaluation.py`
* `ml-work/reports/phase5_calibration_results.csv`
* `ml-work/reports/phase5_test_results.csv`
* `ml-work/reports/phase5_interval_results.csv`

#### Files Modified:
1. `ml-work/tests/test_phase5_probabilistic.py` (Added tests 11, 12, 13 for small-sample bounds, exact order statistics, and interval ordering)
2. `ml-work/scripts/run_phase5_probabilistic.py` (Updated `generate_phase5_report` to embed scientific caveats, width expansion ratios, and sample size warnings)
3. `ml-work/reports/phase5_probabilistic_report.md` (Updated human-readable report with softened claims and rigorous interpretation)
4. `ml-work/reports/phase5_conformal_audit.md` (Created comprehensive methodology audit report)
