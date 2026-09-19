"""
Port Constraints & Vessel Compatibility Layer for SIH26006 Route-Aware Forecasting.
Represents physical berth/channel limits (draft, LOA, beam, cargo handling, lighterage).

RULE: Missing port parameters are represented as None/unknown.
They must NEVER be silently fabricated or assumed to be zero.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, List, Dict
from .vessel_mapping import VesselClassSpecs


class MissingPortConstraintError(Exception):
    """Raised when a query requires a port constraint that has not been sourced."""
    def __init__(self, port_id: str, constraint_name: str):
        self.port_id = port_id
        self.constraint_name = constraint_name
        super().__init__(
            f"Port constraint '{constraint_name}' for port '{port_id}' is unknown/null. "
            f"Fabrication of port depth/draft is strictly prohibited."
        )


@dataclass(frozen=True)
class PortConstraint:
    """
    Physical and operational limitations of a specific marine terminal or port.
    """
    port_id: str
    port_name: str
    country: str
    role: str  # 'load', 'discharge', 'both'
    max_draft_m: Optional[float] = None
    max_loa_m: Optional[float] = None
    max_beam_m: Optional[float] = None
    max_dwt: Optional[float] = None
    cargo_types: list[str] = field(default_factory=lambda: ["coking_coal", "thermal_coal", "iron_ore"])
    handling_rate_tpd: Optional[float] = None
    tidal_range_m: Optional[float] = None
    daylight_only: bool = False
    lighterage_required: bool = False
    source_url: Optional[str] = None
    retrieval_date: Optional[str] = None
    provenance: str = "official_port_authority_gazette"


@dataclass(frozen=True)
class CompatibilityResult:
    """
    Result of testing vessel physical suitability against port constraints.
    """
    feasible: bool
    vessel_class: str
    port_id: str
    reasons: list[str]
    max_intake_t: float
    draft_limited: bool
    requires_lighterage: bool
    missing_data_warnings: list[str]


# Verified Port Registry (aligned with East Coast India ports and major origin terminals)
PORT_REGISTRY: dict[str, PortConstraint] = {
    # ── East Coast of India Discharge Ports ─────────────────────────────────
    "INPRT": PortConstraint(
        port_id="INPRT",
        port_name="Paradip",
        country="IN",
        role="discharge",
        max_draft_m=18.70,
        max_loa_m=300.0,
        max_beam_m=48.0,
        max_dwt=200000.0,
        cargo_types=["coking_coal", "thermal_coal", "iron_ore"],
        handling_rate_tpd=25000.0,
        tidal_range_m=2.80,
        lighterage_required=False,
        source_url="https://paradipport.gov.in/",
        retrieval_date="2026-09-10",
        provenance="official_major_port_authority",
    ),
    "INVTZ": PortConstraint(
        port_id="INVTZ",
        port_name="Visakhapatnam",
        country="IN",
        role="discharge",
        max_draft_m=18.00,
        max_loa_m=290.0,
        max_beam_m=45.0,
        max_dwt=200000.0,
        cargo_types=["coking_coal", "thermal_coal", "iron_ore"],
        handling_rate_tpd=20000.0,
        tidal_range_m=1.60,
        lighterage_required=False,
        source_url="https://www.vizagport.com/",
        retrieval_date="2026-09-10",
        provenance="official_major_port_authority",
    ),
    "INGGV": PortConstraint(
        port_id="INGGV",
        port_name="Gangavaram",
        country="IN",
        role="discharge",
        max_draft_m=21.00,
        max_loa_m=320.0,
        max_beam_m=50.0,
        max_dwt=220000.0,
        cargo_types=["coking_coal", "thermal_coal", "iron_ore"],
        handling_rate_tpd=30000.0,
        tidal_range_m=1.60,
        lighterage_required=False,
        source_url="https://www.adaniports.com/Ports-and-Terminals/gangavaram-port",
        retrieval_date="2026-09-10",
        provenance="operator_official_tariff_schedule",
    ),
    "INDHA": PortConstraint(
        port_id="INDHA",
        port_name="Dhamra",
        country="IN",
        role="discharge",
        max_draft_m=18.50,
        max_loa_m=310.0,
        max_beam_m=48.0,
        max_dwt=200000.0,
        cargo_types=["coking_coal", "thermal_coal", "iron_ore"],
        handling_rate_tpd=25000.0,
        tidal_range_m=3.00,
        lighterage_required=False,
        source_url="https://www.adaniports.com/Ports-and-Terminals/dhamra-port",
        retrieval_date="2026-09-10",
        provenance="operator_official_tariff_schedule",
    ),
    "INHAL": PortConstraint(
        port_id="INHAL",
        port_name="Haldia",
        country="IN",
        role="discharge",
        max_draft_m=8.50,
        max_loa_m=230.0,
        max_beam_m=32.5,
        max_dwt=55000.0,
        cargo_types=["coking_coal", "thermal_coal"],
        handling_rate_tpd=12000.0,
        tidal_range_m=4.50,
        lighterage_required=True,
        source_url="https://www.smportkolkata.shipping.gov.in/",
        retrieval_date="2026-09-10",
        provenance="official_major_port_authority",
    ),
    "INGPR": PortConstraint(
        port_id="INGPR",
        port_name="Gopalpur",
        country="IN",
        role="discharge",
        max_draft_m=9.50,
        max_loa_m=225.0,
        max_beam_m=32.5,
        max_dwt=65000.0,
        cargo_types=["thermal_coal", "iron_ore"],
        handling_rate_tpd=15000.0,
        tidal_range_m=1.50,
        lighterage_required=False,
        source_url="https://www.adaniports.com/Ports-and-Terminals/gopalpur-port",
        retrieval_date="2026-09-10",
        provenance="operator_official_tariff_schedule",
    ),
    # ── Overseas Load Ports ───────────────────────────────────────────────
    "AUHPT": PortConstraint(
        port_id="AUHPT",
        port_name="Hay Point",
        country="AU",
        role="load",
        max_draft_m=19.40,
        max_loa_m=300.0,
        max_beam_m=50.0,
        max_dwt=210000.0,
        cargo_types=["coking_coal", "thermal_coal"],
        handling_rate_tpd=40000.0,
        tidal_range_m=3.40,
        source_url="https://nqbp.com.au/",
        retrieval_date="2026-09-10",
        provenance="operator_official_handbook",
    ),
    "AUGLT": PortConstraint(
        port_id="AUGLT",
        port_name="Gladstone",
        country="AU",
        role="load",
        max_draft_m=16.10,
        max_loa_m=290.0,
        max_beam_m=45.0,
        max_dwt=180000.0,
        cargo_types=["coking_coal", "thermal_coal"],
        handling_rate_tpd=30000.0,
        tidal_range_m=3.50,
        source_url="https://www.gpcl.com.au/",
        retrieval_date="2026-09-10",
        provenance="operator_official_handbook",
    ),
    "IDTBA": PortConstraint(
        port_id="IDTBA",
        port_name="Taboneo",
        country="ID",
        role="load",
        max_draft_m=16.00,
        max_loa_m=300.0,
        max_beam_m=48.0,
        max_dwt=180000.0,
        cargo_types=["thermal_coal"],
        handling_rate_tpd=20000.0,
        tidal_range_m=1.80,
        source_url="https://www.worldportsource.com/",
        retrieval_date="2026-09-10",
        provenance="maritime_reference_guide",
    ),
    "ZARBY": PortConstraint(
        port_id="ZARBY",
        port_name="Richards Bay",
        country="ZA",
        role="load",
        max_draft_m=17.50,
        max_loa_m=300.0,
        max_beam_m=47.0,
        max_dwt=180000.0,
        cargo_types=["thermal_coal", "coking_coal"],
        handling_rate_tpd=35000.0,
        tidal_range_m=1.80,
        source_url="https://www.transnetnationalportsauthority.net/",
        retrieval_date="2026-09-10",
        provenance="operator_official_handbook",
    ),
    "USHAM": PortConstraint(
        port_id="USHAM",
        port_name="Hampton Roads",
        country="US",
        role="load",
        max_draft_m=15.20,
        max_loa_m=280.0,
        max_beam_m=45.0,
        max_dwt=150000.0,
        cargo_types=["coking_coal"],
        handling_rate_tpd=30000.0,
        tidal_range_m=0.80,
        source_url="https://www.portofvirginia.com/",
        retrieval_date="2026-09-10",
        provenance="operator_official_handbook",
    ),
    "MZBEW": PortConstraint(
        port_id="MZBEW",
        port_name="Beira",
        country="MZ",
        role="load",
        max_draft_m=8.00,
        max_loa_m=190.0,
        max_beam_m=30.0,
        max_dwt=40000.0,
        cargo_types=["thermal_coal", "coking_coal"],
        handling_rate_tpd=10000.0,
        tidal_range_m=6.40,
        source_url="https://www.cornelder.co.mz/",
        retrieval_date="2026-09-10",
        provenance="operator_official_handbook",
    ),
    "RUVVO": PortConstraint(
        port_id="RUVVO",
        port_name="Vostochny",
        country="RU",
        role="load",
        max_draft_m=16.50,
        max_loa_m=290.0,
        max_beam_m=45.0,
        max_dwt=150000.0,
        cargo_types=["coking_coal", "thermal_coal"],
        handling_rate_tpd=25000.0,
        tidal_range_m=0.50,
        source_url="https://www.vostport.ru/",
        retrieval_date="2026-09-10",
        provenance="maritime_reference_guide",
    ),
}


def get_port_constraint(port_id: str) -> PortConstraint:
    """Retrieve verified constraints for a port. Raises ValueError if unknown."""
    if port_id not in PORT_REGISTRY:
        available = list(PORT_REGISTRY.keys())
        raise ValueError(
            f"Unknown port '{port_id}'. Verified port registry contains: {available}"
        )
    return PORT_REGISTRY[port_id]


def check_vessel_port_compatibility(
    vessel: VesselClassSpecs,
    port: PortConstraint,
    cargo_type: str
) -> CompatibilityResult:
    """
    Check if a vessel class can physically access and work at a given port.
    Evaluates:
      1. Cargo type handling capability
      2. Length overall (LOA) limits
      3. Beam limits
      4. Draft depth / part-load limitations (with Under Keel Clearance UKC=10%)
    """
    reasons = []
    warnings = []
    feasible = True
    draft_limited = False
    
    # 1. Cargo check
    if cargo_type not in port.cargo_types:
        feasible = False
        reasons.append(
            f"Port {port.port_id} does not handle cargo '{cargo_type}'. "
            f"Handled cargos: {port.cargo_types}"
        )

    # 2. LOA check
    if port.max_loa_m is not None:
        if vessel.ref_loa_m > port.max_loa_m:
            feasible = False
            reasons.append(
                f"Vessel LOA ({vessel.ref_loa_m}m) exceeds port {port.port_id} max LOA ({port.max_loa_m}m)"
            )
    else:
        warnings.append(f"Port {port.port_id} max_loa_m is unknown.")

    # 3. Beam check
    if port.max_beam_m is not None:
        if vessel.ref_beam_m > port.max_beam_m:
            feasible = False
            reasons.append(
                f"Vessel beam ({vessel.ref_beam_m}m) exceeds port {port.port_id} max beam ({port.max_beam_m}m)"
            )
    else:
        warnings.append(f"Port {port.port_id} max_beam_m is unknown.")

    # 4. Draft & Deadweight Intake calculation
    intake_t = vessel.ref_dwt - vessel.constants_t
    if port.max_draft_m is not None:
        # Standard 10% Under Keel Clearance (UKC) requirement
        available_draft = port.max_draft_m / 1.10
        if vessel.ref_draft_m > available_draft:
            draft_deficit_m = vessel.ref_draft_m - available_draft
            # Deadweight reduction = draft_deficit (cm) * TPC
            cargo_reduction_t = draft_deficit_m * 100.0 * vessel.tpc
            intake_t = max(0.0, intake_t - cargo_reduction_t)
            draft_limited = True
            
            # If draft restriction reduces intake by more than 50%, port is infeasible without lighterage
            if intake_t < (0.50 * vessel.ref_dwt):
                if not port.lighterage_required:
                    feasible = False
                    reasons.append(
                        f"Draft restriction at {port.port_id} ({port.max_draft_m}m) causes severe part-load "
                        f"(intake {intake_t:.0f}t < 50% DWT), lighterage station unavailable."
                    )
    else:
        warnings.append(f"Port {port.port_id} max_draft_m is unknown.")

    return CompatibilityResult(
        feasible=feasible,
        vessel_class=vessel.vessel_class,
        port_id=port.port_id,
        reasons=reasons,
        max_intake_t=round(intake_t, 1) if feasible else 0.0,
        draft_limited=draft_limited,
        requires_lighterage=port.lighterage_required,
        missing_data_warnings=warnings,
    )
