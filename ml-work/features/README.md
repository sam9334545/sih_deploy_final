# Feature Engineering & Supervised Forecasting Guide (SIH26006)

Welcome! This guide explains the core concepts of time-series machine learning and feature engineering used in **SIH26006**, written in clear, beginner-friendly language.

---

## 1. What is a "Forecast Origin" ($t$)?

In time-series forecasting, we pretend we are standing at a specific point in history—say, **Tuesday, 14 January 2014**.
* This point in time is called the **Forecast Origin** ($t$).
* **Golden Rule:** When standing at date $t$, you only know what happened **on or before** that day. You do not know what the freight rate will be tomorrow, next week, or next month.
* Everything we use to make a prediction must be known at date $t$.

---

## 2. What is a "Feature"?

A **feature** (often called an input variable or predictor, denoted as $X$) is an informative clue given to the machine learning model to help it predict the future.
* For example:
  * *"What was the freight rate yesterday?"*
  * *"Has the freight rate been rising or falling over the past 30 days?"*
  * *"Is it currently winter or summer?"*

In our pipeline, every feature row represents the exact state of the market on a specific forecast origin date $t$.

---

## 3. What is a "Target"?

The **target** (often called the label or output variable, denoted as $y$) is the exact future value we want the model to learn to predict.
* If today is trading session $t$, our target is the freight index value at future session $t + h$.
* For example: If today is 14 January and our horizon is 7 trading sessions, the target is the real observed rate on 23 January.

---

## 4. What is a "Lag"?

A **lag** means looking backwards in time by a fixed number of trading sessions.
* **Lag 1 (`lag_1`):** The freight index value 1 trading session ago (yesterday's close).
* **Lag 2 (`lag_2`):** The freight index value 2 trading sessions ago.
* **Lag 7 (`lag_7`):** The freight index value 7 trading sessions ago (~1.4 calendar weeks ago).
* **Lag 30 (`lag_30`):** The freight index value 30 trading sessions ago (~6 calendar weeks ago).

Lags allow models to capture short-term memory and autoregressive trends.

---

## 5. What is a "Rolling Mean" & "Rolling Volatility"?

* **Rolling Mean (`rolling_mean_30`):** The average freight rate over the last 30 trading sessions ending today. It smooths out day-to-day market noise to show the medium-term price trend.
* **Rolling Standard Deviation (`rolling_std_30`):** Measures how violently freight prices bounced around during the last 30 sessions. High rolling standard deviation indicates volatile market regimes (e.g. canal disruptions or sudden grain export rushes).

---

## 6. What is a "Forecast Horizon" ($h$)?

The **forecast horizon** is how far into the future we want to look.
* In our pipeline, horizons are defined in **trading sessions**:
  * **$h = 7$:** 7 trading sessions ahead (~1.4 calendar weeks)
  * **$h = 14$:** 14 trading sessions ahead (~2.8 calendar weeks)
  * **$h = 28$:** 28 trading sessions ahead (~5.6 calendar weeks / ~1.3 months)
  * **$h = 60$:** 60 trading sessions ahead (~12 calendar weeks / ~2.8 months)
  * **$h = 90$:** 90 trading sessions ahead (~18 calendar weeks / ~4.2 months)
  * **$h = 180$:** 180 trading sessions ahead (~36 calendar weeks / ~8.4 months)

We build a dedicated supervised dataset for each horizon so the model learns the exact patterns relevant to that forecasting distance.

---

## 7. What is "Data Leakage" and Why is it Catastrophic?

**Data leakage** occurs when information from the future accidentally contaminates the training features.
* *Example of Leakage:* If you calculate a 30-day centered moving average that includes 15 days in the future, your model will look like a "genius" during training because it is effectively "cheating" by peeking at tomorrow's test answers. But in production, tomorrow hasn't happened yet, so the model will fail completely.
* **Our Protection:** Our pipeline enforces strict **one-directional causality**:
  * `rolling_mean_30` uses strictly sessions $t-29$ through $t$.
  * We run automated **perturbation tests**: if we corrupt future data after date $t$ with random numbers, the features generated at date $t$ remain 100% identical.

---

## 8. How the Train / Validation / Test Split Works

We never randomly shuffle time series data! If you randomly shuffle, you end up training on Wednesday, testing on Tuesday, and training on Thursday.

Instead, we slice time chronologically into three non-overlapping historical blocks:

```text
[================ TRAIN ================] [==== VALIDATION ====] [====== TEST ======]
2012-08-01                  2017-07-31  2017-08-01       2018-07-31  2018-08-01   2019-07-31
(5.0 Years: 1,159 sessions)             (1.0 Year: 250 sessions)   (1.0 Year: 70-243 sessions)
```

1. **Training Set (2012–2017):** The model learns historical market cycles and relationships.
2. **Validation Set (2017–2018):** Used to tune model hyperparameters without overfitting.
3. **Test Set (2018–2019):** Held-out completely until the very end to measure true out-of-sample performance.

---

## 9. Key Conventions & Practical Rules

### A. Forecast-Origin Market Close Convention
Forecasts are assumed to be generated **after the published Baltic market observation for trading session $t$**. 
* Because session $t$'s assessment is fully known and settled before creating the forward forecast, contemporaneous lag-0 observations for other indices (`cross_BCI_lag_0`, `cross_BSI_lag_0`, `cross_BHSI_lag_0`) are valid and available information at forecast origin $t$.
* Under no circumstances is the future target value $y(t+h)$ or any post-$t$ observation ever used.

### B. Horizon Terminology: Trading-Session Horizons
In this pipeline, every horizon refers explicitly to **trading-session horizons**, not calendar days:
* Baltic panel assessments are published only on active business days.
* $h=7$ means 7 active Baltic trading sessions into the future.
* Each record explicitly documents both `origin_date` and `target_date`, alongside `calendar_days_elapsed` for full operational clarity.

### C. Historical Benchmark Limitation
The verified real Baltic sub-index dataset currently covers **2012-08-01 through 2019-07-31**.
* Consequently, the train/validation/test split evaluates historical out-of-sample generalization up to July 2019.
* The original SIH blueprint's prospective 2023–2025 evaluation window cannot currently be evaluated with verified real observations until post-2019 Baltic data is legally acquired.

