"""
Voyage Economics & Shadow Freight Model for SIH26006 Route-Aware Forecasting.
Translates daily Time Charter Equivalent (TCE $/day) and route/vessel specs
into transparent $/voyage and $/tonne charter estimates.

STRICT UNIT CONVENTIONS:
  - Distance: nautical miles (nm)
  - Speeds: knots (kn)
  - Durations: days
  - Consumption rates: metric tonnes per day (mt/day)
  - Fuel prices: USD per metric tonne ($/mt)
  - Daily hire: USD per day ($/day)
  - Port dues: USD per voyage ($/voyage)
  - Cargo payload: metric tonnes (t)
  - Freight rates: USD per metric tonne ($/tonne)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Optional
from .vessel_mapping import VesselClassSpecs
from .route_config import RouteContext


@dataclass(frozen=True)
class VoyageEconomicsResult:
    """
    Detailed cost and duration breakdown for a single voyage on a specified route.
    Badged with provenance='derived'.
    """
    route_id: str
    vessel_class: str
    cargo_tonnes: float
    distance_nm: float
    sea_days_laden: float
    sea_days_ballast: float
    port_days: float
    weather_delay_days: float
    total_voyage_days: float
    bunker_consumption_mt: float
    bunker_price_usd_per_mt: float
    bunker_cost_usd: float
    tce_usd_day: float
    hire_cost_usd: float
    port_charges_usd: float
    canal_costs_usd: float
    commercial_margin: float
    total_voyage_cost_usd: float
    freight_usd_per_tonne: float
    provenance: str = "derived_voyage_economics"


def calculate_sea_days(distance_nm: float, speed_kn: float) -> float:
    """Compute days at sea given distance in nm and speed in knots."""
    if speed_kn <= 0:
        raise ValueError(f"Vessel speed must be positive (got {speed_kn} kn).")
    return round(distance_nm / (speed_kn * 24.0), 3)


def calculate_voyage_economics(
    vessel: VesselClassSpecs,
    route: RouteContext,
    cargo_tonnes: float,
    tce_usd_day: float,
    bunker_usd_per_mt: float,
    load_rate_tpd: float = 25000.0,
    disch_rate_tpd: float = 20000.0,
    port_charges_usd: float = 65000.0,
    canal_costs_usd: float = 0.0,
    weather_stop_fraction: float = 0.03,
    waiting_days: float = 1.5,
    commercial_margin: float = 0.10,
) -> VoyageEconomicsResult:
    """
    Calculate comprehensive voyage economics and $/tonne freight rate.
    
    Formula:
      1. Days breakdown:
         - sea_days_laden = distance_nm / (speed_laden * 24)
         - sea_days_ballast = distance_nm / (speed_ballast * 24) * (1 - backhaul_index)
         - cargo_working_days = cargo_t / load_rate + cargo_t / disch_rate
         - weather_delay_days = cargo_working_days * weather_stop_fraction
         - port_days = cargo_working_days + weather_delay_days + waiting_days
         - total_voyage_days = sea_days_laden + sea_days_ballast + port_days
      2. Costs breakdown:
         - hire_cost = tce_usd_day * total_voyage_days
         - bunker_consumption = (laden_days * cons_laden + ballast_days * cons_ballast + port_days * cons_port)
         - bunker_cost = bunker_consumption * bunker_usd_per_mt
         - subtotal = hire_cost + bunker_cost + port_charges_usd + canal_costs_usd
         - total_voyage_cost = subtotal * (1 + commercial_margin)
         - freight_usd_per_tonne = total_voyage_cost / cargo_tonnes
    """
    if cargo_tonnes <= 0:
        raise ValueError(f"Cargo payload must be positive (got {cargo_tonnes} t).")
    if tce_usd_day < 0:
        raise ValueError(f"TCE rate must be non-negative (got ${tce_usd_day}/day).")
    if bunker_usd_per_mt <= 0:
        raise ValueError(f"Bunker fuel price must be positive (got ${bunker_usd_per_mt}/mt).")

    # 1. Sea Days
    laden_days = calculate_sea_days(route.distance_nm, vessel.speed_laden_kn)
    effective_ballast_fraction = max(0.0, 1.0 - route.backhaul_index)
    ballast_days = round(
        calculate_sea_days(route.distance_nm, vessel.speed_ballast_kn) * effective_ballast_fraction,
        3
    )

    # 2. Port and Working Days
    load_days = cargo_tonnes / max(1000.0, load_rate_tpd)
    disch_days = cargo_tonnes / max(1000.0, disch_rate_tpd)
    working_days = load_days + disch_days
    weather_days = round(working_days * weather_stop_fraction, 3)
    port_days = round(working_days + weather_days + waiting_days, 3)

    # 3. Total Voyage Days
    total_days = round(laden_days + ballast_days + port_days, 3)

    # 4. Bunker Consumption & Costs
    bunker_mt = round(
        (laden_days * vessel.cons_laden_mt_day) +
        (ballast_days * vessel.cons_ballast_mt_day) +
        (port_days * vessel.cons_port_mt_day),
        2
    )
    bunker_cost = round(bunker_mt * bunker_usd_per_mt, 2)

    # 5. Vessel Time Charter Hire Cost
    hire_cost = round(tce_usd_day * total_days, 2)

    # 6. Total Voyage Cost & Unit Freight Rate
    subtotal = hire_cost + bunker_cost + port_charges_usd + canal_costs_usd
    total_cost = round(subtotal * (1.0 + commercial_margin), 2)
    rate_usd_t = round(total_cost / cargo_tonnes, 3)

    return VoyageEconomicsResult(
        route_id=route.route_id,
        vessel_class=vessel.vessel_class,
        cargo_tonnes=round(cargo_tonnes, 1),
        distance_nm=route.distance_nm,
        sea_days_laden=laden_days,
        sea_days_ballast=ballast_days,
        port_days=port_days,
        weather_delay_days=weather_days,
        total_voyage_days=total_days,
        bunker_consumption_mt=bunker_mt,
        bunker_price_usd_per_mt=bunker_usd_per_mt,
        bunker_cost_usd=bunker_cost,
        tce_usd_day=tce_usd_day,
        hire_cost_usd=hire_cost,
        port_charges_usd=port_charges_usd,
        canal_costs_usd=canal_costs_usd,
        commercial_margin=commercial_margin,
        total_voyage_cost_usd=total_cost,
        freight_usd_per_tonne=rate_usd_t,
    )
