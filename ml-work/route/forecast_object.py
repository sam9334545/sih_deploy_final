"""
Clean Probabilistic Market Forecast Contract for SIH26006.
Standardized data contract consumed by the route-aware translation layer and API.

Enforces:
  - Horizon validity (trading sessions in 7, 14, 28, 60, 90, 180)
  - Monotonic quantile hierarchy (P10 <= P50 <= P90)
  - Calibrated interval validity (P10_cal <= P50 <= P90_cal)
  - Explicit data provenance and cutoff dating
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
from .vessel_mapping import VESSEL_INDEX_MAP, INDEX_VESSEL_MAP

VALID_HORIZONS = (7, 14, 28, 60, 90, 180)


@dataclass(frozen=True)
class MarketForecast:
    """
    Standardized market-level freight index forecast object.
    Represents vessel-segment market conditions, NOT country-specific freight prices.
    """
    target: str
    vessel_type: str
    origin_date: str
    target_date: str
    horizon_sessions: int
    p10_raw: float
    p50_raw: float
    p90_raw: float
    p10_calibrated: float
    p50: float
    p90_calibrated: float
    raw_width: float
    calibrated_width: float
    model_version: str = "phase5_quantile_lgbm_conformal_v1"
    data_version: str = "mendeley_verified_2012_2019"
    data_cutoff: str = "2019-07-31"
    provenance: str = "quantile_lgbm_with_split_conformal_calibration"

    def __post_init__(self):
        # 1. Horizon validation
        if self.horizon_sessions not in VALID_HORIZONS:
            raise ValueError(
                f"Invalid horizon_sessions {self.horizon_sessions}. "
                f"Must be one of discrete trading sessions: {list(VALID_HORIZONS)}"
            )

        # 2. Vessel-to-Index consistency
        expected_index = VESSEL_INDEX_MAP.get(self.vessel_type)
        if expected_index and expected_index != self.target:
            raise ValueError(
                f"Vessel type '{self.vessel_type}' maps to index '{expected_index}', "
                f"not '{self.target}'."
            )

        # 3. Raw quantile hierarchy check
        if not (self.p10_raw <= self.p50_raw <= self.p90_raw):
            raise ValueError(
                f"Raw quantiles violate ordering P10 <= P50 <= P90: "
                f"P10={self.p10_raw}, P50={self.p50_raw}, P90={self.p90_raw}"
            )

        # 4. Calibrated interval hierarchy check
        if not (self.p10_calibrated <= self.p50 <= self.p90_calibrated):
            raise ValueError(
                f"Calibrated interval violates ordering P10_cal <= P50 <= P90_cal: "
                f"P10_cal={self.p10_calibrated}, P50={self.p50}, P90_cal={self.p90_calibrated}"
            )

    def to_dict(self) -> dict[str, Any]:
        """Serialize forecast object to dictionary."""
        return asdict(self)
