"""Test fixtures.

The suite used to depend on a `charter.db` left behind in the working directory
by a previous manual `python -m app.seed`. On a clean checkout every test that
touched the database failed with `no such table: fact_freight_index`. The fixture
below builds and seeds its own database instead, so a fresh clone can run the
suite with nothing but `pip install -r requirements.txt`.
"""
from __future__ import annotations

import os
import tempfile
from datetime import date
from pathlib import Path

import pytest

os.environ.setdefault("DEMO_MODE", "true")

# The engine is constructed at import time from settings, so the test database
# has to be chosen before anything under `app` is imported.
_TEST_DB = Path(os.environ.get("SIH_TEST_DB")
                or Path(tempfile.gettempdir()) / "sih_test_charter.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB}"

from fastapi.testclient import TestClient      # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app                       # noqa: E402

AS_OF = date(2026, 9, 15)
REQUIRED_TABLES = ("dim_port", "dim_berth", "dim_vessel_class", "fact_freight_index",
                   "fact_port_call", "derived_compatibility")


def _is_seeded() -> bool:
    from sqlalchemy import func, inspect, select

    from app.models import Berth, FreightIndex, Port
    if not _TEST_DB.exists():
        return False
    names = set(inspect(engine).get_table_names())
    if not set(REQUIRED_TABLES) <= names:
        return False
    with SessionLocal() as s:
        counts = [s.execute(select(func.count()).select_from(m)).scalar_one()
                  for m in (Port, Berth, FreightIndex)]
    return all(c > 0 for c in counts)


@pytest.fixture(scope="session", autouse=True)
def _database() -> None:
    """Build the schema and seed it once per session.

    Reuses an already-seeded database so the suite stays fast locally; set
    SIH_TEST_DB_REBUILD=1 to force a rebuild, which CI should do.
    """
    if os.environ.get("SIH_TEST_DB_REBUILD") == "1" and _TEST_DB.exists():
        _TEST_DB.unlink()
    if _is_seeded():
        return
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    from app import seed
    seed.main(rebuild_compat=True)


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture()
def db():
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


@pytest.fixture()
def base_request() -> dict:
    return {
        "cargo": {"type": "coking_coal", "quantity_t": 120000},
        "origin_port": "AUHPT",
        "destination_port": "INPRT",
        "required_by": "2026-12-20",
    }
