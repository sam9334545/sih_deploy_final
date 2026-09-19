"""SQLAlchemy models — a direct translation of the schema in blueprint §31.

Portable across SQLite (dev/demo) and PostgreSQL (docker-compose): array-valued
columns are stored as pipe-delimited TEXT and exposed through helper properties,
and the one generated column in the original DDL is computed on write instead.
"""
from __future__ import annotations

from datetime import UTC, date, datetime

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _split(v: str | None) -> list[str]:
    return [x for x in (v or "").split("|") if x]


# ═══════════════════════════ DIMENSIONS ═══════════════════════════

class Port(Base):
    __tablename__ = "dim_port"

    port_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    port_name: Mapped[str] = mapped_column(Text, nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)
    role: Mapped[str | None] = mapped_column(String(16))
    lat: Mapped[float | None] = mapped_column(Float)
    lon: Mapped[float | None] = mapped_column(Float)
    authority: Mapped[str | None] = mapped_column(Text)
    authority_type: Mapped[str | None] = mapped_column(Text)
    approach_channel_depth_m: Mapped[float | None] = mapped_column(Float)
    tidal_range_m: Mapped[float | None] = mapped_column(Float)
    seasonal_notes: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    licence: Mapped[str | None] = mapped_column(Text)
    verification: Mapped[str] = mapped_column(Text, nullable=False, default="unverified")

    __table_args__ = (CheckConstraint("role in ('load','discharge','both')", name="ck_port_role"),)

    berths: Mapped[list["Berth"]] = relationship(back_populates="port", lazy="selectin")


class Berth(Base):
    __tablename__ = "dim_berth"

    berth_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    port_id: Mapped[str] = mapped_column(ForeignKey("dim_port.port_id"), nullable=False)
    berth_name: Mapped[str] = mapped_column(Text, nullable=False)
    cargo_types_raw: Mapped[str] = mapped_column("cargo_types", Text, nullable=False)
    max_loa_m: Mapped[float | None] = mapped_column(Float)
    min_loa_m: Mapped[float | None] = mapped_column(Float)
    max_beam_m: Mapped[float | None] = mapped_column(Float)
    max_draft_m: Mapped[float | None] = mapped_column(Float)
    tide_allowance_m: Mapped[float] = mapped_column(Float, default=0.0)
    max_dwt: Mapped[float | None] = mapped_column(Float)
    berth_length_m: Mapped[float | None] = mapped_column(Float)
    handling_rate_tpd: Mapped[float | None] = mapped_column(Float)
    mechanised: Mapped[bool | None] = mapped_column(Boolean)
    daylight_only: Mapped[bool] = mapped_column(Boolean, default=False)
    coupling_constraint: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="operational")
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    verification: Mapped[str] = mapped_column(Text, nullable=False, default="unverified")

    port: Mapped[Port] = relationship(back_populates="berths")

    __table_args__ = (Index("ix_berth_port_effective", "port_id", "effective_from", "effective_to"),)

    @property
    def cargo_types(self) -> list[str]:
        return _split(self.cargo_types_raw)

    def is_effective(self, on: date) -> bool:
        return self.effective_from <= on and (self.effective_to is None or on <= self.effective_to)


class VesselClass(Base):
    __tablename__ = "dim_vessel_class"

    vessel_class: Mapped[str] = mapped_column(String(16), primary_key=True)
    index_code: Mapped[str | None] = mapped_column(String(8))
    ref_dwt: Mapped[float] = mapped_column(Float)
    ref_draft_m: Mapped[float] = mapped_column(Float)
    ref_loa_m: Mapped[float] = mapped_column(Float)
    ref_beam_m: Mapped[float] = mapped_column(Float)
    tpc: Mapped[float] = mapped_column(Float)
    speed_laden_kn: Mapped[float] = mapped_column(Float)
    speed_ballast_kn: Mapped[float] = mapped_column(Float)
    cons_laden_mt_day: Mapped[float] = mapped_column(Float)
    cons_ballast_mt_day: Mapped[float] = mapped_column(Float)
    geared: Mapped[bool] = mapped_column(Boolean, default=False)
    dwt_min: Mapped[float | None] = mapped_column(Float)
    dwt_max: Mapped[float | None] = mapped_column(Float)
    constants_t: Mapped[float] = mapped_column(Float, default=0.0)
    demurrage_usd_day: Mapped[float] = mapped_column(Float, default=0.0)
    grt: Mapped[float] = mapped_column(Float, default=0.0)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class Route(Base):
    __tablename__ = "dim_route"

    route_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    origin_port: Mapped[str] = mapped_column(ForeignKey("dim_port.port_id"))
    destination_port: Mapped[str] = mapped_column(ForeignKey("dim_port.port_id"))
    distance_nm: Mapped[float] = mapped_column(Float)
    via_passages_raw: Mapped[str | None] = mapped_column("via_passages", Text)
    backhaul_index: Mapped[float] = mapped_column(Float, default=0.3)
    baltic_reference_route: Mapped[str | None] = mapped_column(Text)
    computed_by: Mapped[str | None] = mapped_column(Text)
    caveat: Mapped[str | None] = mapped_column(Text)

    @property
    def via_passages(self) -> list[str]:
        return _split(self.via_passages_raw)


class PortTariff(Base):
    __tablename__ = "dim_port_tariff"

    tariff_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    port_id: Mapped[str] = mapped_column(ForeignKey("dim_port.port_id"))
    charge_type: Mapped[str] = mapped_column(Text, nullable=False)
    basis: Mapped[str] = mapped_column(Text, nullable=False)
    slab_min: Mapped[float | None] = mapped_column(Float)
    slab_max: Mapped[float | None] = mapped_column(Float)
    rate_foreign_usd: Mapped[float | None] = mapped_column(Float)
    rate_coastal_inr: Mapped[float | None] = mapped_column(Float)
    min_charge_usd: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date | None] = mapped_column(Date)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    verification: Mapped[str] = mapped_column(Text, nullable=False)


# ═══════════════════════════ FACTS ═══════════════════════════

class FreightIndex(Base):
    __tablename__ = "fact_freight_index"

    obs_date: Mapped[date] = mapped_column(Date, primary_key=True)
    index_code: Mapped[str] = mapped_column(String(8), primary_key=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    tc_avg_usd_day: Mapped[float | None] = mapped_column(Float)
    provenance: Mapped[str] = mapped_column(Text, default="simulated_demo")
    source_url: Mapped[str | None] = mapped_column(Text)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime)


class CommodityPrice(Base):
    __tablename__ = "fact_commodity_price"

    obs_date: Mapped[date] = mapped_column(Date, primary_key=True)
    series_code: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str | None] = mapped_column(Text)
    available_from: Mapped[date] = mapped_column(Date, nullable=False)
    provenance: Mapped[str] = mapped_column(Text, default="simulated_demo")
    source_url: Mapped[str | None] = mapped_column(Text)


class PortCall(Base):
    __tablename__ = "fact_port_call"

    call_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    port_id: Mapped[str] = mapped_column(ForeignKey("dim_port.port_id"))
    report_date: Mapped[date] = mapped_column(Date, nullable=False)
    vessel_name: Mapped[str | None] = mapped_column(Text)
    vessel_class: Mapped[str | None] = mapped_column(String(16))
    cargo_type: Mapped[str | None] = mapped_column(Text)
    cargo_tonnes: Mapped[float | None] = mapped_column(Float)
    berth_name: Mapped[str | None] = mapped_column(Text)
    vessel_draft_m: Mapped[float | None] = mapped_column(Float)
    vessel_loa_m: Mapped[float | None] = mapped_column(Float)
    vessel_beam_m: Mapped[float | None] = mapped_column(Float)
    waiting_hours: Mapped[float | None] = mapped_column(Float)
    cargo_hours: Mapped[float | None] = mapped_column(Float)
    delay_reason_code: Mapped[str | None] = mapped_column(String(1))
    provenance: Mapped[str] = mapped_column(Text, default="simulated_demo")
    source_url: Mapped[str | None] = mapped_column(Text)
    verification: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("ix_portcall_port_date", "port_id", "report_date"),)


class WeatherClimatology(Base):
    __tablename__ = "fact_weather_climatology"

    port_id: Mapped[str] = mapped_column(ForeignKey("dim_port.port_id"), primary_key=True)
    month: Mapped[int] = mapped_column(Integer, primary_key=True)
    mean_wave_height_m: Mapped[float | None] = mapped_column(Float)
    p90_wave_height_m: Mapped[float | None] = mapped_column(Float)
    mean_wind_kn: Mapped[float | None] = mapped_column(Float)
    weather_stop_fraction: Mapped[float] = mapped_column(Float, default=0.0)
    cyclone_freq_per_decade: Mapped[float | None] = mapped_column(Float)
    source_url: Mapped[str | None] = mapped_column(Text)


# ═══════════════════════════ DERIVED / MODEL ═══════════════════════════

class Compatibility(Base):
    __tablename__ = "derived_compatibility"

    port_id: Mapped[str] = mapped_column(String(16), primary_key=True)
    berth_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    vessel_class: Mapped[str] = mapped_column(String(16), primary_key=True)
    cargo_type: Mapped[str] = mapped_column(String(32), primary_key=True)
    season: Mapped[str] = mapped_column(String(16), primary_key=True)
    feasible: Mapped[bool] = mapped_column(Boolean, nullable=False)
    infeasible_reason: Mapped[str | None] = mapped_column(Text)
    infeasible_detail: Mapped[str | None] = mapped_column(Text)
    max_intake_t: Mapped[float] = mapped_column(Float, default=0.0)
    intake_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    handling_rate_tpd: Mapped[float | None] = mapped_column(Float)
    est_cargo_days: Mapped[float | None] = mapped_column(Float)
    est_wait_hours_p50: Mapped[float | None] = mapped_column(Float)
    est_wait_hours_p90: Mapped[float | None] = mapped_column(Float)
    est_turnaround_days: Mapped[float | None] = mapped_column(Float)
    weather_stop_frac: Mapped[float | None] = mapped_column(Float)
    requires_lighterage: Mapped[bool] = mapped_column(Boolean, default=False)
    compat_score: Mapped[float | None] = mapped_column(Float)
    u_cargo: Mapped[float | None] = mapped_column(Float)
    u_time: Mapped[float | None] = mapped_column(Float)
    u_cost: Mapped[float | None] = mapped_column(Float)
    u_reliability: Mapped[float | None] = mapped_column(Float)
    computed_at: Mapped[datetime | None] = mapped_column(DateTime)


class ModelForecast(Base):
    __tablename__ = "model_forecast"

    forecast_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    as_of: Mapped[date] = mapped_column(Date, nullable=False)
    index_code: Mapped[str] = mapped_column(String(8), nullable=False)
    horizon_days: Mapped[int] = mapped_column(Integer, nullable=False)
    point: Mapped[float] = mapped_column(Float)
    lo_80: Mapped[float] = mapped_column(Float)
    hi_80: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)
    trend: Mapped[str | None] = mapped_column(Text)
    model_name: Mapped[str | None] = mapped_column(Text)
    model_version: Mapped[str | None] = mapped_column(Text)
    validation_mase: Mapped[float | None] = mapped_column(Float)
    interval_coverage_80: Mapped[float | None] = mapped_column(Float)
    trained_on: Mapped[date | None] = mapped_column(Date)
    drivers_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))

    __table_args__ = (
        UniqueConstraint("as_of", "index_code", "horizon_days", "model_version",
                         name="uq_forecast"),
    )


class DataSource(Base):
    __tablename__ = "data_source_registry"

    source_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_name: Mapped[str] = mapped_column(Text)
    organisation: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(Text)
    licence: Mapped[str | None] = mapped_column(Text)
    access_method: Mapped[str | None] = mapped_column(Text)
    update_frequency: Mapped[str | None] = mapped_column(Text)
    availability_rating: Mapped[str | None] = mapped_column(String(1))
    covers: Mapped[str | None] = mapped_column(Text)
    last_checked: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
