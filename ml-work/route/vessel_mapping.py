"""
Vessel-to-Index Mapping & Specifications for SIH26006 Route-Aware Forecasting.
Maps dry-bulk vessel segments to Baltic market indices:
  - Capesize  -> BCI
  - Panamax   -> BPI
  - Supramax  -> BSI
  - Handysize -> BHSI

Provides physical reference specifications and bidirectional lookup functions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Any, Optional


# Configurable vessel-to-Baltic index mapping
VESSEL_INDEX_MAP: dict[str, str] = {
    "Capesize": "BCI",
    "Panamax": "BPI",
    "Supramax": "BSI",
    "Handysize": "BHSI",
}

# Reverse mapping: index to primary vessel segment
INDEX_VESSEL_MAP: dict[str, str] = {
    "BCI": "Capesize",
    "BPI": "Panamax",
    "BSI": "Supramax",
    "BHSI": "Handysize",
}


@dataclass(frozen=True)
class VesselClassSpecs:
    """
    Reference specifications for a dry-bulk vessel size category.
    Sourced from standard Baltic Exchange vessel descriptions.
    """
    vessel_class: str
    index_code: str
    ref_dwt: float
    ref_draft_m: float
    ref_loa_m: float
    ref_beam_m: float
    tpc: float
    speed_laden_kn: float
    speed_ballast_kn: float
    cons_laden_mt_day: float
    cons_ballast_mt_day: float
    cons_port_mt_day: float
    geared: bool
    dwt_min: float
    dwt_max: float
    constants_t: float
    demurrage_usd_day: float
    grt: float
    source_url: str = "https://www.balticexchange.com/en/data-services/market-information0/dry-services.html"
    provenance: str = "baltic_standard_description"


# Standard reference specifications (sourced from verified Baltic benchmark definitions)
VESSEL_SPECS: dict[str, VesselClassSpecs] = {
    "Handysize": VesselClassSpecs(
        vessel_class="Handysize",
        index_code="BHSI",
        ref_dwt=38200.0,
        ref_draft_m=10.538,
        ref_loa_m=180.0,
        ref_beam_m=29.80,
        tpc=49.0,
        speed_laden_kn=14.0,
        speed_ballast_kn=14.0,
        cons_laden_mt_day=26.0,
        cons_ballast_mt_day=18.0,
        cons_port_mt_day=3.0,
        geared=True,
        dwt_min=20000.0,
        dwt_max=42000.0,
        constants_t=1800.0,
        demurrage_usd_day=9000.0,
        grt=24000.0,
    ),
    "Supramax": VesselClassSpecs(
        vessel_class="Supramax",
        index_code="BSI",
        ref_dwt=63000.0,
        ref_draft_m=13.35,
        ref_loa_m=199.0,
        ref_beam_m=32.26,
        tpc=58.0,
        speed_laden_kn=14.0,
        speed_ballast_kn=14.0,
        cons_laden_mt_day=29.0,
        cons_ballast_mt_day=25.0,
        cons_port_mt_day=4.0,
        geared=True,
        dwt_min=45000.0,
        dwt_max=65000.0,
        constants_t=2400.0,
        demurrage_usd_day=14000.0,
        grt=35000.0,
    ),
    "Panamax": VesselClassSpecs(
        vessel_class="Panamax",
        index_code="BPI",
        ref_dwt=82500.0,
        ref_draft_m=14.43,
        ref_loa_m=229.0,
        ref_beam_m=32.25,
        tpc=70.5,
        speed_laden_kn=13.5,
        speed_ballast_kn=14.0,
        cons_laden_mt_day=33.0,
        cons_ballast_mt_day=31.0,
        cons_port_mt_day=4.5,
        geared=False,
        dwt_min=65000.0,
        dwt_max=100000.0,
        constants_t=3000.0,
        demurrage_usd_day=18000.0,
        grt=44000.0,
    ),
    "Capesize": VesselClassSpecs(
        vessel_class="Capesize",
        index_code="BCI",
        ref_dwt=180000.0,
        ref_draft_m=18.20,
        ref_loa_m=290.0,
        ref_beam_m=45.00,
        tpc=125.0,
        speed_laden_kn=13.0,
        speed_ballast_kn=13.0,
        cons_laden_mt_day=52.0,
        cons_ballast_mt_day=45.0,
        cons_port_mt_day=5.0,
        geared=False,
        dwt_min=100000.0,
        dwt_max=210000.0,
        constants_t=6000.0,
        demurrage_usd_day=28000.0,
        grt=93000.0,
    ),
}


def get_index_for_vessel(vessel_class: str) -> str:
    """
    Retrieve the Baltic market index corresponding to a given vessel category.
    Raises ValueError if vessel_class is unrecognized.
    """
    if vessel_class not in VESSEL_INDEX_MAP:
        allowed = list(VESSEL_INDEX_MAP.keys())
        raise ValueError(
            f"Unknown vessel class: '{vessel_class}'. "
            f"Allowed dry-bulk categories are: {allowed}"
        )
    return VESSEL_INDEX_MAP[vessel_class]


def get_vessel_for_index(index_code: str) -> str:
    """
    Retrieve the primary vessel category for a given Baltic index code.
    Raises ValueError if index_code is unrecognized.
    """
    if index_code not in INDEX_VESSEL_MAP:
        allowed = list(INDEX_VESSEL_MAP.keys())
        raise ValueError(
            f"Unknown index code: '{index_code}'. "
            f"Allowed Baltic dry-bulk sub-indices are: {allowed}"
        )
    return INDEX_VESSEL_MAP[index_code]


def get_vessel_specs(vessel_class: str) -> VesselClassSpecs:
    """
    Get full reference specifications for a vessel category.
    Raises ValueError if vessel_class is unrecognized.
    """
    if vessel_class not in VESSEL_SPECS:
        allowed = list(VESSEL_SPECS.keys())
        raise ValueError(
            f"Unknown vessel class: '{vessel_class}'. "
            f"Allowed dry-bulk categories are: {allowed}"
        )
    return VESSEL_SPECS[vessel_class]
