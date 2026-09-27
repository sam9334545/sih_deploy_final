"""Fit the production models on all verified real data and save them with metadata.

One artifact per (index, horizon): the point model (ensemble), the three quantile
models, and the conformal width. Each artifact records what it was trained on,
its rolling-origin score, and whether synthetic augmentation was used — so a
served forecast can always be traced back to how it was earned.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import models as M
from forecast_v2.dataset import INDEX_COLS, feature_columns, load_real, supervised

REAL = "data/processed/real_baltic_multivariate.csv"
OUT = Path("models/saved_models/v2")
ALPHA = 0.20


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizons", nargs="*", type=int, default=[7, 14, 28, 60, 90, 180])
    ap.add_argument("--augment", default=None)
    ap.add_argument("--benchmark", default="reports/v2_real_benchmark_results.csv")
    args = ap.parse_args()

    df = load_real(REAL)
    scores = {}
    if Path(args.benchmark).exists():
        b = pd.read_csv(args.benchmark)
        for _, r in b.iterrows():
            scores[(r["target"], int(r["horizon"]), r["model"])] = {
                "mase": r["mase"], "skill_vs_naive_pct": r["skill_vs_naive_pct"],
                "directional_accuracy": r["directional_accuracy"],
                "bootstrap_p": r.get("bootstrap_p"),
            }

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []

    for target in INDEX_COLS:
        code = target.replace("_value", "").upper()
        for h in args.horizons:
            data = supervised(df, target, h)
            fcols = feature_columns(data)
            X = data[fcols].to_numpy(dtype=float)
            y = data["target_logret"].to_numpy(dtype=float)

            n_hold = max(60, int(len(X) * 0.2))
            X_fit, y_fit = X[:-n_hold], y[:-n_hold]
            X_cal, y_cal = X[-n_hold:], y[-n_hold:]

            w = None
            if args.augment:
                z = np.load(args.augment)
                key = f"{target}_h{h}"
                if f"X_{key}" in z:
                    aug_X, aug_y = z[f"X_{key}"], z[f"y_{key}"]
                    cap = len(X_fit) * 3
                    if len(aug_X) > cap:
                        sel = np.linspace(0, len(aug_X) - 1, cap).astype(int)
                        aug_X, aug_y = aug_X[sel], aug_y[sel]
                    w = np.concatenate([np.full(len(aug_X), 0.3), np.ones(len(X_fit))])
                    X_fit = np.vstack([aug_X, X_fit])
                    y_fit = np.concatenate([aug_y, y_fit])

            point = M.Ensemble([M.DampedMomentum(fcols), M.RidgeModel(), M.LgbModel()])
            point.fit(X_fit, y_fit, X_val=X_cal, y_val=y_cal, sample_weight=w)

            quantiles = {}
            for tau, tag in ((ALPHA / 2, "lo"), (0.5, "mid"), (1 - ALPHA / 2, "hi")):
                qm = M.LgbModel(objective="quantile", alpha=tau)
                qm.fit(X_fit, y_fit, X_val=X_cal, y_val=y_cal, sample_weight=w)
                quantiles[tag] = qm

            q_lo = np.minimum(quantiles["lo"].predict(X_cal), quantiles["hi"].predict(X_cal))
            q_hi = np.maximum(quantiles["lo"].predict(X_cal), quantiles["hi"].predict(X_cal))
            s = np.maximum(q_lo - y_cal, y_cal - q_hi)
            k = min(len(s) - 1, int(np.ceil((len(s) + 1) * (1 - ALPHA))) - 1)
            q_hat = float(np.sort(s)[max(k, 0)])

            meta = {
                "index_code": code, "horizon_days": h, "model": "ensemble_v2",
                "members": list(point.weights), "weights": point.weights,
                "alpha": ALPHA, "q_hat_logret": round(q_hat, 5),
                "n_train_real": int(len(X) - n_hold), "n_calibration": int(n_hold),
                "augmented": bool(args.augment),
                "trained_on": str(df["obs_date"].max().date()),
                "data_provenance": "verified_real_mendeley_cc_by_4.0",
                "feature_count": len(fcols),
                "rolling_origin_score": scores.get((code, h, "ensemble")),
                "built_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            joblib.dump({"point": point, "quantiles": quantiles, "q_hat": q_hat,
                         "features": fcols, "meta": meta},
                        OUT / f"{code.lower()}_h{h}.joblib")
            manifest.append(meta)
            print(f"{code:5} h={h:<4} weights {point.weights}  q_hat {q_hat:.4f}")

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"\nwrote {len(manifest)} artifacts to {OUT}")


if __name__ == "__main__":
    main()
