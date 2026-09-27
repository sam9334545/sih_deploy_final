# Reproducing the forecast_v2 environment

The committed artifacts under `models/saved_models/v2/` were trained with the
exact versions in `requirements.txt`. Every artifact also records the versions it
was built under, in its own metadata — `manifest.json` carries `environment` per
entry, so a mismatch is detectable rather than mysterious.

```bash
python3.13 -m venv .venv-ml
./.venv-ml/bin/pip install -r ml-work/forecast_v2/requirements.txt
./.venv-ml/bin/python -m pytest ml-work/tests -q
```

## Why the pins are exact

`joblib` artifacts embed pickled scikit-learn estimators and LightGBM boosters.
Loading them under a different minor version can raise `InconsistentVersionWarning`,
or worse, load without complaint while behaving differently. Pinning makes the
inference environment equal to the training environment by construction.

## LightGBM validation API

LightGBM changed the `fit()` validation arguments: `<=4.6` takes `eval_set=[(X, y)]`,
`>=4.7` takes `eval_X=` / `eval_y=` and deprecates the old form. Passing the wrong
one raises `TypeError`. `models.py` detects which the installed version accepts via
`inspect.signature` rather than assuming, so the package trains and loads on both —
but the pin above is what the artifacts were actually built with.

## Checking an installed environment against the pins

```bash
python ml-work/forecast_v2/check_env.py
```

Exits non-zero and names every mismatch. The same check runs inside the test
suite as `test_environment_matches_artifact_metadata`, reported as a warning
rather than a hard failure so a deliberate upgrade does not block the suite —
but the mismatch is always visible.
