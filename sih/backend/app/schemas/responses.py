from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel

from app.schemas.common import Interval, Provenance


# ───────────────────────── forecast ─────────────────────────

class ModelMeta(BaseModel):
    name: str
    version: str
    trained_on: date | None = None
    validation_mase: float | None = None
    interval_coverage_80: float | None = None
    method: str


class Driver(BaseModel):
    feature: str
    direction: str
    contribution_log: float


class UsdPerTonne(Interval):
    provenance: Provenance = "derived"
    model: str = "shadow_freight_v1"
    calibration_mape: float | None = None
    calibration_route: str | None = None
    cargo_t: float | None = None
    components_usd: dict[str, float] | None = None


class HistoryPoint(BaseModel):
    date: str
    value: float


class ForecastResponse(BaseModel):
    vessel_class: str
    index: str
    as_of: date
    horizon_days: int
    target_date: date
    index_forecast: Interval
    tc_avg_usd_day: Interval | None = None
    usd_per_tonne: UsdPerTonne | None = None
    confidence: float
    trend: str
    history: list[HistoryPoint]
    model_meta: ModelMeta
    drivers: list[Driver]
    provenance: dict[str, Provenance]
    assumptions: list[str]
    request_id: str


# ───────────────────────── vessel recommendation ─────────────────────────

class VesselOption(BaseModel):
    vessel_class: str
    voyages: int
    parcel_t: float
    last_parcel_t: float
    intake_ratio: float
    compatibility_score: float
    compatibility_factors: dict[str, float]
    estimated_days_per_voyage: float
    deadline_feasible: bool
    binding_constraint: str
    binding_port: str
    requires_lighterage: bool
    expected_cost_usd: float | None = None
    interval_80_usd: list[float] | None = None
    note: str | None = None


class Rejection(BaseModel):
    vessel_class: str
    reason: str
    detail: str
    port_id: str | None = None
    source: str | None = None


class RecommendVesselResponse(BaseModel):
    recommended: VesselOption | None
    alternatives: list[VesselOption]
    rejected: list[Rejection]
    constraints_as_of: date
    as_of: date
    assumptions: list[str]
    provenance: dict[str, Provenance]
    request_id: str


# ───────────────────────── optimisation ─────────────────────────

class CharterWindow(BaseModel):
    start: date
    end: date


class Recommendation(BaseModel):
    vessel_class: str
    voyages: int
    execution: str
    contract_structure: str
    charter_window: CharterWindow
    expected_cost_usd: float
    expected_cost_inr: float
    expected_usd_per_tonne: float
    fx_rate: float
    fx_date: date | None
    interval_80_usd: list[float]
    cvar_90_usd: float
    p_deadline_miss: float
    risk_adjusted_cost_usd: float
    risk: str
    charter_opportunity_score: float | None = None


class OptimizeResponse(BaseModel):
    recommendation: Recommendation
    cost_breakdown_usd: dict[str, float]
    idle: dict[str, float]
    alternatives: list[dict[str, Any]]
    infeasible: list[dict[str, Any]]
    explanation: list[str]
    opportunity: dict[str, Any] | None = None
    risk: dict[str, Any] | None = None
    milp_crosscheck: dict[str, Any] | None = None
    assumptions: list[str]
    provenance: dict[str, Provenance]
    as_of: date
    runtime_ms: int
    request_id: str


# ───────────────────────── simulation ─────────────────────────

class StrategyResult(BaseModel):
    id: str
    label: str
    vessel_class: str
    voyages: int
    structure: str
    execution: str
    total_days: float
    cost: dict[str, float]
    usd_per_tonne: float
    p_deadline_miss: float
    risk_adjusted_cost: float
    breakdown: dict[str, float]
    idle_days: float
    idle_cost_usd: float
    feasible: bool = True
    notes: list[str] = []


class SimulateResponse(BaseModel):
    results: list[StrategyResult]
    infeasible: list[dict[str, Any]]
    winner: str | None
    n_simulations: int
    seed: int
    runtime_ms: int
    distributions: dict[str, str]
    as_of: date
    assumptions: list[str]
    provenance: dict[str, Provenance]
    request_id: str


# ───────────────────────── reference ─────────────────────────

class BerthOut(BaseModel):
    berth_id: str
    name: str
    cargo_types: list[str]
    max_loa_m: float | None
    min_loa_m: float | None
    max_beam_m: float | None
    max_draft_m: float | None
    tide_allowance_m: float | None
    handling_rate_tpd: float | None
    mechanised: bool | None
    daylight_only: bool
    coupling_constraint: str | None
    status: str
    effective_from: date
    effective_to: date | None
    source_url: str
    verification: str


class PortSummary(BaseModel):
    port_id: str
    name: str
    country: str
    role: str | None
    lat: float | None
    lon: float | None
    authority: str | None
    authority_type: str | None
    berth_count: int
    max_draft_m: float | None
    verification: str


class CongestionOut(BaseModel):
    expected_wait_hours_p50: float
    p90: float
    strata: str
    sample_size: int
    as_of: date


class PortDetail(BaseModel):
    port_id: str
    name: str
    country: str
    role: str | None
    lat: float | None
    lon: float | None
    authority: str | None
    authority_type: str | None
    approach_channel_depth_m: float | None
    tidal_range_m: float | None
    seasonal_notes: str | None
    berths: list[BerthOut]
    congestion: CongestionOut
    weather: list[dict[str, Any]]
    vessel_compatibility: list[dict[str, Any]]
    source_url: str
    retrieved_at: date
    verification: str
    constraints_as_of: date
    request_id: str


class VesselClassOut(BaseModel):
    vessel_class: str
    index_code: str | None
    ref_dwt: float
    ref_draft_m: float
    ref_loa_m: float
    ref_beam_m: float
    tpc: float
    speed_laden_kn: float
    speed_ballast_kn: float
    cons_laden_mt_day: float
    cons_ballast_mt_day: float
    geared: bool
    dwt_range: list[float]
    constants_t: float
    demurrage_usd_day: float
    grt: float
    source_url: str
    retrieved_at: date


class MarketResponse(BaseModel):
    as_of: date
    indices: dict[str, Any]
    bunker: dict[str, Any]
    commodities: dict[str, Any]
    fx: dict[str, Any]
    availability_signal: dict[str, Any]
    charter_opportunity_score_generic: dict[str, Any]
    provenance: dict[str, Provenance]
    request_id: str


class RiskResponse(BaseModel):
    overall: str
    overall_raw: float
    components: list[dict[str, Any]]
    main_driver: str
    what_would_change: list[str]
    alerts: list[dict[str, Any]]
    weights_method: str
    as_of: date
    request_id: str


class SourceOut(BaseModel):
    source_id: int
    source_name: str
    organisation: str | None
    url: str | None
    licence: str | None
    access_method: str | None
    update_frequency: str | None
    availability_rating: str | None
    covers: str | None
    last_checked: date | None
    notes: str | None
