"""Generate synthetic panels, audit their fidelity, and emit augmentation rows.

Leakage discipline: the generator is fitted on real sessions strictly before the
first evaluated origin (`--fit-until`, which must equal the benchmark's
--min-train). Nothing after that date influences a single synthetic row.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import synth
from forecast_v2.dataset import INDEX_COLS, feature_columns, load_real, supervised

REAL = "data/processed/real_baltic_multivariate.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-paths", type=int, default=24)
    ap.add_argument("--path-len", type=int, default=1500)
    ap.add_argument("--fit-until", type=int, default=500,
                    help="real row index the generator may see; must match --min-train")
    ap.add_argument("--horizons", nargs="*", type=int, default=[7, 14, 28, 60, 90, 180])
    ap.add_argument("--out", default="data/synthetic/augmentation.npz")
    ap.add_argument("--panels-out", default="data/synthetic/panels.csv")
    args = ap.parse_args()

    real = load_real(REAL)
    cfg = synth.SynthConfig(n_paths=args.n_paths, path_len=args.path_len)
    model = synth.fit(real, cfg, fit_until_index=args.fit_until)
    print(f"VAR({cfg.var_lags}) fitted on real data through {model.fitted_through} "
          f"({args.fit_until} sessions); spectral radius "
          f"{synth._spectral_radius(model.coefs):.3f}")

    paths = synth.simulate(model, cfg)
    print(f"generated {len(paths)} paths × {len(paths[0])} sessions")

    report = synth.fidelity_report(real.iloc[:args.fit_until], paths)
    Path("reports").mkdir(exist_ok=True)
    report.to_csv("reports/v2_synthetic_fidelity.csv")
    worst = report.xs("rel_error_pct", axis=1, level=1).abs().max().sort_values(ascending=False)
    print("\nfidelity — worst relative errors vs the real fitting window:")
    print(worst.head(6).round(1).to_string())

    Path(args.panels_out).parent.mkdir(parents=True, exist_ok=True)
    pd.concat(paths).to_csv(args.panels_out, index=False)

    arrays: dict[str, np.ndarray] = {}
    for target in INDEX_COLS:
        for h in args.horizons:
            Xs, ys = [], []
            for panel in paths:
                sup = supervised(panel, target, h)
                if sup.empty:
                    continue
                Xs.append(sup[feature_columns(sup)].to_numpy(dtype=float))
                ys.append(sup["target_logret"].to_numpy(dtype=float))
            if not Xs:
                continue
            key = f"{target}_h{h}"
            arrays[f"X_{key}"] = np.vstack(Xs)
            arrays[f"y_{key}"] = np.concatenate(ys)
            print(f"  {key:18} {arrays['X_' + key].shape[0]:>7,} synthetic rows")

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(args.out, **arrays)
    print(f"\nwrote {args.out} and reports/v2_synthetic_fidelity.csv")


if __name__ == "__main__":
    main()
