"""Fit the production artifacts: one per index × horizon, with full provenance.

Model selection is driven by the rolling-origin benchmark, not by assumption.
The ensemble usually wins, but "usually" is not "always", and hard-coding it
would hide the cases where a baseline is the honest answer. The rule is stated
in `SELECTION_RULE` and recorded in every artifact.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import models as M
from forecast_v2 import provenance as prov
from forecast_v2.dataset import (
    INDEX_COLS, FeatureSpec, feature_columns, load_real, supervised,
)

REAL = "data/processed/real_baltic_multivariate.csv"
OUT = Path("models/saved_models/v2")
ALPHA = 0.20
HORIZONS = [7, 14, 28, 60, 90, 180]

SELECTION_RULE = (
    "Lowest rolling-origin MASE among models that beat persistence on MAE. "
    "If no model beats persistence, persistence itself is selected and served. "
    "Significance (moving-block bootstrap, block = horizon) is recorded but does "
    "not gate selection: an insignificant 5% gain is still the better bet, and "
    "the p-value travels with the forecast so the caller can judge."
)

CANDIDATES = ("naive_flat", "drift_mean", "damped_momentum", "ridge", "lightgbm", "ensemble")


def build_model(name: str, feature_cols: list[str]):
    if name == "naive_flat":
        return M.NaiveFlat()
    if name == "drift_mean":
        return M.DriftMean()
    if name == "damped_momentum":
        return M.DampedMomentum(feature_cols)
    if name == "ridge":
        return M.RidgeModel()
    if name == "lightgbm":
        return M.LgbModel()
    if name == "ensemble":
        return M.Ensemble([M.DampedMomentum(feature_cols), M.RidgeModel(), M.LgbModel()])
    raise ValueError(f"unknown model {name}")


def select_model(bench: pd.DataFrame, code: str, horizon: int) -> tuple[str, dict]:
    rows = bench[(bench["target"] == code) & (bench["horizon"] == horizon)]
    if rows.empty:
        return "ensemble", {"note": "no benchmark row; defaulted to ensemble"}
    rows = rows[rows["model"].isin(CANDIDATES)]
    beats = rows[(rows["model"] != "naive_flat") & (rows["skill_vs_naive_pct"] > 0)]
    pick = (beats.sort_values("mase").iloc[0] if not beats.empty
            else rows[rows["model"] == "naive_flat"].iloc[0])
    return pick["model"], {
        "mase": float(pick["mase"]),
        "skill_vs_naive_pct": float(pick["skill_vs_naive_pct"]),
        "directional_accuracy": float(pick["directional_accuracy"]),
        "bootstrap_p": (None if pd.isna(pick.get("bootstrap_p"))
                        else float(pick["bootstrap_p"])),
        "n_origins": int(pick["n"]),
        "significant_at_05": (False if pd.isna(pick.get("bootstrap_p"))
                              else bool(pick["bootstrap_p"] < 0.05)),
        "beat_persistence": bool(pick["model"] != "naive_flat"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizons", nargs="*", type=int, default=HORIZONS)
    ap.add_argument("--augment", default=None,
                    help="npz of synthetic rows; OFF by default (see §3 of the report)")
    ap.add_argument("--benchmark", default="reports/v2_real_benchmark_results.csv")
    ap.add_argument("--intervals", default="reports/v2_interval_results.csv")
    args = ap.parse_args()

    df = load_real(REAL)
    spec = FeatureSpec()
    dataset_hash = prov.frame_sha256(df)
    spec_hash = prov.spec_sha256(spec.__dict__)
    env = prov.environment()
    sha, dirty = prov.git_sha(), prov.git_dirty()

    bench = (pd.read_csv(args.benchmark) if Path(args.benchmark).exists()
             else pd.DataFrame())
    if bench.empty:
        print(f"WARNING: no benchmark at {args.benchmark}; every combination will "
              "default to the ensemble and carry no validation metrics")
    intervals = (pd.read_csv(args.intervals) if Path(args.intervals).exists()
                 else pd.DataFrame())

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []

    for target in INDEX_COLS:
        code = target.replace("_value", "").upper()
        for h in args.horizons:
            data = supervised(df, target, h, spec)
            fcols = feature_columns(data)
            X = data[fcols].to_numpy(dtype=float)
            y = data["target_logret"].to_numpy(dtype=float)

            n_hold = max(60, int(len(X) * 0.2))
            X_fit, y_fit = X[:-n_hold], y[:-n_hold]
            X_cal, y_cal = X[-n_hold:], y[-n_hold:]

            weights, aug_source = None, None
            if args.augment:
                z = np.load(args.augment)
                key = f"{target}_h{h}"
                if f"X_{key}" in z:
                    aug_X, aug_y = z[f"X_{key}"], z[f"y_{key}"]
                    cap = len(X_fit) * 3
                    if len(aug_X) > cap:
                        sel = np.linspace(0, len(aug_X) - 1, cap).astype(int)
                        aug_X, aug_y = aug_X[sel], aug_y[sel]
                    weights = np.concatenate([np.full(len(aug_X), 0.3),
                                              np.ones(len(X_fit))])
                    X_fit = np.vstack([aug_X, X_fit])
                    y_fit = np.concatenate([aug_y, y_fit])
                    aug_source = args.augment

            chosen, validation = select_model(bench, code, h) if not bench.empty \
                else ("ensemble", {})
            point = build_model(chosen, fcols)
            point.fit(X_fit, y_fit, X_val=X_cal, y_val=y_cal, sample_weight=weights)

            quantiles = {}
            for tau, tag in ((ALPHA / 2, "lo"), (0.5, "mid"), (1 - ALPHA / 2, "hi")):
                qm = M.LgbModel(objective="quantile", alpha=tau)
                qm.fit(X_fit, y_fit, X_val=X_cal, y_val=y_cal, sample_weight=weights)
                quantiles[tag] = qm

            q_lo = np.minimum(quantiles["lo"].predict(X_cal), quantiles["hi"].predict(X_cal))
            q_hi = np.maximum(quantiles["lo"].predict(X_cal), quantiles["hi"].predict(X_cal))
            s = np.maximum(q_lo - y_cal, y_cal - q_hi)
            k = min(len(s) - 1, int(np.ceil((len(s) + 1) * (1 - ALPHA))) - 1)
            q_hat = float(np.sort(s)[max(k, 0)])

            iv = {}
            if not intervals.empty:
                r = intervals[(intervals["target"] == code) & (intervals["horizon"] == h)]
                if not r.empty:
                    r = r.iloc[0]
                    iv = {"nominal_coverage_pct": 80.0,
                          "empirical_coverage_pct": float(r["calibrated_coverage_pct"]),
                          "raw_coverage_pct": float(r["raw_coverage_pct"]),
                          "mean_width_index_points": float(r["calibrated_mean_width"]),
                          "pinball_logret": float(r["pinball"]),
                          "crossing_rate_pct_before_sort": float(r["crossing_rate_pct"]),
                          "n_origins": int(r["n"])}

            p = prov.ModelProvenance(
                model_version="v2", index_code=code, horizon_days=h,
                selected_model=chosen, selection_rule=SELECTION_RULE,
                trained_at=prov.now_iso(),
                trained_through=str(df["obs_date"].max().date()),
                dataset_path=REAL, dataset_sha256=dataset_hash, dataset_rows=len(df),
                feature_spec_sha256=spec_hash, feature_count=len(fcols),
                n_train_real=int(len(X) - n_hold), n_calibration=int(n_hold),
                augmentation_used=bool(args.augment), augmentation_source=aug_source,
                data_provenance="verified_real_mendeley_cc_by_4.0",
                git_commit=sha, git_dirty=dirty, environment=env,
                validation=validation, interval=iv,
            )

            path = OUT / f"{code.lower()}_h{h}.joblib"
            joblib.dump({"point": point, "quantiles": quantiles, "q_hat": q_hat,
                         "features": fcols, "alpha": ALPHA,
                         "provenance": p.to_dict()}, path)
            p.artifact_sha256 = prov.file_sha256(path)
            payload = joblib.load(path)
            payload["provenance"]["artifact_sha256_note"] = (
                "hash of the artifact as first written, before this field was added")
            payload["provenance"]["artifact_sha256"] = p.artifact_sha256
            joblib.dump(payload, path)

            manifest.append(p.to_dict())
            extra = (f" weights {point.weights}" if isinstance(point, M.Ensemble) else "")
            print(f"{code:5} h={h:<4} {chosen:16} "
                  f"MASE {validation.get('mase', float('nan')):7.3f} "
                  f"skill {validation.get('skill_vs_naive_pct', float('nan')):+6.2f}% "
                  f"cov {iv.get('empirical_coverage_pct', float('nan')):5.1f}% "
                  f"q_hat {q_hat:+.4f}{extra}")

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    picks = pd.Series([m["selected_model"] for m in manifest]).value_counts()
    print(f"\nwrote {len(manifest)} artifacts to {OUT}")
    print("selected models:", picks.to_dict())


if __name__ == "__main__":
    main()
