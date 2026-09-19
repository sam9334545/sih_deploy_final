"""Generate deterministic DEMO time series for the freight / macro / congestion layer.

These are *simulated* series with realistic statistical properties (mean-reverting
log-levels, fat-ish tails, annual seasonality). They exist so the whole system is
runnable end-to-end without any external credential. Everything written here is
tagged provenance='simulated_demo' when loaded, and the API reports it as such.

Replace by running the real ingestion jobs (ingestion/ package) which write the
same tables with provenance='measured'.
"""
from __future__ import annotations

import csv
import math
import os
from datetime import date, timedelta

import numpy as np

OUT = os.path.join(os.path.dirname(__file__), "..", "data", "reference", "demo")
START = date(2019, 1, 1)
END = date(2026, 9, 15)
SEED = 26006

INDEX_SPEC = {
    # code: (long-run level, mean-reversion speed, daily vol, seasonal amplitude)
    "BDI": (1750, 0.010, 0.021, 0.16),
    "BCI": (2400, 0.011, 0.031, 0.20),
    "BPI": (1650, 0.010, 0.020, 0.15),
    "BSI": (1400, 0.009, 0.017, 0.14),
    "BHSI": (850, 0.009, 0.015, 0.12),
}
# Baltic-published TC average $/day is roughly a linear map of the index per class.
TC_MAP = {"BCI": (8.29, 0.0), "BPI": (9.0, 0.0), "BSI": (11.0, 0.0), "BHSI": (17.5, 0.0), "BDI": (0.0, 0.0)}

COMMODITY_SPEC = {
    # series_code: (level, mr speed, vol, unit, publication lag days)
    "COAL_AU_NEWC": (135.0, 0.008, 0.024, "USD/t", 1),
    "COAL_ZA_RB": (110.0, 0.008, 0.023, "USD/t", 1),
    "COAL_COKING_AU_PHCC": (245.0, 0.009, 0.029, "USD/t", 1),
    "IRON_ORE_CFR62": (108.0, 0.010, 0.022, "USD/t", 1),
    "BRENT": (79.0, 0.009, 0.020, "USD/bbl", 0),
    "BUNKER_VLSFO_SG": (560.0, 0.009, 0.019, "USD/mt", 0),
    "USD_INR": (83.0, 0.004, 0.0035, "INR/USD", 0),
    "INDIA_IIP": (145.0, 0.02, 0.010, "index", 42),
}


def ou_series(rng, n, level, kappa, vol, seasonal_amp=0.0, start_offset=0.0):
    """Discrete Ornstein–Uhlenbeck on log-level + annual Fourier seasonality."""
    log_mu = math.log(level)
    x = log_mu + start_offset
    out = np.empty(n)
    for i in range(n):
        seas = seasonal_amp * math.sin(2 * math.pi * (i / 365.25) - 0.9) * 0.5
        x += kappa * (log_mu - x) + vol * rng.standard_normal()
        out[i] = math.exp(x + seas)
    return out


def daterange(start, end):
    d = start
    while d <= end:
        yield d
        d += timedelta(days=1)


def main():
    os.makedirs(OUT, exist_ok=True)
    rng = np.random.default_rng(SEED)
    days = [d for d in daterange(START, END)]
    n = len(days)

    # ---- freight indices: common market factor + class idiosyncratic ----
    common = ou_series(rng, n, 1.0, 0.01, 0.012)
    common = common / common.mean()
    with open(os.path.join(OUT, "freight_index.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["obs_date", "index_code", "value", "tc_avg_usd_day", "source_url"])
        for code, (lvl, kappa, vol, amp) in INDEX_SPEC.items():
            s = ou_series(rng, n, lvl, kappa, vol, amp) * common
            a, b = TC_MAP[code]
            for d, v in zip(days, s):
                if d.weekday() >= 5:  # Baltic publishes on business days
                    continue
                tc = round(a * v + b, 2) if a else ""
                w.writerow([d.isoformat(), code, round(float(v), 2), tc,
                            "https://www.balticexchange.com/ (simulated demo series)"])

    # ---- commodities / macro ----
    with open(os.path.join(OUT, "commodity_price.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["obs_date", "series_code", "value", "unit", "available_from", "source_url"])
        for code, (lvl, kappa, vol, unit, lag) in COMMODITY_SPEC.items():
            s = ou_series(rng, n, lvl, kappa, vol)
            monthly = code == "INDIA_IIP"
            for d, v in zip(days, s):
                if monthly and d.day != 1:
                    continue
                if not monthly and d.weekday() >= 5:
                    continue
                w.writerow([d.isoformat(), code, round(float(v), 4), unit,
                            (d + timedelta(days=lag)).isoformat(),
                            "https://www.worldbank.org/en/research/commodity-markets (simulated demo series)"])

    # ---- port calls: the empirical waiting-time pool the simulator bootstraps from ----
    ports = {
        "INPRT": (26, 1.15), "INVTZ": (34, 1.25), "INGGV": (18, 0.95),
        "INGPR": (30, 1.30), "INDHA": (20, 1.00), "INHAL": (52, 1.45), "INSGD": (44, 1.40),
        "AUHPT": (38, 1.20), "AUGLT": (30, 1.10), "IDTBA": (48, 1.35),
        "ZARBY": (56, 1.50), "USHAM": (28, 1.10), "MZBEW": (46, 1.35), "RUVVO": (32, 1.15),
    }
    size_factor = {"Handysize": 0.80, "Supramax": 1.00, "Panamax": 1.25, "Capesize": 1.55}
    bob_month = {1: 0.85, 2: 0.80, 3: 0.85, 4: 0.95, 5: 1.10, 6: 1.35, 7: 1.45,
                 8: 1.40, 9: 1.20, 10: 1.15, 11: 1.05, 12: 0.95}
    cargoes = ["thermal_coal", "coking_coal", "iron_ore"]
    with open(os.path.join(OUT, "port_call.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["port_id", "report_date", "vessel_class", "cargo_type", "cargo_tonnes",
                    "waiting_hours", "cargo_hours", "delay_reason_code", "source_url"])
        # two years of daily calls is plenty for a stratified bootstrap
        for d in daterange(date(2024, 9, 15), END):
            for pid, (median_wait, disp) in ports.items():
                for _ in range(int(rng.integers(1, 4))):
                    vc = str(rng.choice(list(size_factor), p=[0.25, 0.35, 0.28, 0.12]))
                    seas = bob_month[d.month] if pid.startswith("IN") else 1.0
                    mu = math.log(median_wait * size_factor[vc] * seas)
                    wait = float(rng.lognormal(mu, disp * 0.55))
                    wait = min(wait, 480.0)
                    cargo = str(rng.choice(cargoes, p=[0.5, 0.35, 0.15]))
                    tonnes = int({"Handysize": 34000, "Supramax": 57000,
                                  "Panamax": 74000, "Capesize": 160000}[vc] * rng.uniform(0.7, 1.0))
                    reason = str(rng.choice(list("ABCDEFGH"),
                                            p=[0.30, 0.22, 0.14, 0.10, 0.09, 0.07, 0.05, 0.03]))
                    w.writerow([pid, d.isoformat(), vc, cargo, tonnes, round(wait, 2),
                                round(tonnes / (rng.uniform(0.7, 1.3) * 20000) * 24, 2), reason,
                                "port daily traffic report (simulated demo series)"])
    print("demo series written to", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
