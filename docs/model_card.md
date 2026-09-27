# Model Card — forecast_v2

Generated 2026-09-28 from the trained artifacts. Model version `v2`, trained 2026-09-27, git `372a1e6478`.

## Purpose

Short- and medium-term forecasts of the four Baltic dry bulk class indices, with calibrated uncertainty, as an **input to a chartering decision** — not as a price oracle. The system that consumes it treats the forecast as one uncertain term in a constrained cost model; the interval matters more than the point.

**Intended use.** Ranking charter timing and vessel-class options for dry bulk voyages into India's East Coast ports, on horizons of one week to six months.

**Out of scope.** Trading FFAs or any financial instrument; forecasting individual voyage rates for a specific ship and cargo; any use where being wrong on a single forecast is unacceptable. The model does not beat, and does not attempt to beat, the forward freight agreement curve.

## Targets and horizons

| Index | Vessel class | Horizons (trading sessions) |
|---|---|---|
| BPI | Panamax | 7, 14, 28, 60, 90, 180 |
| BCI | Capesize | 7, 14, 28, 60, 90, 180 |
| BSI | Supramax | 7, 14, 28, 60, 90, 180 |
| BHSI | Handysize | 7, 14, 28, 60, 90, 180 |

24 artifacts, one per index x horizon. Each predicts the h-session log return and is served with a conformalized 80% interval.

## Features

73 features, all computable from information available at the forecast origin. The raw index level is deliberately excluded: it is non-stationary, and a linear model handed it reverts every forecast toward the training mean.

| Group | Count | Examples |
|---|---|---|
| cross_index_spread | 12 | `spread_bci_lag_0`, `spread_bci_lag_1`, `spread_bci_lag_7` |
| lag | 10 | `logret_lag_1`, `logret_lag_2`, `logret_lag_3` |
| momentum | 10 | `mom_1`, `ret1_ma_1`, `mom_5` |
| rolling_trend | 10 | `dev_ma_7`, `slope_7`, `dev_ma_14` |
| cross_index_return | 9 | `bci_ret_5`, `bci_ret_21`, `bci_vol_21` |
| calendar | 8 | `sin_1y`, `cos_1y`, `sin_2y` |
| volatility | 7 | `vol_10`, `vol_pctile_10`, `vol_21` |
| extremes | 6 | `drawdown_63`, `runup_63`, `range_pos_63` |
| market_breadth | 1 | `breadth_5` |

Leakage is enforced by test, not by inspection: `test_no_feature_reacts_to_data_after_its_origin` rewrites every value strictly after origin T and asserts each feature at T is bit-identical, across four origins and all four indices.

## Algorithms

| Model | Role |
|---|---|
| Persistence (naive flat) | Baseline. Skill is measured against it. |
| Drift mean | Unconstrained constant drift. |
| Damped momentum | Fitted damping on 21-session momentum. |
| Ridge | Standardised stationary features; penalty chosen on a chronological validation tail. |
| LightGBM | Shallow, heavily regularised, early-stopped. |
| Ensemble | Non-negative simplex blend of the three, weights fitted on validation. |

Selected across the 24 combinations: {'ensemble': 24}. Selection is driven by the benchmark, not hard-coded — if a baseline wins, the baseline ships.

## Validation

Expanding-window rolling origin, refit every 21 sessions, scored on every origin after the warm-up. Significance from a moving-block bootstrap with block length equal to the horizon. Full results: [ML_VALIDATION_REPORT.md](ML_VALIDATION_REPORT.md).

- Median skill vs persistence: **21.2%** (range 4.9% to 39.0%)
- Significant at p<0.05: **18/24**
- Median directional accuracy: **68.6%**

## Uncertainty

Conformalized quantile regression with per-origin rank sorting. The 80% band achieves **75.2% mean empirical coverage** (range 68.9%–80.7%), measured on rolling origins.

`forecast_quality_score` is a **heuristic in [0,1], not a probability**. It blends band tightness, measured out-of-sample skill and interval calibration to rank forecasts from this system against each other. The probabilistic statement is the interval and its measured coverage.

## Explainability

Per-feature attribution, not ensemble weights: exact TreeSHAP for LightGBM (`pred_contrib`), exact linear contributions for ridge, and the blend weights compose them for the ensemble. A test asserts contributions plus base value reconstruct the prediction.

## Data

- **Training and evaluation:** verified real Baltic daily indices, 2012-08-01 to 2019-07-31, 1,749 sessions (Mendeley DOI `10.17632/t76ckh2ygg.1`, CC-BY-4.0). Dataset SHA-256 `1c392e244def0e19...`
- **Per artifact:** 1,188-ish training rows and 297 calibration rows (exact counts vary by horizon).
- **Synthetic augmentation:** `False`. It measurably helps ridge (+2.3pp) and LightGBM (+2.0pp) but not the served ensemble (-0.3pp), so it is off in production.
- **Post-2019 synthetic panel:** exists so the application can run on current dates. Tagged `synthetic_postcovid` in every row and excluded from all training, validation and scoring.

## Limitations

- Validated only through 2019-07-31. The model has never seen COVID, the 2021 spike or the 2023 trough.
- Capesize intervals under-cover (68.9%-77.2% against a nominal 80%): its returns have excess kurtosis of 13 in the real record.
- Long horizons rest on few independent windows — roughly seven at h=180.
- BPI h=14, h=28 and h=180 do not reach significance at p<0.05; their gains may be noise.
- The model has no knowledge of vessel supply, port congestion or fixtures. Those enter the decision elsewhere in the system, not here.

## Reproducibility

- Python 3.13.6, numpy 2.5.3, pandas 3.0.6, scipy 1.18.1, scikit-learn 1.9.1, lightgbm 4.7.0, statsmodels 0.15.0, joblib 1.6.0
- Exact pins: `ml-work/forecast_v2/requirements.txt`; verify with `python ml-work/forecast_v2/check_env.py`
- Every artifact records dataset hash, feature-spec hash, artifact hash, git commit, environment, row counts, selection rule and validation metrics; the API returns them as `model_provenance`.

## Serving

`POST /api/v1/forecast` -> `forecast_service` -> `forecast_v2`. If the artifacts or ML dependencies are unavailable the API falls back to a built-in numpy model and says so explicitly via `model_meta.model_source` (`forecast_v2` | `fallback_v1`) and `fallback_reason`.
