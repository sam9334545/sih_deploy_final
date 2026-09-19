from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import Cargo, CargoType, Horizon, PortRef, VesselClassName


class ForecastRequest(BaseModel):
    vessel_class: VesselClassName
    horizon_days: Horizon = 28
    route: PortRef | None = None
    as_of: date | None = None
    refresh: bool = False


class RecommendVesselRequest(BaseModel):
    cargo: Cargo
    origin_port: str
    destination_port: str
    required_by: date
    as_of: date | None = None

    @field_validator("origin_port", "destination_port")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.strip().upper()


class OptimizeCharterRequest(RecommendVesselRequest):
    contract_horizon_voyages: int | None = Field(default=None, ge=1, le=12)
    risk_aversion: float | None = Field(default=None, ge=0.0, le=1.0)
    deadline_miss_penalty_usd: float | None = Field(default=None, ge=0.0)
    n_simulations: int | None = Field(default=None, ge=100, le=5000)
    seed: int | None = None
    include_opportunity_score: bool = True
    include_milp_crosscheck: bool = False


class SimulateStrategyRequest(RecommendVesselRequest):
    strategies: list[str] = Field(default_factory=lambda: ["auto"])
    n_simulations: int = Field(default=1000, ge=100, le=5000)
    risk_aversion: float | None = Field(default=None, ge=0.0, le=1.0)
    deadline_miss_penalty_usd: float | None = Field(default=None, ge=0.0)
    seed: int | None = None


class OpportunityRequest(RecommendVesselRequest):
    vessel_class: VesselClassName | None = None
    risk_aversion: float | None = Field(default=None, ge=0.0, le=1.0)
    n_simulations: int = Field(default=300, ge=100, le=2000)


class CompatibilityQuery(BaseModel):
    port_id: str | None = None
    vessel_class: VesselClassName | None = None
    cargo_type: CargoType | None = None
    season: str | None = None
