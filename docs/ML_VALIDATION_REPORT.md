# ML Validation Report — forecast_v2

Generated 2026-09-28 from the trained artifacts in `ml-work/models/saved_models/v2/` and the benchmark CSVs in `ml-work/reports/`. No figure in this document is typed by hand.

## 1. Methodology

**Data.** Verified real Baltic daily indices, 2012-08-01 to 2019-07-31, 1,749 trading sessions (Mendeley DOI `10.17632/t76ckh2ygg.1`, CC-BY-4.0). **Every number below is measured on these rows only.** Post-2019 synthetic rows exist for demonstration and are excluded from training, validation, scoring and calibration.

**Target.** The h-session log return, `log(P[t+h]) - log(P[t])`. Forecasting the return rather than the level makes the persistence forecast exactly zero, so any skill is visible rather than hidden inside a level that yesterday already explains.

**Validation.** Expanding-window rolling origin. The model is refit every 21 sessions on all data available at that point and scored on the next 21 origins, from origin 500 to the end of the record. Chronological order is never broken and no random splitting is used anywhere.

**Metrics.** MASE uses the in-sample mean absolute one-session change as its denominator, so values are comparable across models at a fixed horizon but not across horizons. Skill is the percentage reduction in mean absolute error against persistence on identical origins. Directional accuracy counts only origins where the index actually moved.

**Significance.** Moving-block bootstrap on the paired absolute-error difference, block length equal to the horizon, 2,000 resamples. Blocking is essential: at h=28 neighbouring origins share 27 of 28 days, so a naive t-test would treat ~960 overlapping observations as independent and report significance that is not there.

## 2. Results — all 24 combinations

| Index | Horizon | Selected model | Skill vs persistence | MASE | Directional acc. | p-value | Significant | Origins |
|---|---|---|---|---|---|---|---|---|
| BPI | 7 | ensemble | 13.32% | 5.118 | 66.7% | 0.0000 | yes | 985 |
| BPI | 14 | ensemble | 4.86% | 8.562 | 55.8% | 0.1585 | no | 978 |
| BPI | 28 | ensemble | 7.13% | 11.275 | 51.8% | 0.1060 | no | 964 |
| BPI | 60 | ensemble | 15.84% | 12.710 | 64.6% | 0.0025 | yes | 932 |
| BPI | 90 | ensemble | 17.36% | 13.632 | 62.1% | 0.1450 | no | 902 |
| BPI | 180 | ensemble | 6.52% | 16.884 | 61.0% | 0.3275 | no | 812 |
| BCI | 7 | ensemble | 8.12% | 3.900 | 60.6% | 0.0110 | yes | 985 |
| BCI | 14 | ensemble | 11.76% | 5.928 | 61.0% | 0.0250 | yes | 978 |
| BCI | 28 | ensemble | 19.17% | 7.865 | 69.1% | 0.0050 | yes | 964 |
| BCI | 60 | ensemble | 33.16% | 9.400 | 76.6% | 0.0000 | yes | 932 |
| BCI | 90 | ensemble | 38.38% | 9.034 | 78.8% | 0.0000 | yes | 902 |
| BCI | 180 | ensemble | 25.24% | 9.590 | 70.6% | 0.0250 | yes | 812 |
| BSI | 7 | ensemble | 26.89% | 4.038 | 74.0% | 0.0000 | yes | 985 |
| BSI | 14 | ensemble | 13.85% | 8.011 | 69.5% | 0.0070 | yes | 978 |
| BSI | 28 | ensemble | 18.90% | 11.348 | 71.5% | 0.0035 | yes | 964 |
| BSI | 60 | ensemble | 22.81% | 14.363 | 74.2% | 0.0010 | yes | 932 |
| BSI | 90 | ensemble | 24.84% | 15.827 | 64.9% | 0.0315 | yes | 902 |
| BSI | 180 | ensemble | 22.57% | 20.361 | 60.2% | 0.2240 | no | 812 |
| BHSI | 7 | ensemble | 39.03% | 3.828 | 84.5% | 0.0000 | yes | 985 |
| BHSI | 14 | ensemble | 33.49% | 7.517 | 80.0% | 0.0000 | yes | 978 |
| BHSI | 28 | ensemble | 23.04% | 14.070 | 71.5% | 0.0000 | yes | 964 |
| BHSI | 60 | ensemble | 28.94% | 17.310 | 68.1% | 0.0000 | yes | 932 |
| BHSI | 90 | ensemble | 21.14% | 21.817 | 70.9% | 0.0470 | yes | 902 |
| BHSI | 180 | ensemble | 21.27% | 26.946 | 63.5% | 0.2165 | no | 812 |

**18 of 24** combinations beat persistence at p < 0.05. Median skill 21.2%, range 4.9% to 39.0%.

The weakest combinations are worth naming rather than burying: BPI h=14 (4.86%, p=0.1585); BPI h=180 (6.52%, p=0.3275); BPI h=28 (7.13%, p=0.1060). At long horizons the number of independent target windows is small (roughly seven at h=180), so those rows carry wide uncertainty whatever the point estimate says.

## 3. Model comparison

Selection rule: lowest rolling-origin MASE among models that beat persistence; if none does, persistence itself is selected and served. Significance is recorded but does not gate selection — an insignificant 5% gain is still the better bet, and the p-value travels with the forecast.

| target   |   horizon |   damped_momentum |   drift_mean |   ensemble |   lightgbm |   naive_flat |   ridge |
|:---------|----------:|------------------:|-------------:|-----------:|-----------:|-------------:|--------:|
| BCI      |         7 |             4.246 |        4.243 |      3.9   |      4.307 |        4.245 |   4.319 |
| BCI      |        14 |             6.751 |        6.7   |      5.928 |      6.834 |        6.718 |   6.506 |
| BCI      |        28 |            10.046 |        9.715 |      7.865 |      8.829 |        9.73  |   9.131 |
| BCI      |        60 |            13.954 |       13.996 |      9.4   |     11.239 |       14.064 |   9.936 |
| BCI      |        90 |            13.915 |       14.622 |      9.034 |     11.765 |       14.661 |  10.941 |
| BCI      |       180 |            12.951 |       13.196 |      9.59  |     12.705 |       12.829 |  11.145 |
| BHSI     |         7 |             5.663 |        6.308 |      3.828 |      4.165 |        6.279 |   4.004 |
| BHSI     |        14 |            10.922 |       11.357 |      7.517 |      8.511 |       11.302 |   8.913 |
| BHSI     |        28 |            18.43  |       18.423 |     14.07  |     16.286 |       18.281 |  14.143 |
| BHSI     |        60 |            24.212 |       25.058 |     17.31  |     22.377 |       24.359 |  19.639 |
| BHSI     |        90 |            27.581 |       29.733 |     21.817 |     27.706 |       27.665 |  24.359 |
| BHSI     |       180 |            33.867 |       39.974 |     26.946 |     35.989 |       34.227 |  36.821 |
| BPI      |         7 |             5.89  |        5.906 |      5.118 |      5.166 |        5.905 |   5.381 |
| BPI      |        14 |             9.05  |        8.984 |      8.562 |      8.935 |        8.999 |   8.925 |
| BPI      |        28 |            12.152 |       12.088 |     11.275 |     11.842 |       12.141 |  11.343 |
| BPI      |        60 |            15.044 |       15.497 |     12.71  |     14.652 |       15.103 |  13.838 |
| BPI      |        90 |            16.536 |       17.546 |     13.632 |     16.557 |       16.497 |  16.045 |
| BPI      |       180 |            17.756 |       20.662 |     16.884 |     20.206 |       18.062 |  21.82  |
| BSI      |         7 |             5.346 |        5.533 |      4.038 |      4.319 |        5.523 |   4.5   |
| BSI      |        14 |             9.253 |        9.333 |      8.012 |      8.394 |        9.3   |   8.666 |
| BSI      |        28 |            13.987 |       14.211 |     11.348 |     13.322 |       13.992 |  12.365 |
| BSI      |        60 |            18.567 |       19.308 |     14.363 |     18.868 |       18.607 |  16.746 |
| BSI      |        90 |            21.091 |       22.92  |     15.827 |     21.618 |       21.059 |  19.551 |
| BSI      |       180 |            25.967 |       31.361 |     20.361 |     27.458 |       26.294 |  26.27  |

## 4. Interval calibration

Conformalized quantile regression: LightGBM quantile heads at 0.10/0.50/0.90, rank-sorted per origin to remove crossing, then widened by the (1-alpha) empirical quantile of the conformity score `E = max(q_lo - y, y - q_hi)` measured on a calibration window the model never trained on. Coverage below is **measured**, not assumed.

| Index | Horizon | Nominal | Empirical coverage | Mean width (pts) | Pinball |
|---|---|---|---|---|---|
| BPI | 7 | 80.0% | 77.6% | 323.5 | 0.02953 |
| BPI | 14 | 80.0% | 79.9% | 566.0 | 0.05111 |
| BPI | 28 | 80.0% | 79.2% | 783.6 | 0.07295 |
| BPI | 60 | 80.0% | 75.1% | 840.7 | 0.09932 |
| BPI | 90 | 80.0% | 74.5% | 926.6 | 0.11640 |
| BPI | 180 | 80.0% | 80.7% | 1228.8 | 0.13755 |
| BCI | 7 | 80.0% | 77.2% | 1006.1 | 0.07219 |
| BCI | 14 | 80.0% | 73.3% | 1674.1 | 0.11270 |
| BCI | 28 | 80.0% | 68.9% | 2380.6 | 0.16749 |
| BCI | 60 | 80.0% | 69.0% | 3064.8 | 0.20736 |
| BCI | 90 | 80.0% | 69.7% | 3560.9 | 0.21623 |
| BCI | 180 | 80.0% | 73.9% | 3048.8 | 0.22097 |
| BSI | 7 | 80.0% | 74.1% | 115.7 | 0.01659 |
| BSI | 14 | 80.0% | 74.8% | 226.3 | 0.03214 |
| BSI | 28 | 80.0% | 71.8% | 360.0 | 0.05140 |
| BSI | 60 | 80.0% | 73.9% | 507.2 | 0.07191 |
| BSI | 90 | 80.0% | 78.2% | 530.3 | 0.08235 |
| BSI | 180 | 80.0% | 73.2% | 662.2 | 0.11181 |
| BHSI | 7 | 80.0% | 77.2% | 51.0 | 0.01167 |
| BHSI | 14 | 80.0% | 79.5% | 110.2 | 0.02397 |
| BHSI | 28 | 80.0% | 74.6% | 188.6 | 0.04279 |
| BHSI | 60 | 80.0% | 76.6% | 271.7 | 0.06640 |
| BHSI | 90 | 80.0% | 75.9% | 312.6 | 0.07495 |
| BHSI | 180 | 80.0% | 75.0% | 375.4 | 0.10829 |

Mean absolute distance from nominal: 4.9 percentage points. Coverage ranges 68.9% to 80.7%. Capesize is the weakest — its tails are the fattest in the panel (excess kurtosis 13 in the real record), and an 80% band on a fat-tailed series under-covers unless it is made uninformatively wide.

## 5. Limitations

- Verified data ends 2019-07-31. Nothing here is validated against the post-2019 market, including COVID, the 2021 spike and the 2023 trough.
- Skill is measured against persistence, not against the forward freight agreement curve. An FFA curve embeds order-book information we do not have, and we make no claim to beat it.
- Overlapping targets mean the effective sample is far smaller than the origin count: at h=180, ~810 origins represent roughly seven independent windows.
- MASE is not comparable across horizons, only across models at one horizon.
- Empirical coverage below nominal means the bands are optimistic where it is under 80%, most visibly for Capesize.

## 6. Reproducing

```bash
pip install -r ml-work/forecast_v2/requirements.txt
python ml-work/forecast_v2/run_benchmark.py --tag v2_real
python ml-work/forecast_v2/run_intervals.py --tag v2
python ml-work/forecast_v2/train_final.py
python ml-work/forecast_v2/make_docs.py
pytest ml-work/tests -q && pytest backend-work/tests -q
```
