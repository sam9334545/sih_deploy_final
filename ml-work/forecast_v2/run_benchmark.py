"""Rolling-origin benchmark on verified real Baltic data."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import models as M
from forecast_v2.dataset import INDEX_COLS, feature_columns, load_real, supervised
from forecast_v2.walkforward import (
    block_bootstrap_pvalue, metrics, scale_denominator, skill_vs, walk_forward,
)

REAL = "data/processed/real_baltic_multivariate.csv"
HORIZONS = [7, 14, 28, 60, 90, 180]


def model_factories(feature_cols: list[str]) -> dict:
    return {
        "naive_flat": lambda: M.NaiveFlat(),
        "drift_mean": lambda: M.DriftMean(),
        "damped_momentum": lambda: M.DampedMomentum(feature_cols),
        "ridge": lambda: M.RidgeModel(),
        "lightgbm": lambda: M.LgbModel(),
        "ensemble": lambda: M.Ensemble([
            M.DampedMomentum(feature_cols), M.RidgeModel(), M.LgbModel(),
        ]),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", nargs="*", default=INDEX_COLS)
    ap.add_argument("--horizons", nargs="*", type=int, default=HORIZONS)
    ap.add_argument("--min-train", type=int, default=500)
    ap.add_argument("--step", type=int, default=21)
    ap.add_argument("--augment", default=None, help="npz of synthetic rows to prepend")
    ap.add_argument("--tag", default="v2")
    args = ap.parse_args()

    df = load_real(REAL)
    rows, preds_store = [], {}
    t0 = time.perf_counter()

    for target in args.targets:
        for h in args.horizons:
            data = supervised(df, target, h)
            fcols = feature_columns(data)
            denom = scale_denominator(data, args.min_train)

            augment = None
            if args.augment:
                z = np.load(args.augment, allow_pickle=True)
                key = f"{target}_h{h}"
                if f"X_{key}" in z:
                    augment = (z[f"X_{key}"], z[f"y_{key}"])

            base_pred = None
            for name, factory in model_factories(fcols).items():
                p = walk_forward(data, fcols, factory, min_train=args.min_train,
                                 step=args.step,
                                 augment=augment if name in ("ridge", "lightgbm", "ensemble") else None)
                m = metrics(p, denom)
                if name == "naive_flat":
                    base_pred = p
                m["skill_vs_naive_pct"] = skill_vs(p, base_pred)
                m["bootstrap_p"] = (block_bootstrap_pvalue(p, base_pred, h)
                                    if name != "naive_flat" else float("nan"))
                rows.append({"target": target.replace("_value", "").upper(),
                             "horizon": h, "model": name, **m})
                preds_store[f"{target}_h{h}_{name}"] = p
                print(f"{target[:4].upper():5} h={h:<4} {name:16} "
                      f"MASE {m['mase']:6.3f}  MAE {m['mae']:8.2f}  "
                      f"skill {m['skill_vs_naive_pct']:+6.2f}%  dir {m['directional_accuracy']:5.1f}%  "
                      f"p={m['bootstrap_p']}", flush=True)

    out = pd.DataFrame(rows)
    Path("reports").mkdir(exist_ok=True)
    out.to_csv(f"reports/{args.tag}_benchmark_results.csv", index=False)
    with pd.HDFStore if False else open(f"reports/{args.tag}_run_meta.json", "w") as f:
        json.dump({"runtime_s": round(time.perf_counter() - t0, 1),
                   "min_train": args.min_train, "step": args.step,
                   "augmented": bool(args.augment), "n_rows": len(out)}, f, indent=1)
    print(f"\nwrote reports/{args.tag}_benchmark_results.csv  "
          f"({time.perf_counter() - t0:.0f}s)")


if __name__ == "__main__":
    main()
