"""Shadow Freight Model — blueprint §17.4.

Baltic publishes class TC averages ($/day) and standard vessel descriptions; it
does not publish a $/tonne for our lanes. So we rebuild the $/t the way the
market itself builds it — owner's required daily earnings plus voyage costs,
spread over the cargo the *port constraints* actually let us lift — and we
calibrate the single free parameter (margin) against a route whose $/t is
publicly quoted, then carry that reconstruction error into every band we quote.

Everything this produces is badged provenance='derived'.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.models import VesselClass
from app.services.cost_model import PortChargeSet, sea_days

MODEL_NAME = "shadow_freight_v1"

# Per-lane margin, fitted by reconstructing a publicly quoted voyage route
# (Capesize Australia–China iron ore, the C5 analogue) and carrying the residual.
# Documented in docs/assumptions.md; refit by scripts/calibrate_shadow_freight.py.
DEFAULT_MARGIN = 0.11
LANE_MARGIN: dict[str, float] = {
    "AU->IN": 0.10,
    "ID->IN": 0.13,
    "ZA->IN": 0.11,
    "US->IN": 0.09,
    "MZ->IN": 0.15,
    "RU->IN": 0.14,
}
# MAPE of the reconstruction on the checkable route. This is our honesty metric:
# we never quote a band narrower than the error we make where we can be checked.
CALIBRATION_MAPE = 0.085
CALIBRATION_ROUTE = "Capesize Australia–China iron ore (publicly quoted voyage route)"


@dataclass(slots=True)
class ShadowRate:
    usd_per_tonne: float
    lo_80: float
    hi_80: float
    margin: float
    cargo_t: float
    days: float
    components_usd: dict[str, float]
    provenance: str = "derived"
    model: str = MODEL_NAME
    calibration_mape: float = CALIBRATION_MAPE
    calibration_route: str = CALIBRATION_ROUTE


def lane_key(origin_country: str, destination_country: str) -> str:
    return f"{origin_country}->{destination_country}"


def estimate(
    vc: VesselClass,
    tce_usd_day: float,
    distance_nm: float,
    cargo_t: float,
    bunker_usd_per_mt: float,
    load_charges: PortChargeSet,
    disch_charges: PortChargeSet,
    load_days: float,
    disch_days: float,
    weather_days: float,
    backhaul_index: float,
    margin: float | None = None,
    extra_band: float = 0.0,
) -> ShadowRate:
    laden = sea_days(distance_nm, vc.speed_laden_kn)
    ballast = sea_days(distance_nm, vc.speed_ballast_kn) * (1.0 - backhaul_index)
    days = laden + ballast + load_days + disch_days + weather_days

    hire = tce_usd_day * days
    bunker = (laden * vc.cons_laden_mt_day + ballast * vc.cons_ballast_mt_day) * bunker_usd_per_mt
    port = (load_charges.port_dues + load_charges.pilotage
            + disch_charges.port_dues + disch_charges.pilotage
            + disch_charges.wharfage_per_tonne * cargo_t
            + (load_charges.berth_hire_per_hour * load_days
               + disch_charges.berth_hire_per_hour * disch_days) * 24.0)
    ballast_cost = ballast * vc.cons_ballast_mt_day * bunker_usd_per_mt * 0.0  # inside `bunker`

    m = DEFAULT_MARGIN if margin is None else margin
    total = (hire + bunker + port + ballast_cost) * (1.0 + m)
    rate = total / cargo_t if cargo_t > 0 else 0.0

    band = (CALIBRATION_MAPE ** 2 + extra_band ** 2) ** 0.5
    return ShadowRate(
        usd_per_tonne=round(rate, 3),
        lo_80=round(rate * (1 - band), 3),
        hi_80=round(rate * (1 + band), 3),
        margin=m,
        cargo_t=round(cargo_t),
        days=round(days, 2),
        components_usd={
            "hire": round(hire, 2), "bunker": round(bunker, 2), "port": round(port, 2),
            "margin": round(total - hire - bunker - port, 2), "total": round(total, 2),
        },
    )
