from __future__ import annotations

from datetime import date
from functools import lru_cache
from pathlib import Path

# backend-work/app/config.py -> backend-work -> repository root
_REPO_ROOT = Path(__file__).resolve().parent.parent.parent

from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_default_db_url() -> str:
    if Path("./charter.db").exists():
        return "sqlite:///./charter.db"
    backend_db = Path(__file__).resolve().parent.parent / "charter.db"
    if backend_db.exists():
        return f"sqlite:///{backend_db.as_posix()}"
    return "sqlite:///./charter.db"


def _find_default_v2_root() -> str:
    import os
    env_val = os.environ.get("FORECAST_V2_ROOT")
    if env_val and Path(env_val).exists():
        return env_val
    cand1 = _REPO_ROOT / "ml-work"
    if (cand1 / "forecast_v2").exists():
        return str(cand1)
    cand2 = Path("/app/ml-work")
    if (cand2 / "forecast_v2").exists():
        return str(cand2)
    cand3 = Path("./ml-work").resolve()
    if (cand3 / "forecast_v2").exists():
        return str(cand3)
    cand4 = Path(__file__).resolve().parent.parent.parent / "ml-work"
    if (cand4 / "forecast_v2").exists():
        return str(cand4)
    return str(_REPO_ROOT / "ml-work")


def _find_default_v2_artifacts() -> str:
    import os
    env_val = os.environ.get("FORECAST_V2_ARTIFACTS")
    if env_val and Path(env_val).exists():
        return env_val
    cand1 = _REPO_ROOT / "ml-work" / "models" / "saved_models" / "v2"
    if cand1.exists():
        return str(cand1)
    cand2 = Path("/app/ml-work/models/saved_models/v2")
    if cand2.exists():
        return str(cand2)
    cand3 = Path("./ml-work/models/saved_models/v2").resolve()
    if cand3.exists():
        return str(cand3)
    cand4 = Path(__file__).resolve().parent.parent.parent / "ml-work" / "models" / "saved_models" / "v2"
    if cand4.exists():
        return str(cand4)
    return str(_REPO_ROOT / "ml-work" / "models" / "saved_models" / "v2")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    database_url: str = Field(default_factory=_find_default_db_url)
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    demo_mode: bool = True
    demo_as_of: date = date(2026, 9, 15)
    stale_data_days: int = 7

    # Judgement parameters — every one of these is surfaced in API responses
    # as an assumption, and documented in docs/assumptions.md.
    default_risk_aversion: float = 0.5
    default_deadline_miss_penalty_usd: float = 500_000.0
    ukc_fraction: float = 0.10          # under-keel clearance as a fraction of static draft
    ukc_min_m: float = 0.5
    contract_discount: float = 0.05     # multi-voyage COA discount on freight
    fx_usd_inr: float = 83.0
    charter_lead_time_days: int = 10
    sandheads_lighterage_rate_tpd: float = 9000.0
    sandheads_transit_days: float = 1.2
    severe_partload_ratio: float = 0.50
    stranded_parcel_ratio: float = 0.60
    max_classes_in_mix: int = 2

    # forecast_v2: trained artifacts from ml-work. Auto-discovers paths across local dev,
    # repository root, and container environments.
    forecast_v2_root: str = Field(default_factory=_find_default_v2_root)
    forecast_v2_artifacts: str = Field(default_factory=_find_default_v2_artifacts)
    forecast_v2_enabled: bool = True
    require_v2_forecast: bool = False   # When True in production, fails fast with 503 instead of silent fallback

    n_simulations_default: int = 1000
    n_simulations_max: int = 5000
    simulation_seed: int = 42

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
