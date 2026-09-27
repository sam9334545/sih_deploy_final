"""CLI: build the regime-anchored post-COVID panel and the combined series."""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import postcovid, synth
from forecast_v2.dataset import INDEX_COLS, load_real

REAL = "data/processed/real_baltic_multivariate.csv"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--until", default=str(date.today()))
    ap.add_argument("--scenarios", type=int, default=5)
    ap.add_argument("--out", default="data/processed/baltic_real_plus_postcovid.csv")
    args = ap.parse_args()

    real = load_real(REAL)
    cfg = postcovid.PostCovidConfig(n_scenarios=args.scenarios)
    panels = postcovid.generate(real, args.until, cfg)
    print(f"generated {len(panels)} scenarios × {len(panels[0]):,} sessions "
          f"({panels[0]['obs_date'].min().date()} → {panels[0]['obs_date'].max().date()})")

    Path("data/synthetic").mkdir(parents=True, exist_ok=True)
    pd.concat(panels).to_csv("data/synthetic/postcovid_scenarios.csv", index=False)
    postcovid.regime_table().to_csv("reports/v2_postcovid_regime_calendar.csv", index=False)

    # Scenario 0 is the canonical panel the application runs on.
    canon = panels[0]
    real_out = real.copy()
    real_out["provenance_tag"] = "verified_real_mendeley_cc_by_4.0"
    real_out["regime"] = "observed"
    real_out["scenario"] = -1
    combined = pd.concat([real_out, canon], ignore_index=True)
    combined.to_csv(args.out, index=False)

    print(f"\nwrote {args.out}: {len(real_out):,} real + {len(canon):,} synthetic rows")

    print("\npeak and trough of the canonical scenario, vs the real 2012–2019 record:")
    for c in INDEX_COLS:
        rmin, rmax = real[c].min(), real[c].max()
        smin, smax = canon[c].min(), canon[c].max()
        peak_at = canon.loc[canon[c].idxmax(), "obs_date"].date()
        trough_at = canon.loc[canon[c].idxmin(), "obs_date"].date()
        print(f"  {c:11} real {rmin:6.0f}–{rmax:6.0f} | synthetic {smin:6.0f} "
              f"({trough_at}) – {smax:6.0f} ({peak_at})")

    print("\nregime medians (canonical scenario):")
    med = canon.groupby("regime", sort=False)[INDEX_COLS].median().round(0)
    print(med.to_string())

    checks = postcovid.validate(panels, real)
    checks.to_csv("reports/v2_postcovid_validation.csv", index=False)
    worst = checks["anchor_tracking_corr"].min()
    peaks_in_window = checks[checks["index"] == "bci_value"]["peak_date"].apply(
        lambda d: pd.Timestamp("2021-06-01").date() <= d <= pd.Timestamp("2022-01-31").date())
    print(f"\ncalendar tracking: worst correlation {worst:.3f} across "
          f"{len(checks)} index-scenario pairs")
    print(f"Capesize peak inside the 2021 boom window: "
          f"{peaks_in_window.sum()}/{len(peaks_in_window)} scenarios")
    if worst < 0.95:
        print("WARNING: a scenario is not tracking its regime calendar")

    # The *dynamics* must still look like the real market even though the level
    # path is steered. Volatility is the exception: the regime calendar raises it
    # deliberately, because 2020-2023 genuinely was a more violent market than
    # 2012-2019, so a ratio above 1 here is the intent and not an error.
    fid = synth.fidelity_report(real, panels)
    fid.to_csv("reports/v2_postcovid_fidelity.csv")
    print("\ndynamics vs real 2012-2019:")
    for metric, note in (("ann_vol", "(>0 intended: post-COVID was more volatile)"),
                         ("ac1_return", "(should be ~0)"),
                         ("ac1_abs_return", "(should be ~0)")):
        vals = fid[metric]["rel_error_pct"]
        print(f"  {metric:16} " + "  ".join(f"{i.split('_')[0].upper()} {v:+6.1f}%"
                                            for i, v in vals.items()) + f"  {note}")


if __name__ == "__main__":
    main()
