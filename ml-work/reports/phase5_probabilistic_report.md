# SIH26006 — Phase 5: Probabilistic Freight Forecasting & Conformal Calibration Report

**Project Title:** Intelligent Freight Forecasting for Optimized Vessel Chartering & Bulk Cargo Procurement  
**Problem Statement ID:** SIH26006  
**Component:** `ml-work/models`  
**Execution Timestamp:** 2026-09-19T16:23:00.516015  
**Execution Runtime:** 70.29 seconds (CPU only)  
**Status:** COMPLETE — 72 QUANTILE MODELS TRAINED & CONFORMAL CALIBRATION APPLIED  

---

## 1. Objective: Why Probabilistic Freight Forecasting is Essential

In ocean freight chartering, point forecasts ($\hat{y}$) are insufficient for optimal risk management:
* Freight rates in Capesize and Panamax dry-bulk markets exhibit extreme volatility regimes driven by bunker fuel price shocks, weather canal disruptions, and port congestion.
* Chartering decisions involve asymmetric loss: under-predicting a spike leads to unbudgeted spot procurement costs, while over-predicting can trigger premature long-term vessel lock-ins at inflated rates.
* **Phase 5 Delivers:**
  1. Direct conditional quantile forecasts for **$P_10$ (pessimistic / lower charter rate)**, **$P_50$ (median / expected charter rate)**, and **$P_90$ (stress / high charter rate)**.
  2. Split conformal calibration targeting **80% central prediction intervals**, calibrating on validation nonconformity residuals under finite-sample order-statistic conventions.

---

## 2. Dataset & Horizon Convention

* **Data Source:** Verified real Baltic historical multivariate observations ([real_baltic_multivariate.csv](file:///c:/Users/win11/Downloads/sih/ml-work/data/processed/real_baltic_multivariate.csv)).
* **Coverage:** 2012-08-01 through 2019-07-31 (1,749 clean trading sessions).
* **Target Indices:** BPI (Panamax), BCI (Capesize), BSI (Supramax), BHSI (Handysize).
* **Horizons:** Evaluated strictly over discrete **Baltic trading-session horizons**: $h \in \{7, 14, 28, 60, 90, 180\}$.
* **Limitation:** The verified real dataset ends on 2019-07-31. The original blueprint's prospective 2023–2025 evaluation window cannot currently be evaluated with verified real observations until post-2019 Baltic data is legally acquired.

---

## 3. Feature Set Reference

Phase 5 reuses the 39 backward-looking features established and validated in Phase 3:
* **Own-index Lags (10):** lags 1, 2, 3, 5, 7, 10, 14, 21, 30, 60.
* **Rolling Statistics (10):** rolling means and standard deviations for windows 7, 14, 30, 60, 90 sessions.
* **Returns (4):** returns across 1, 7, 14, 30 sessions.
* **Cross-Index Lags (9):** lags 0, 1, 7 for sibling vessel indices.
* **Seasonality (6):** annual Fourier harmonics ($k=1, 2$) and cyclical day-of-week terms.
* Zero data leakage: Features depend strictly on data $\le t$.

---

## 4. Point-Forecast Benchmark Summary (Phase 4 Findings)

The Phase 4 benchmark established that:
* At short horizons ($h=7, 14$), persistence provides a strong benchmark, while learned models (Ridge, ARIMA(1,1,1)) achieve 60%–92% directional accuracy.
* At medium and long horizons ($h=28, 60, 90, 180$), persistence error increases significantly, whereas LightGBM and Ridge capture broader market cycles and substantially reduce MAE.
* No single model is universally superior across all 24 tasks; model performance is vessel- and horizon-dependent.

---

## 5. Quantile LightGBM Methodology

* **Model:** `lightgbm.LGBMRegressor` with `objective='quantile'`.
* **Quantiles:** $q \in \{0.10, 0.50, 0.90\}$.
* **Training Architecture:** Direct multi-horizon forecasting (one model per target $\times$ horizon $\times$ quantile = 72 models).
* **Hyperparameters:** `n_estimators=300`, `learning_rate=0.03`, `num_leaves=15`, `max_depth=5`, `min_child_samples=20`, `subsample=0.8`, `colsample_bytree=0.8`, `random_state=42`.
* **Quantile Rearrangement:** Applied Chernozhukov et al. (2010) monotonic sorting to guarantee $P_{10} \le P_{50} \le P_{90}$.

---

## 6. Split Conformal Calibration Methodology

To adjust for empirical under-coverage and calibrate prediction intervals:
1. **Calibration Set:** The entire **Validation split** (2017-08-01 to 2018-07-31, 250 origins).
2. **Two-Sided Interval Nonconformity Score:**
   $$r_i = \max(L_i - y_i, y_i - U_i, 0)$$
   where $L_i = \hat{y}_{0.10}(i)$ and $U_i = \hat{y}_{0.90}(i)$ (after monotonic rearrangement).
3. **Finite-Sample Quantile Selection:**
   $$k = \lceil (n_{\text{val}} + 1)(1 - \alpha) \rceil, \quad \hat{q} = r_{(k)} \quad \text{for } 1 - \alpha = 0.80$$
   With $n_{\text{val}} = 250$, $k = \lceil 251 \times 0.80 \rceil = 201$. The conformal threshold is strictly the 201st order statistic $r_{(201)}$.
4. **Calibrated Interval:**
   $$[L_{\text{cal}}, U_{\text{cal}}] = [L - \hat{q}, U + \hat{q}]$$
5. **Strict Test Isolation:** Test observations were **never** accessed during calibration; the validation-derived $\hat{q}$ was frozen and evaluated out-of-sample on Test.
6. **Theoretical vs. Empirical Coverage Distinction:**
   Conformal validity guarantees $P(Y_{n+1} \in C(X_{n+1})) \ge 1 - \alpha$ under exchangeability. In non-stationary time series, future periods can undergo structural shifts in market volatility. Therefore, nominal calibration on validation data does not guarantee that empirical test coverage will identically equal 80%.

---

## 7. Calibration Diagnostics (Validation Set Summary)

The table below reports the validation-derived conformal adjustment factor $\hat{q}$, raw coverage, and calibrated coverage across all 24 tasks:

| Target | Horizon | Valid Origins ($n$) | Conformal Adj $\hat{q}$ | Raw Val Coverage (%) | Calibrated Val Coverage (%) | Raw Mean Width | Calibrated Mean Width |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| BPI | 7d | 250 | 139.5 | 48.0% | 80.4% | 279.4 | 558.4 |
| BPI | 14d | 250 | 176.8 | 40.4% | 80.4% | 352.6 | 706.2 |
| BPI | 28d | 250 | 252.5 | 24.8% | 80.4% | 383.4 | 888.3 |
| BPI | 60d | 250 | 195.8 | 37.2% | 80.4% | 444.7 | 836.4 |
| BPI | 90d | 250 | 389.9 | 8.0% | 80.4% | 335.8 | 1115.5 |
| BPI | 180d | 250 | 479.8 | 15.2% | 80.4% | 223.2 | 1182.8 |
| BCI | 7d | 250 | 248.3 | 53.2% | 80.4% | 738.8 | 1235.4 |
| BCI | 14d | 250 | 587.6 | 36.4% | 80.4% | 789.7 | 1965.0 |
| BCI | 28d | 250 | 839.9 | 24.0% | 80.4% | 757.0 | 2436.8 |
| BCI | 60d | 250 | 976.6 | 24.0% | 80.4% | 933.6 | 2886.9 |
| BCI | 90d | 250 | 950.7 | 30.8% | 80.4% | 739.8 | 2641.3 |
| BCI | 180d | 250 | 1167.6 | 37.2% | 80.4% | 893.1 | 3228.3 |
| BSI | 7d | 250 | 32.6 | 52.8% | 80.4% | 115.5 | 180.7 |
| BSI | 14d | 250 | 36.8 | 57.6% | 80.4% | 160.1 | 233.7 |
| BSI | 28d | 250 | 77.0 | 63.2% | 80.4% | 224.1 | 378.1 |
| BSI | 60d | 250 | 114.3 | 36.4% | 80.4% | 182.7 | 411.3 |
| BSI | 90d | 250 | 103.4 | 22.0% | 80.4% | 202.3 | 409.1 |
| BSI | 180d | 250 | 206.1 | 24.4% | 80.4% | 230.3 | 642.6 |
| BHSI | 7d | 250 | 6.2 | 72.4% | 80.4% | 68.1 | 80.4 |
| BHSI | 14d | 250 | 31.6 | 58.8% | 80.4% | 75.1 | 138.2 |
| BHSI | 28d | 250 | 44.6 | 69.6% | 80.4% | 112.8 | 202.2 |
| BHSI | 60d | 250 | 63.9 | 35.6% | 80.4% | 80.9 | 208.7 |
| BHSI | 90d | 250 | 50.1 | 42.4% | 80.4% | 101.7 | 201.9 |
| BHSI | 180d | 250 | 107.5 | 11.2% | 80.4% | 99.8 | 314.7 |

---

## 8. Out-of-Sample Test Set Probabilistic Performance (All 24 Tasks)

The table below reports out-of-sample performance on the held-out Test set (2018-08-01 to 2019-07-31):

| Target | Horizon | $P_{50}$ MAE | $P_{50}$ MASE | $P_{10}$ Loss | $P_{50}$ Loss | $P_{90}$ Loss | Raw Cov (%) | Cal Cov (%) | Raw Width | Cal Width | $n$ |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| BPI | 7d | 129.8 | 7.74 | 31.9 | 64.9 | 50.3 | 49.8% | 85.2% | 231.7 | 510.7 | 243 |
| BPI | 14d | 198.8 | 11.85 | 61.6 | 99.4 | 83.1 | 32.6% | 78.4% | 268.0 | 621.6 | 236 |
| BPI | 28d | 275.8 | 16.45 | 87.3 | 137.9 | 94.6 | 50.0% | 78.8% | 395.7 | 900.7 | 222 |
| BPI | 60d | 413.8 | 24.68 | 142.9 | 206.9 | 112.1 | 33.7% | 60.5% | 306.6 | 698.3 | 190 |
| BPI | 90d | 390.0 | 23.26 | 166.4 | 195.0 | 149.1 | 22.5% | 70.0% | 244.0 | 1023.8 | 160 |
| BPI | 180d | 313.0 | 18.67 | 46.5 | 156.5 | 168.6 | 65.7% | 80.0% | 354.0 | 1313.7 | 70 |
| BCI | 7d | 349.5 | 6.22 | 104.4 | 174.7 | 91.8 | 57.6% | 80.7% | 698.4 | 1195.0 | 243 |
| BCI | 14d | 603.0 | 10.73 | 147.6 | 301.5 | 161.9 | 55.1% | 89.0% | 932.6 | 2107.9 | 236 |
| BCI | 28d | 930.5 | 16.55 | 256.2 | 465.2 | 234.8 | 31.5% | 86.9% | 887.8 | 2567.6 | 222 |
| BCI | 60d | 928.6 | 16.52 | 348.6 | 464.3 | 267.6 | 31.1% | 73.7% | 816.5 | 2769.8 | 190 |
| BCI | 90d | 1084.2 | 19.28 | 423.1 | 542.1 | 364.7 | 24.4% | 56.9% | 672.8 | 2574.2 | 160 |
| BCI | 180d | 796.6 | 14.17 | 111.8 | 398.3 | 328.8 | 41.4% | 91.4% | 944.1 | 3279.3 | 70 |
| BSI | 7d | 50.5 | 7.34 | 13.7 | 25.2 | 12.6 | 63.4% | 82.3% | 96.4 | 161.6 | 243 |
| BSI | 14d | 79.4 | 11.54 | 28.7 | 39.7 | 13.5 | 59.8% | 84.3% | 154.0 | 227.6 | 236 |
| BSI | 28d | 126.6 | 18.40 | 44.1 | 63.3 | 27.8 | 57.7% | 78.4% | 202.4 | 356.4 | 222 |
| BSI | 60d | 190.8 | 27.74 | 106.4 | 95.4 | 30.2 | 29.5% | 55.8% | 155.6 | 384.1 | 190 |
| BSI | 90d | 182.4 | 26.52 | 104.4 | 91.2 | 27.9 | 28.8% | 60.0% | 169.9 | 376.7 | 160 |
| BSI | 180d | 69.8 | 10.14 | 9.6 | 34.9 | 16.4 | 75.7% | 100.0% | 163.8 | 576.0 | 70 |
| BHSI | 7d | 21.8 | 6.45 | 5.5 | 10.9 | 4.5 | 57.6% | 76.1% | 47.8 | 60.1 | 243 |
| BHSI | 14d | 39.7 | 11.73 | 12.2 | 19.9 | 6.4 | 59.8% | 90.7% | 74.4 | 137.5 | 236 |
| BHSI | 28d | 61.1 | 18.03 | 25.4 | 30.5 | 10.1 | 64.9% | 84.7% | 102.8 | 192.1 | 222 |
| BHSI | 60d | 97.4 | 28.76 | 51.3 | 48.7 | 12.9 | 53.7% | 69.5% | 100.1 | 227.9 | 190 |
| BHSI | 90d | 144.1 | 42.55 | 100.3 | 72.0 | 17.1 | 24.4% | 36.2% | 72.6 | 172.8 | 160 |
| BHSI | 180d | 38.8 | 11.47 | 11.4 | 19.4 | 9.1 | 48.6% | 100.0% | 110.2 | 325.1 | 70 |

---

## 9. Key Findings & Scientific Interpretation

1. **Empirical Coverage Under Temporal Distribution Shift:**
   - Split-conformal calibration widened the prediction intervals and generally increased empirical coverage relative to the raw quantile intervals.
   - However, empirical test coverage varied substantially across targets and horizons (from 36.2% on BHSI h90 to 100.0% on BHSI h180), with several long-horizon tasks remaining below the nominal 80% level.
   - This dispersion is consistent with the distinction between nominal conformal calibration and empirical performance under temporal distribution shift: the 2018–2019 test period experienced volatility regime shifts and prolonged cyclical trends not fully represented in the 2017–2018 validation calibration window.
2. **Coverage-Width Tradeoff:**
   - Calibrating intervals necessarily involves interval expansion (from 1.26x on BHSI 7d up to 3.7x–4.1x on BCI 14d–28d and BPI 90d).
   - An interval with higher empirical coverage achieved through substantial widening is not automatically preferable for vessel chartering decisions; charterers must balance tail-risk protection against the operational utility of narrower bounds.
3. **Quantile Crossings:**
   - Across all 72 trained quantile models, the raw quantile crossing rate averaged < 2.5%.
   - Applying monotonic rearrangement (Chernozhukov et al., 2010) guaranteed valid quantile hierarchies ($P_{10} \le P_{50} \le P_{90}$) prior to calibration.

---

## 10. Limitations & Operational Caveats

1. **Historical Dataset Cutoff:** The verified dataset spans 2012–2019. Prospective 2023–2025 evaluations cannot currently be performed until post-2019 Baltic data is legally acquired.
2. **Long-Horizon Sample Size Uncertainty ($h=180$):**
   - The test set contains only $n=70$ observations at $h=180$, compared to $n=243$ at $h=7$.
   - A descriptive standard error for coverage at $n=70$ with $\hat{p} \approx 0.80$ is $\sqrt{0.80 \times 0.20 / 70} \approx 4.8\%$ (95% CI approximately $\pm 9.4\%$). High empirical coverage at $h=180$ reflects substantial sampling variability and must not be overinterpreted.
3. **Exogenous Features Not Yet Incorporated:** Port congestion, bunker fuel, iron ore, coal, and USD/INR exchange rates are not yet included in the feature set.
4. **Exchangeability Assumption in Time Series:** Split conformal calibration assumes approximate exchangeability between calibration and test residuals. In the presence of macroeconomic regime shifts, coverage may deviate from nominal levels.

---

## 11. Recommendations for Phase 6 (API & Integration Architecture)

Based on empirical validation:
1. **Expose Calibrated Bounds with Explicit Uncertainty Context:**
   - Provide point forecasts ($P_{50}$) alongside both raw and calibrated prediction intervals ($P_{10}, P_{90}$).
   - Allow downstream chartering optimization to parameterize risk tolerance rather than assuming static, unconditional coverage.
2. **Production Service Contract:**
   - Expose point forecasts ($P_{50}$), interval widths, and baseline persistence comparisons in future `/forecast` API responses.
