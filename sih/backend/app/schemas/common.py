from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

VesselClassName = Literal["Handysize", "Supramax", "Panamax", "Capesize"]
CargoType = Literal["thermal_coal", "coking_coal", "iron_ore"]
Horizon = Literal[7, 14, 28, 60, 90, 180]
Provenance = Literal["measured", "derived", "estimated", "simulated_demo", "expert_set"]


class ErrorEnvelope(BaseModel):
    """Blueprint §29.3 — one shape for every failure."""
    error: str = Field(examples=["invalid_input"])
    message: str
    field: str | None = None
    request_id: str
    hint: str | None = None
    allowed: list[Any] | None = None
    as_of: date | None = None


class Interval(BaseModel):
    point: float
    interval_80: list[float]


class Cargo(BaseModel):
    type: CargoType
    quantity_t: float = Field(gt=0, le=2_000_000)


class ProvenanceNote(BaseModel):
    field: str
    provenance: Provenance
    source_url: str | None = None
    retrieved_at: date | None = None
    note: str | None = None


class Meta(BaseModel):
    as_of: date
    request_id: str
    provenance: dict[str, Provenance] = {}
    assumptions: list[str] = []
    demo_mode: bool = False


class PortRef(BaseModel):
    origin_port: str
    destination_port: str

    @field_validator("origin_port", "destination_port")
    @classmethod
    def upper(cls, v: str) -> str:
        return v.strip().upper()
