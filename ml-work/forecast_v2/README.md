# forecast_v2 — freight index forecasting

A rebuild of the forecasting stack around three rules:

1. **Every feature at origin `t` is computable from data up to `t`.** Enforced by
   `tests/test_forecast_v2.py::test_features_do_not_see_the_future`, which recomputes
   the feature row on truncated history and asserts it is bit-for-bit identical.
2. **Test metrics come from real observations only.** Synthetic data may be fitted on,
   never scored on.
3. **A model has to beat persistence across many origins**, with a block-bootstrap
   p-value, not on one lucky split.

## Layout

| File | What it does |
|---|---|
| `dataset.py` | Feature construction and h-session-ahead log-return targets |
| `models.py` | Model ladder: naive → drift → damped momentum → ridge → LightGBM → ensemble |
| `walkforward.py` | Expanding-origin evaluation, MASE/skill/directional metrics, block bootstrap |
| `synth.py` | VAR-sieve synthetic generator + stylized-fact fidelity report |
| `postcovid.py` | Regime-anchored 2019→present generator + calendar validation |
| `conformal.py` | Conformalized quantile regression for calibrated 80% bands |
| `build_synthetic.py` | CLI: generate panels, audit fidelity, emit augmentation rows |
| `build_postcovid.py` | CLI: build the post-COVID panel and the combined real+synthetic series |
| `run_benchmark.py` | CLI: point-forecast benchmark |
| `run_intervals.py` | CLI: interval benchmark |
| `train_final.py` | CLI: fit production artifacts with metadata |
| `predict.py` | Serving: history in, calibrated forecast out |
| `make_report.py` | CLI: assemble `reports/v2_evaluation_report.md` |

## Reproduce

```bash
python forecast_v2/build_synthetic.py --n-paths 24
python forecast_v2/build_postcovid.py --scenarios 5
python forecast_v2/run_benchmark.py --tag v2_real
python forecast_v2/run_benchmark.py --tag v2_aug --augment data/synthetic/augmentation.npz
python forecast_v2/run_intervals.py --tag v2
python forecast_v2/train_final.py --benchmark reports/v2_real_benchmark_results.csv
python forecast_v2/make_report.py
pytest tests/test_forecast_v2.py
```

## Two things to know before quoting the numbers

**The target is the log return, not the level.** That makes the naive forecast exactly
zero, so any skill the model has is visible rather than hidden inside a level that is
95% explained by yesterday's level. It is also why v2's MASE values are not comparable
to the phase-4 table: different target, different baseline, different origin set.

**The verified data ends in July 2019.** The real series (Mendeley DOI
`10.17632/t76ckh2ygg.1`, CC-BY-4.0) covers 2012-08 to 2019-07. Every accuracy number in
the report is measured on those rows and nothing else.

**The post-2019 rows are synthetic and are barred from scoring.**
`baltic_real_plus_postcovid.csv` carries a `provenance_tag` per row; anything tagged
`synthetic_postcovid` exists so the application can run on current dates. Its dynamics
are fitted to real data, but its shape — collapse, boom, trough, recovery — comes from a
regime calendar of *judgement calls* documented in `postcovid.py`. A model evaluated on
it would be graded against our own assumptions, which is worth nothing. If someone
licenses the real series, delete `postcovid.py` and load the real data; the interface is
unchanged.
