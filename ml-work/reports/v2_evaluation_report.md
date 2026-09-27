# Forecast v2 — rolling-origin evaluation on verified real Baltic data

Generated 2026-09-27 · `ml-work/forecast_v2`

## 1. What changed and why

| Issue in the previous pipeline | Evidence | Fix in v2 |
|---|---|---|
| Single fixed train/val/test cut, ~250 test origins in one regime | conclusions flipped between horizons | expanding-window rolling origin over every origin after the warm-up, refit every 21 sessions |
| Ridge handed the raw (non-stationary) index level | ridge scored 17–27% worse than persistence | level enters only through stationary transforms; alpha chosen on a chronological validation tail, never by shuffled/LOO CV |
| LightGBM unconstrained on ~1,200 rows × 74 features | GBM worse than naive at several horizons | shallow trees, heavy L2, feature subsampling, early stopping |
| 80% intervals covering ~50% | phase-5 raw coverage 22–65% | conformalized quantile regression with a finite-sample order statistic |
| Quantile curves crossing on up to 38% of origins | phase-5 crossing_rate | per-origin rank sorting before any interval is formed |
| Overlapping targets treated as independent | — | moving-block bootstrap, block length = horizon, for every significance claim |

## 2. Headline result

Best model per index and horizon, scored on real observations the model never saw. `skill` is the reduction in mean absolute error against the persistence forecast; `p` is the moving-block bootstrap probability that the gain is noise.

| target | horizon | model | mase | naive_mase | skill_vs_naive_pct | directional_accuracy | bootstrap_p | n |
|---|---|---|---|---|---|---|---|---|
| BCI | 7 | ensemble | 3.900 | 4.245 | 8.120 | 60.570 | 0.011 | 985 |
| BCI | 14 | ensemble | 5.928 | 6.718 | 11.760 | 60.960 | 0.025 | 978 |
| BCI | 28 | ensemble | 7.865 | 9.730 | 19.170 | 69.090 | 0.005 | 964 |
| BCI | 60 | ensemble | 9.400 | 14.063 | 33.160 | 76.610 | 0.000 | 932 |
| BCI | 90 | ensemble | 9.034 | 14.661 | 38.380 | 78.820 | 0.000 | 902 |
| BCI | 180 | ensemble | 9.590 | 12.829 | 25.240 | 70.570 | 0.025 | 812 |
| BHSI | 7 | ensemble | 3.828 | 6.279 | 39.030 | 84.450 | 0.000 | 985 |
| BHSI | 14 | ensemble | 7.517 | 11.302 | 33.490 | 79.980 | 0.000 | 978 |
| BHSI | 28 | ensemble | 14.070 | 18.281 | 23.040 | 71.530 | 0.000 | 964 |
| BHSI | 60 | ensemble | 17.310 | 24.359 | 28.940 | 68.060 | 0.000 | 932 |
| BHSI | 90 | ensemble | 21.817 | 27.665 | 21.140 | 70.940 | 0.047 | 902 |
| BHSI | 180 | ensemble | 26.946 | 34.227 | 21.270 | 63.500 | 0.216 | 812 |
| BPI | 7 | ensemble | 5.118 | 5.905 | 13.320 | 66.670 | 0.000 | 985 |
| BPI | 14 | ensemble | 8.562 | 8.999 | 4.860 | 55.840 | 0.159 | 978 |
| BPI | 28 | ensemble | 11.275 | 12.141 | 7.130 | 51.760 | 0.106 | 964 |
| BPI | 60 | ensemble | 12.710 | 15.103 | 15.840 | 64.590 | 0.003 | 932 |
| BPI | 90 | ensemble | 13.632 | 16.497 | 17.360 | 62.150 | 0.145 | 902 |
| BPI | 180 | ensemble | 16.884 | 18.062 | 6.520 | 60.960 | 0.328 | 812 |
| BSI | 7 | ensemble | 4.038 | 5.523 | 26.890 | 74.010 | 0.000 | 985 |
| BSI | 14 | ensemble | 8.011 | 9.300 | 13.850 | 69.510 | 0.007 | 978 |
| BSI | 28 | ensemble | 11.348 | 13.992 | 18.900 | 71.550 | 0.004 | 964 |
| BSI | 60 | ensemble | 14.363 | 18.607 | 22.810 | 74.220 | 0.001 | 932 |
| BSI | 90 | ensemble | 15.827 | 21.059 | 24.840 | 64.920 | 0.032 | 902 |
| BSI | 180 | ensemble | 20.361 | 26.294 | 22.570 | 60.220 | 0.224 | 812 |

**18 of 24 index–horizon pairs beat persistence at p < 0.05.** Median skill across all pairs: 21.2%; median directional accuracy 68.6%.

## 3. Did synthetic augmentation help?

Change in skill (percentage points) from adding synthetic training rows, by model and by horizon:

| model    |   mean |   median |   count |
|:---------|-------:|---------:|--------:|
| ensemble |  -0.27 |     0.38 |      24 |
| lightgbm |   1.96 |     1.32 |      24 |
| ridge    |   2.33 |     2.77 |      24 |

|   horizon |   delta_skill_pp |
|----------:|-----------------:|
|         7 |             2.61 |
|        14 |             0.3  |
|        28 |             0.36 |
|        60 |            -1.91 |
|        90 |             1.63 |
|       180 |             5.03 |

Augmentation improved 60% of the model–index–horizon cells (mean change +1.34 pp).

**Verdict: synthetic augmentation is OFF in the production models.** It clearly helps the individual learners — ridge +2.33 pp and LightGBM +1.96 pp on average, with the largest gains at the long horizons where real independent samples are scarcest. But the ensemble, which is the model we actually serve, moves -0.27 pp on average with a spread from -8.1 to +5.2 pp. The blend already recovers most of what augmentation buys the weak learners, so the extra rows add variance without adding skill. Turning it on anyway, because the idea is appealing, is how a pipeline acquires a component nobody can defend.

The generator stays in the repository for two reasons that do hold up: it produces the 2019→present bridge the application demos on, and it is the honest way to answer *what would more data buy us* when the jury asks.

## 4. Synthetic data fidelity

The generator is a VAR(5) sieve on log returns with block-resampled residuals, fitted only on real sessions before the first evaluated origin. It has to reproduce the properties the learner consumes — volatility, momentum persistence, volatility clustering and cross-index correlation — or the extra rows teach the wrong market.

See `reports/v2_synthetic_fidelity.csv` for the full real-vs-synthetic table.

## 5. Interval calibration

| target | horizon | raw_coverage_pct | calibrated_coverage_pct | calibrated_mean_width | pinball | crossing_rate_pct |
|---|---|---|---|---|---|---|
| BPI | 7 | 73.71 | 77.56 | 323.49 | 0.03 | 0.10 |
| BPI | 14 | 77.51 | 79.86 | 566.02 | 0.05 | 0.10 |
| BPI | 28 | 77.49 | 79.15 | 783.62 | 0.07 | 1.04 |
| BPI | 60 | 76.29 | 75.11 | 840.70 | 0.10 | 0.54 |
| BPI | 90 | 69.29 | 74.50 | 926.56 | 0.12 | 2.66 |
| BPI | 180 | 59.36 | 80.67 | 1228.85 | 0.14 | 4.56 |
| BCI | 7 | 71.88 | 77.16 | 1006.12 | 0.07 | 0.00 |
| BCI | 14 | 70.25 | 73.31 | 1674.14 | 0.11 | 0.31 |
| BCI | 28 | 62.34 | 68.88 | 2380.58 | 0.17 | 2.90 |
| BCI | 60 | 54.18 | 68.99 | 3064.84 | 0.21 | 4.61 |
| BCI | 90 | 55.88 | 69.73 | 3560.93 | 0.22 | 4.66 |
| BCI | 180 | 60.59 | 73.89 | 3048.81 | 0.22 | 6.28 |
| BSI | 7 | 65.69 | 74.11 | 115.70 | 0.02 | 2.94 |
| BSI | 14 | 68.00 | 74.85 | 226.31 | 0.03 | 0.92 |
| BSI | 28 | 67.12 | 71.78 | 359.98 | 0.05 | 1.56 |
| BSI | 60 | 74.68 | 73.93 | 507.23 | 0.07 | 4.40 |
| BSI | 90 | 67.41 | 78.16 | 530.29 | 0.08 | 5.65 |
| BSI | 180 | 56.65 | 73.15 | 662.16 | 0.11 | 10.34 |
| BHSI | 7 | 67.11 | 77.16 | 51.02 | 0.01 | 1.12 |
| BHSI | 14 | 69.12 | 79.45 | 110.19 | 0.02 | 2.97 |
| BHSI | 28 | 69.61 | 74.59 | 188.58 | 0.04 | 2.49 |
| BHSI | 60 | 76.07 | 76.61 | 271.73 | 0.07 | 2.90 |
| BHSI | 90 | 68.07 | 75.94 | 312.57 | 0.07 | 4.21 |
| BHSI | 180 | 57.88 | 75.00 | 375.39 | 0.11 | 2.96 |

Mean absolute distance from the nominal 80%: **12.7 pp raw → 4.9 pp calibrated**. Crossing rate after sorting is 0 by construction.

## 5b. Post-COVID panel (2019-08 → present)

No free source carries daily BPI/BCI/BSI/BHSI after July 2019 — the Baltic Exchange licenses it, and the one free mirror we found is behind bot detection we will not bypass. So the post-2019 span is synthetic, and built in two separable parts so each can be judged on its own:

- **Dynamics** — volatility, momentum persistence, cross-index correlation — come from the VAR sieve fitted to the real 2012–2019 record.
- **Macro shape** comes from the regime calendar below, applied as a moving anchor the path reverts toward. Each level is stated as a multiple of that index's own 2012–2019 median, scaled by an index beta (Capesize 1.45, Handysize 0.55) so the classes over- and under-react as they do in reality.

**The calendar is a set of judgement calls informed by public market commentary, not measurements.** The sequence of events is well documented; the daily values are not something we can verify, which is exactly why the table below states multiples rather than index points.

| start      | regime              |   anchor_multiple_of_2012_2019_median |   volatility_multiple | rationale                                                                                                                            |
|:-----------|:--------------------|--------------------------------------:|----------------------:|:-------------------------------------------------------------------------------------------------------------------------------------|
| 2019-08-01 | pre_covid_softening |                                  1    |                  1    | Trade-war drag and IMO 2020 scrubber retrofits taking tonnage out of service.                                                        |
| 2020-01-15 | covid_collapse      |                                  0.42 |                  1.2  | Chinese New Year plus the first COVID wave; dry bulk demand and the index both fell to multi-decade lows in February 2020.           |
| 2020-06-01 | stimulus_recovery   |                                  0.95 |                  1.1  | Chinese infrastructure stimulus restarts iron ore and coal flows.                                                                    |
| 2021-01-01 | supply_chain_boom   |                                  1.85 |                  1.15 | Port congestion locks up effective tonnage supply while commodity demand runs hot; dry bulk rates climb through the year.            |
| 2021-09-01 | boom_peak           |                                  2.8  |                  1.2  | The October 2021 peak — the strongest dry bulk market since 2008, driven by congestion-constrained supply rather than by new demand. |
| 2021-11-01 | post_peak_unwind    |                                  1.45 |                  1.2  | Chinese steel output curbs and easing congestion release tonnage; the spike reverses far faster than it built.                       |
| 2022-03-01 | war_dislocation     |                                  1.3  |                  1.15 | Ukraine invasion redraws grain and coal routings; tonne-mile gains partly offset weaker volumes.                                     |
| 2022-08-01 | demand_fade         |                                  0.85 |                  1.05 | Chinese property weakness and global slowdown pull rates down through H2.                                                            |
| 2023-01-15 | trough_2023         |                                  0.55 |                  1.1  | February 2023 trough; Capesize earnings fall below operating cost for a period.                                                      |
| 2023-06-01 | gradual_recovery    |                                  1.05 |                  1.1  | Bauxite and coal volumes recover; Panama Canal drought lengthens voyages.                                                            |
| 2024-01-01 | red_sea_rerouting   |                                  1.55 |                  1.05 | Red Sea diversions around the Cape absorb tonne-miles and tighten effective supply.                                                  |
| 2024-10-01 | normalisation       |                                  1.15 |                  1    | Rerouting premium partly priced in; market settles above its pre-COVID mean.                                                         |
| 2025-06-01 | range_bound         |                                  1.1  |                  1    | No dominant driver; rates range-trade on Chinese demand and fleet growth.                                                            |

Validation across 5 scenarios: worst calendar-tracking correlation 0.985; the Capesize peak lands inside the 2021 boom window in 5/5 of them. Both are asserted in the test suite, because the first working version put that peak in 2024.

This panel is for demonstrating and stress-testing the application on current dates. It is **not** evidence of forecast skill and must never be quoted as such: a model scored on it would be graded against our own assumptions.

## 6. Data inventory

| provenance_tag                   | min        | max        |   count |
|:---------------------------------|:-----------|:-----------|--------:|
| synthetic_postcovid              | 2019-08-01 | 2026-09-15 |    1859 |
| verified_real_mendeley_cc_by_4.0 | 2012-08-01 | 2019-07-31 |    1749 |

`baltic_real_plus_postcovid.csv` carries a `provenance_tag` on every row. Only `verified_real_*` rows are used for any metric in this report. The bridge exists so the application can run on current dates. It reproduces the market's *dynamics* from real data and its *shape* from a documented calendar — it is not a record of what the market did.

## 7. Honest limits

- Verified real data ends 2019-07-31 (Mendeley DOI 10.17632/t76ckh2ygg.1, CC-BY-4.0). Nothing here is validated on the post-2019 market, including COVID and the 2021 spike.
- Skill is measured against persistence, not against the forward freight agreement curve. An FFA curve embeds order-book information we do not have, and we do not claim to beat it.
- Long horizons have few independent target windows (at h=180 roughly seven), so those rows carry wide uncertainty whatever the point estimate says.
- Synthetic rows are a variance-reduction device fitted to pre-2014 dynamics. They are never scored on, and a model that needs them to win has not earned the win.