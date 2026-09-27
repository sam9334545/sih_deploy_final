"""Interval benchmark: raw vs conformally calibrated 80% bands."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2.conformal import walk_forward_intervals
from forecast_v2.dataset import INDEX_COLS, feature_columns, load_real, supervised

REAL = "data/processed/real_baltic_multivariate.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--targets", nargs="*", default=INDEX_COLS)
    ap.add_argument("--horizons", nargs="*", type=int, default=[7, 14, 28, 60, 90, 180])
    ap.add_argument("--augment", default=None)
    ap.add_argument("--tag", default="v2")
    args = ap.parse_args()

    df = load_real(REAL)
    rows = []
    for target in args.targets:
        for h in args.horizons:
            data = supervised(df, target, h)
            fcols = feature_columns(data)
            aug = None
            if args.augment:
                z = np.load(args.augment)
                key = f"{target}_h{h}"
                if f"X_{key}" in z:
                    aug = (z[f"X_{key}"], z[f"y_{key}"])
            res = walk_forward_intervals(data, fcols, augment=aug)
            f = res.frame
            rows.append({
                "target": target.replace("_value", "").upper(), "horizon": h,
                "raw_coverage_pct": round(float(f["covered_raw"].mean() * 100), 2),
                "calibrated_coverage_pct": res.coverage,
                "target_coverage_pct": 80.0,
                "raw_mean_width": round(float((f["lvl_p90_raw"] - f["lvl_p10_raw"]).mean()), 2),
                "calibrated_mean_width": res.mean_width,
                "pinball": res.pinball, "crossing_rate_pct": res.crossing_rate,
                "q_hat_logret": res.q_hat, "n": len(f),
            })
            print(f"{rows[-1]['target']:5} h={h:<4} raw {rows[-1]['raw_coverage_pct']:5.1f}% → "
                  f"cal {res.coverage:5.1f}%  width {res.mean_width:8.1f}  "
                  f"pinball {res.pinball:.5f}  crossing {res.crossing_rate:4.1f}%", flush=True)

    out = pd.DataFrame(rows)
    out.to_csv(f"reports/{args.tag}_interval_results.csv", index=False)
    print(f"\nwrote reports/{args.tag}_interval_results.csv")
    print(f"mean absolute coverage gap: raw "
          f"{(out['raw_coverage_pct'] - 80).abs().mean():.1f}pp → calibrated "
          f"{(out['calibrated_coverage_pct'] - 80).abs().mean():.1f}pp")


if __name__ == "__main__":
    main()
