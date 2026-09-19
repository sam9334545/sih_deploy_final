"""Voyage cost model — pure functions, no I/O, heavily unit-tested.

Everything here is deterministic physics plus published tariffs. All the
uncertainty lives in the simulator, which calls these functions with sampled
freight, bunker, waiting and weather inputs.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.config import settings
from app.models import PortTariff, VesselClass


@dataclass(slots=True)
class PortChargeSet:
    port_dues: float = 0.0
    pilotage: float = 0.0
    berth_hire_per_hour: float = 0.0
    wharfage_per_tonne: float = 0.0
    anchorage_per_hour: float = 0.0
    lighterage_per_tonne: float = 0.0
    provenance: str = "measured"


def port_charges(tariffs: list[PortTariff], grt: float) -> PortChargeSet:
    """Collapse a Scale of Rates into the handful of numbers a voyage needs."""
    out = PortChargeSet()
    estimated = False
    for t in tariffs:
        rate = t.rate_foreign_usd or 0.0
        if t.verification == "estimated":
            estimated = True
        if t.basis == "per_grt" and t.slab_min is not None:
            if grt < (t.slab_min or 0) or (t.slab_max and grt > t.slab_max):
                continue
        if t.charge_type == "port_dues":
            out.port_dues += max(rate * grt, t.min_charge_usd or 0.0)
        elif t.charge_type == "pilotage":
            out.pilotage += max(rate * grt, t.min_charge_usd or 0.0)
        elif t.charge_type == "berth_hire":
            out.berth_hire_per_hour += rate * grt
        elif t.charge_type == "wharfage":
            out.wharfage_per_tonne += rate
        elif t.charge_type == "anchorage":
            out.anchorage_per_hour += rate * grt
        elif t.charge_type == "lighterage":
            out.lighterage_per_tonne += rate
    out.provenance = "estimated" if estimated else "measured"
    return out


@dataclass(slots=True)
class VoyageTiming:
    ballast_days: float
    laden_days: float
    load_wait_days: float
    load_cargo_days: float
    disch_wait_days: float
    disch_cargo_days: float
    weather_days: float
    lighterage_days: float = 0.0

    @property
    def sea_days(self) -> float:
        return self.ballast_days + self.laden_days

    @property
    def port_days(self) -> float:
        return (self.load_wait_days + self.load_cargo_days
                + self.disch_wait_days + self.disch_cargo_days + self.lighterage_days)

    @property
    def total_days(self) -> float:
        return self.sea_days + self.port_days + self.weather_days

    @property
    def idle_days(self) -> float:
        """Blueprint §26.2 — waiting is idle time, cargo work is not."""
        return self.load_wait_days + self.disch_wait_days + self.weather_days


def sea_days(distance_nm: float, speed_kn: float) -> float:
    return distance_nm / (speed_kn * 24.0)


def cargo_days(tonnes: float, handling_rate_tpd: float | None) -> float:
    if not handling_rate_tpd:
        return 0.0
    return tonnes / handling_rate_tpd


def voyage_timing(
    vc: VesselClass, distance_nm: float, tonnes: float,
    load_rate_tpd: float | None, disch_rate_tpd: float | None,
    load_wait_hours: float, disch_wait_hours: float,
    weather_stop_fraction: float, ballast_distance_nm: float | None = None,
    lighterage_tonnes: float = 0.0,
) -> VoyageTiming:
    laden = sea_days(distance_nm, vc.speed_laden_kn)
    ballast = sea_days(ballast_distance_nm if ballast_distance_nm is not None else distance_nm,
                       vc.speed_ballast_kn)
    lc = cargo_days(tonnes, load_rate_tpd)
    dc = cargo_days(tonnes - lighterage_tonnes, disch_rate_tpd)
    light = 0.0
    if lighterage_tonnes > 0:
        light = (lighterage_tonnes / settings.sandheads_lighterage_rate_tpd
                 + settings.sandheads_transit_days)
    working = laden + ballast + lc + dc + light
    weather = working * weather_stop_fraction
    return VoyageTiming(ballast, laden, load_wait_hours / 24.0, lc,
                        disch_wait_hours / 24.0, dc, weather, light)


@dataclass(slots=True)
class CostBreakdown:
    freight: float = 0.0
    bunker: float = 0.0
    port_costs: float = 0.0
    waiting: float = 0.0
    expected_demurrage: float = 0.0
    lighterage: float = 0.0
    repositioning: float = 0.0

    @property
    def total(self) -> float:
        return (self.freight + self.bunker + self.port_costs + self.waiting
                + self.expected_demurrage + self.lighterage + self.repositioning)

    def as_dict(self) -> dict[str, float]:
        d = {k: round(getattr(self, k), 2) for k in
             ("freight", "bunker", "port_costs", "waiting", "expected_demurrage",
              "lighterage", "repositioning")}
        d["total"] = round(self.total, 2)
        return d

    def __add__(self, other: "CostBreakdown") -> "CostBreakdown":
        return CostBreakdown(*[getattr(self, k) + getattr(other, k) for k in
                               ("freight", "bunker", "port_costs", "waiting",
                                "expected_demurrage", "lighterage", "repositioning")])


def voyage_cost(
    vc: VesselClass, timing: VoyageTiming, tonnes: float,
    freight_usd_per_tonne: float, bunker_usd_per_mt: float,
    load_charges: PortChargeSet, disch_charges: PortChargeSet,
    laytime_days: float, lighterage_tonnes: float = 0.0,
    ballast_priced_in_freight: bool = True,
) -> CostBreakdown:
    """One voyage, one ship. Freight is a voyage-charter $/t; hire is not double-counted."""
    c = CostBreakdown()
    c.freight = freight_usd_per_tonne * tonnes

    # On a voyage charter the owner buys the fuel and it sits inside the $/t rate.
    # We still surface it when the user asks for a time-charter view.
    if not ballast_priced_in_freight:
        c.bunker = (timing.laden_days * vc.cons_laden_mt_day
                    + timing.ballast_days * vc.cons_ballast_mt_day) * bunker_usd_per_mt

    port_hours = (timing.load_cargo_days + timing.disch_cargo_days) * 24.0
    c.port_costs = (
        load_charges.port_dues + load_charges.pilotage
        + disch_charges.port_dues + disch_charges.pilotage
        + (load_charges.berth_hire_per_hour + disch_charges.berth_hire_per_hour) * port_hours / 2.0
        + disch_charges.wharfage_per_tonne * tonnes
    )

    wait_days = timing.load_wait_days + timing.disch_wait_days
    # Waiting inside laytime is the charterer's time but not yet a demurrage claim;
    # beyond laytime it is demurrage at the class rate.
    billable = max(0.0, wait_days - laytime_days)
    c.waiting = (wait_days - billable) * vc.demurrage_usd_day * 0.35
    c.expected_demurrage = billable * vc.demurrage_usd_day

    if lighterage_tonnes > 0:
        c.lighterage = (lighterage_tonnes * disch_charges.lighterage_per_tonne
                        + timing.lighterage_days * vc.demurrage_usd_day * 0.6
                        + disch_charges.anchorage_per_hour * timing.lighterage_days * 24.0)
    return c


def repositioning_cost(vc: VesselClass, ballast_nm: float, bunker_usd_per_mt: float,
                       backhaul_index: float, port_dues_usd: float = 0.0) -> float:
    """Ballast leg the owner prices into the rate — scaled by how good the backhaul is.

    backhaul_index 1.0 = always a paying cargo home, so no ballast premium;
    0.0 = always sails home empty, and the charterer pays for all of it.
    """
    days = sea_days(ballast_nm, vc.speed_ballast_kn)
    fuel = days * vc.cons_ballast_mt_day * bunker_usd_per_mt
    return (fuel + port_dues_usd) * (1.0 - backhaul_index)


def laytime_days_for(tonnes: float, handling_rate_tpd: float | None,
                     allowance: float = 1.15) -> float:
    """Customary laytime: the published rate plus a modest allowance, both stated."""
    if not handling_rate_tpd:
        return 3.0
    return tonnes / handling_rate_tpd * allowance


def to_inr(usd: float, fx: float | None = None) -> float:
    return round(usd * (fx or settings.fx_usd_inr), 2)
