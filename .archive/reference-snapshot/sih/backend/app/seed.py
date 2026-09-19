"""Load the committed reference CSVs and the demo series into the database.

Idempotent: it drops and rebuilds every table, so `python -m app.seed` always
gives the same database. That matters on demo day.
"""
from __future__ import annotations

import csv
import os
from datetime import UTC, date, datetime

from sqlalchemy import select

from app.db import Base, SessionLocal, engine
from app.models import (
    Berth, CommodityPrice, Compatibility, DataSource, FreightIndex, ModelForecast, Port,
    PortCall, PortTariff, Route, VesselClass, WeatherClimatology,
)

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.abspath(os.path.join(HERE, "..", "..", "data", "reference"))


def _rows(name: str, sub: str = ""):
    path = os.path.join(DATA, sub, name) if sub else os.path.join(DATA, name)
    with open(path, newline="") as f:
        yield from csv.DictReader(f)


def _f(v):
    return float(v) if v not in (None, "", "None") else None


def _b(v):
    return str(v).strip().lower() in ("true", "1", "yes")


def _d(v):
    return date.fromisoformat(v) if v else None


def _dt(v):
    return datetime.fromisoformat(v) if "T" in (v or "") else datetime.combine(
        date.fromisoformat(v), datetime.min.time())


def load_reference(db) -> dict[str, int]:
    counts = {}

    db.add_all([Port(
        port_id=r["port_id"], port_name=r["port_name"], country=r["country"], role=r["role"],
        lat=_f(r["lat"]), lon=_f(r["lon"]), authority=r["authority"],
        authority_type=r["authority_type"],
        approach_channel_depth_m=_f(r["approach_channel_depth_m"]),
        tidal_range_m=_f(r["tidal_range_m"]), seasonal_notes=r["seasonal_notes"] or None,
        source_url=r["source_url"], retrieved_at=_dt(r["retrieved_at"]),
        licence=r["licence"], verification=r["verification"],
    ) for r in _rows("ports.csv")])
    db.flush()
    counts["ports"] = db.query(Port).count()

    db.add_all([Berth(
        berth_id=r["berth_id"], port_id=r["port_id"], berth_name=r["berth_name"],
        cargo_types_raw=r["cargo_types"], max_loa_m=_f(r["max_loa_m"]),
        min_loa_m=_f(r["min_loa_m"]), max_beam_m=_f(r["max_beam_m"]),
        max_draft_m=_f(r["max_draft_m"]), tide_allowance_m=_f(r["tide_allowance_m"]) or 0.0,
        max_dwt=_f(r["max_dwt"]), berth_length_m=_f(r["berth_length_m"]),
        handling_rate_tpd=_f(r["handling_rate_tpd"]), mechanised=_b(r["mechanised"]),
        daylight_only=_b(r["daylight_only"]), coupling_constraint=r["coupling_constraint"] or None,
        status=r["status"], effective_from=_d(r["effective_from"]),
        effective_to=_d(r["effective_to"]), source_url=r["source_url"],
        retrieved_at=_dt(r["retrieved_at"]), verification=r["verification"],
    ) for r in _rows("berths.csv")])
    db.flush()
    counts["berths"] = db.query(Berth).count()

    db.add_all([VesselClass(
        vessel_class=r["vessel_class"], index_code=r["index_code"], ref_dwt=_f(r["ref_dwt"]),
        ref_draft_m=_f(r["ref_draft_m"]), ref_loa_m=_f(r["ref_loa_m"]),
        ref_beam_m=_f(r["ref_beam_m"]), tpc=_f(r["tpc"]),
        speed_laden_kn=_f(r["speed_laden_kn"]), speed_ballast_kn=_f(r["speed_ballast_kn"]),
        cons_laden_mt_day=_f(r["cons_laden_mt_day"]),
        cons_ballast_mt_day=_f(r["cons_ballast_mt_day"]), geared=_b(r["geared"]),
        dwt_min=_f(r["dwt_min"]), dwt_max=_f(r["dwt_max"]), constants_t=_f(r["constants_t"]),
        demurrage_usd_day=_f(r["demurrage_usd_day"]), grt=_f(r["grt"]),
        source_url=r["source_url"], retrieved_at=_dt(r["retrieved_at"]),
    ) for r in _rows("vessel_classes.csv")])

    db.add_all([Route(
        route_id=r["route_id"], origin_port=r["origin_port"],
        destination_port=r["destination_port"], distance_nm=_f(r["distance_nm"]),
        via_passages_raw=r["via_passages"] or None, backhaul_index=_f(r["backhaul_index"]),
        baltic_reference_route=r["baltic_reference_route"] or None,
        computed_by=r["computed_by"], caveat=r["caveat"],
    ) for r in _rows("routes.csv")])

    db.add_all([PortTariff(
        port_id=r["port_id"], charge_type=r["charge_type"], basis=r["basis"],
        slab_min=_f(r["slab_min"]), slab_max=_f(r["slab_max"]),
        rate_foreign_usd=_f(r["rate_foreign_usd"]), rate_coastal_inr=_f(r["rate_coastal_inr"]),
        min_charge_usd=_f(r["min_charge_usd"]), notes=r["notes"] or None,
        effective_from=_d(r["effective_from"]), effective_to=_d(r["effective_to"]),
        source_url=r["source_url"], verification=r["verification"],
    ) for r in _rows("port_tariffs.csv")])

    db.add_all([WeatherClimatology(
        port_id=r["port_id"], month=int(r["month"]),
        mean_wave_height_m=_f(r["mean_wave_height_m"]),
        p90_wave_height_m=_f(r["p90_wave_height_m"]), mean_wind_kn=_f(r["mean_wind_kn"]),
        weather_stop_fraction=_f(r["weather_stop_fraction"]),
        cyclone_freq_per_decade=_f(r["cyclone_freq_per_decade"]), source_url=r["source_url"],
    ) for r in _rows("weather_climatology.csv")])

    db.commit()
    counts["routes"] = db.query(Route).count()
    counts["tariffs"] = db.query(PortTariff).count()
    return counts


def load_series(db) -> dict[str, int]:
    db.bulk_save_objects([FreightIndex(
        obs_date=_d(r["obs_date"]), index_code=r["index_code"], value=_f(r["value"]),
        tc_avg_usd_day=_f(r["tc_avg_usd_day"]), provenance="simulated_demo",
        source_url=r["source_url"], retrieved_at=datetime.now(UTC),
    ) for r in _rows("freight_index.csv", "demo")])

    db.bulk_save_objects([CommodityPrice(
        obs_date=_d(r["obs_date"]), series_code=r["series_code"], value=_f(r["value"]),
        unit=r["unit"], available_from=_d(r["available_from"]), provenance="simulated_demo",
        source_url=r["source_url"],
    ) for r in _rows("commodity_price.csv", "demo")])

    db.bulk_save_objects([PortCall(
        port_id=r["port_id"], report_date=_d(r["report_date"]), vessel_class=r["vessel_class"],
        cargo_type=r["cargo_type"], cargo_tonnes=_f(r["cargo_tonnes"]),
        waiting_hours=_f(r["waiting_hours"]), cargo_hours=_f(r["cargo_hours"]),
        delay_reason_code=r["delay_reason_code"], provenance="simulated_demo",
        source_url=r["source_url"], verification="simulated",
    ) for r in _rows("port_call.csv", "demo")])

    db.commit()
    return {"freight_index": db.query(FreightIndex).count(),
            "commodity_price": db.query(CommodityPrice).count(),
            "port_calls": db.query(PortCall).count()}


SOURCES = [
    ("Baltic Exchange dry indices", "Baltic Exchange", "https://www.balticexchange.com/",
     "Subscription for full history; daily headline values widely reported", "manual/reported",
     "daily", "Y", "BDI, BCI, BPI, BSI, BHSI and class TC averages",
     "Standard vessel descriptions used for class physical parameters are public"),
    ("Paradip Port daily traffic report", "Paradip Port Authority",
     "https://paradipport.gov.in/", "Government open data", "PDF download", "daily", "G",
     "Vessel calls, waiting and turnaround, berth-wise, with real vessel particulars",
     "Best-in-class congestion source on the East Coast; also yields a real vessel sample"),
    ("Paradip Scale of Rates", "Paradip Port Authority", "https://paradipport.gov.in/",
     "Government open data", "PDF download", "annual", "G", "Port dues, pilotage, berth hire, wharfage", ""),
    ("Visakhapatnam berth facilities and allowable drafts", "Visakhapatnam Port Authority",
     "https://www.vizagport.com/", "Government open data", "PDF download", "as revised", "G",
     "Inner/outer harbour berth constraints", ""),
    ("SMPK trade notices (Haldia / Sandheads)", "Syama Prasad Mookerjee Port Kolkata",
     "https://www.smportkolkata.shipping.gov.in/", "Government open data", "web/PDF",
     "frequent", "Y", "Permissible drafts including fog-season and night-tide restrictions",
     "Changes often — the constraint_watch job hashes these weekly"),
    ("Adani port pages (Gangavaram, Dhamra, Gopalpur)", "Adani Ports & SEZ",
     "https://www.adaniports.com/", "Operator website, terms apply", "web", "irregular", "Y",
     "Berth counts, drafts, cargo types", "Limited tariff disclosure; tariffs marked estimated"),
    ("Open-Meteo Marine & Historical Weather API", "Open-Meteo", "https://open-meteo.com/",
     "CC-BY 4.0", "REST API, no key", "hourly", "G",
     "Wave height, wind, derived weather-stoppage climatology", "No credential needed"),
    ("World Bank Commodity Markets (Pink Sheet)", "World Bank",
     "https://www.worldbank.org/en/research/commodity-markets", "CC-BY 4.0", "XLSX download",
     "monthly", "G", "Coal, iron ore, crude benchmark prices", ""),
    ("RBI reference rates", "Reserve Bank of India", "https://www.rbi.org.in/",
     "Government open data", "download", "daily", "G", "USD/INR", ""),
    ("data.gov.in country-wise coal imports", "Government of India", "https://data.gov.in/",
     "Government Open Data Licence – India", "REST API / CSV", "annual", "G",
     "Lane shares by origin country", ""),
    ("IPA monthly port performance", "Indian Ports Association", "https://ipa.nic.in/",
     "Government open data", "PDF download", "monthly", "Y",
     "Port-level commodity tonnage, turnaround, pre-berthing detention", ""),
    ("AIS vessel positions", "—", "—", "Commercial", "—", "—", "R",
     "Live vessel positions and open tonnage",
     "No free source with usable coverage and licensing was found. The system is designed "
     "not to need it: congestion comes from published port records instead."),
]


def load_sources(db) -> int:
    db.add_all([DataSource(
        source_name=s[0], organisation=s[1], url=s[2], licence=s[3], access_method=s[4],
        update_frequency=s[5], availability_rating=s[6], covers=s[7],
        last_checked=date(2026, 9, 10), notes=s[8] or None,
    ) for s in SOURCES])
    db.commit()
    return db.query(DataSource).count()


def main(rebuild_compat: bool = True) -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    db = SessionLocal()
    try:
        print("reference:", load_reference(db))
        print("series:   ", load_series(db))
        print("sources:  ", load_sources(db))
        if rebuild_compat:
            from app.services.compatibility_service import rebuild
            n = rebuild(db, date(2026, 9, 15))
            print(f"compatibility: {n} rows")
    finally:
        db.close()


if __name__ == "__main__":
    main()
