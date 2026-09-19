"""Fit the shadow freight model's one free parameter against a checkable route.

Method (blueprint §17.4):
  1. Apply the identical formula to a route whose $/tonne IS publicly quoted.
  2. Fit `margin` to minimise reconstruction error against that published series.
  3. Report the MAPE. That error is the honesty metric: we never quote an
     unchecked route with a band narrower than the error we make where we can
     be checked.

IMPORTANT: with no licensed feed in the repo, this runs against
data/reference/demo/published_route.csv, which is a *stand-in*. Replace that
file with the real quoted series before quoting the resulting MAPE anywhere.
"""
from __future__ import annotations

import csv
import os
import sys
from datetime import date

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db import SessionLocal                                   # noqa: E402
from app.repositories import reference as ref_repo                # noqa: E402
from app.repositories import series as series_repo                # noqa: E402
from app.services import forecast_service, shadow_freight         # noqa: E402
from app.services.cost_model import port_charges                  # noqa: E402

REFERENCE_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "reference", "demo",
                              "published_route.csv")


def reconstruct(db, margin: float, on: date, vessel_class="Capesize",
                origin="AUHPT", destination="INPRT") -> float:
    vc = ref_repo.get_vessel_class(db, vessel_class)
    route = ref_repo.get_route(db, origin, destination)
    _, bunker = series_repo.latest_value(db, "BUNKER_VLSFO_SG", on)
    tce = forecast_service.tc_from_index(
        db, vc.index_code, series_repo.latest_index(db, vc.index_code, on).value, on)
    lc = port_charges(ref_repo.tariffs(db, origin, on), vc.grt)
    dc = port_charges(ref_repo.tariffs(db, destination, on), vc.grt)
    cargo = vc.ref_dwt - vc.constants_t
    return shadow_freight.estimate(vc, tce, route.distance_nm, cargo, bunker or 550.0,
                                   lc, dc, 3.0, 4.0, 0.3, route.backhaul_index,
                                   margin=margin).usd_per_tonne


def main() -> None:
    if not os.path.exists(REFERENCE_FILE):
        print(f"No reference series at {REFERENCE_FILE}.\n"
              "Add a CSV of obs_date,usd_per_tonne for a publicly quoted voyage route, "
              "then re-run. Until then LANE_MARGIN and CALIBRATION_MAPE stay at their "
              "documented defaults.")
        return

    rows = [(date.fromisoformat(r["obs_date"]), float(r["usd_per_tonne"]))
            for r in csv.DictReader(open(REFERENCE_FILE))]
    db = SessionLocal()
    try:
        best, best_err = None, 1e9
        for margin in np.arange(0.0, 0.41, 0.005):
            errs = [abs(reconstruct(db, float(margin), d) - actual) / actual
                    for d, actual in rows]
            mape = float(np.mean(errs))
            if mape < best_err:
                best, best_err = float(margin), mape
        print(f"fitted margin = {best:.3f}   reconstruction MAPE = {best_err:.3%}   "
              f"n = {len(rows)} observations")
        print("Copy these into app/services/shadow_freight.py "
              "(LANE_MARGIN / CALIBRATION_MAPE) and record the run in docs/verification_log.md.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
