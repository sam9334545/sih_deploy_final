from __future__ import annotations

from datetime import date

VESSEL_CLASSES = ["Handysize", "Supramax", "Panamax", "Capesize"]
CARGO_TYPES = ["thermal_coal", "coking_coal", "iron_ore"]
INDEX_CODES = ["BDI", "BCI", "BPI", "BSI", "BHSI"]
CLASS_INDEX = {"Handysize": "BHSI", "Supramax": "BSI", "Panamax": "BPI", "Capesize": "BCI"}
HORIZONS = [7, 14, 28, 60, 90, 180]
SEASONS = ["pre_monsoon", "monsoon", "post_monsoon", "winter"]

# Bay-of-Bengal operating calendar (blueprint §20.3).
_SEASON_BY_MONTH = {
    1: "winter", 2: "winter", 3: "pre_monsoon", 4: "pre_monsoon", 5: "pre_monsoon",
    6: "monsoon", 7: "monsoon", 8: "monsoon", 9: "monsoon",
    10: "post_monsoon", 11: "post_monsoon", 12: "winter",
}
# Exposure multiplier applied to weather_stop_fraction when scoring reliability.
SEASON_EXPOSURE = {"winter": 0.8, "pre_monsoon": 0.9, "monsoon": 1.3, "post_monsoon": 1.2}

LIGHTERAGE_PORTS = {"INHAL": "INSGD"}

# Static per-lane route risk flags (blueprint §27.1 "Route" component).
SANCTIONS_EXPOSED_ORIGINS = {"RUVVO"}
CHOKEPOINT_RISK = {"Malacca": 0.3, "Suez": 0.6, "Torres Strait": 0.2,
                   "Cape of Good Hope approaches": 0.3}


def season_of(d: date) -> str:
    return _SEASON_BY_MONTH[d.month]


def season_of_month(month: int) -> str:
    return _SEASON_BY_MONTH[month]


def months_of_season(season: str) -> list[int]:
    return [m for m, s in _SEASON_BY_MONTH.items() if s == season]
