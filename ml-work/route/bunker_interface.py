"""
Bunker Fuel Price Interface for SIH26006 Route-Aware Forecasting.
Provides abstract and concrete providers for Marine Fuel (VLSFO / LSMGO) pricing.

RULE: Missing bunker data does NOT silently default to zero or arbitrary constants.
Unverified test values are strictly labelled with provenance='TEST_ONLY'.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, Dict


class MissingBunkerDataError(Exception):
    """Raised when legitimate bunker fuel price data is unavailable."""
    def __init__(self, location: str, query_date: str | date, fuel_type: str):
        self.location = location
        self.query_date = str(query_date)
        self.fuel_type = fuel_type
        super().__init__(
            f"Missing verified bunker price for location='{location}', "
            f"date='{self.query_date}', fuel_type='{fuel_type}'. "
            f"Values must not silently default to 0.0 without provenance."
        )


@dataclass(frozen=True)
class BunkerPriceRecord:
    """
    Structured bunker fuel price observation or quote.
    """
    obs_date: str
    location: str
    fuel_type: str
    price_usd_per_mt: float
    currency: str = "USD"
    unit: str = "metric_tonne"
    source_url: Optional[str] = None
    retrieval_date: Optional[str] = None
    provenance: str = "official_market_quote"


class BunkerDataProvider(ABC):
    """
    Abstract interface for retrieving bunker fuel prices by bunkering port and date.
    """
    @abstractmethod
    def get_bunker_price(
        self,
        location: str,
        query_date: str | date,
        fuel_type: str = "VLSFO"
    ) -> BunkerPriceRecord:
        """
        Retrieve bunker price. Must raise MissingBunkerDataError if no data is found.
        """
        pass


class DemoBunkerDataProvider(BunkerDataProvider):
    """
    Test fixture provider containing explicitly labelled test/demo prices.
    MUST NEVER be presented as historical market observations in production.
    """
    def __init__(self, test_prices: Optional[dict[tuple[str, str], float]] = None):
        # Default test fixture dictionary: (location, fuel_type) -> price_usd_per_mt
        self._prices = test_prices or {
            ("Singapore", "VLSFO"): 550.0,
            ("Singapore", "LSMGO"): 720.0,
            ("Fujairah", "VLSFO"): 545.0,
            ("Rotterdam", "VLSFO"): 530.0,
            ("Visakhapatnam", "VLSFO"): 580.0,
            ("Paradip", "VLSFO"): 585.0,
        }

    def get_bunker_price(
        self,
        location: str,
        query_date: str | date,
        fuel_type: str = "VLSFO"
    ) -> BunkerPriceRecord:
        key = (location, fuel_type)
        if key not in self._prices:
            raise MissingBunkerDataError(location, query_date, fuel_type)
        
        return BunkerPriceRecord(
            obs_date=str(query_date),
            location=location,
            fuel_type=fuel_type,
            price_usd_per_mt=self._prices[key],
            currency="USD",
            unit="metric_tonne",
            source_url="internal://test_fixture",
            retrieval_date="2026-09-19",
            provenance="TEST_ONLY",
        )
