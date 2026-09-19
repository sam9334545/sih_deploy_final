from __future__ import annotations

import os
from datetime import date

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DEMO_MODE", "true")

from app.db import SessionLocal          # noqa: E402
from app.main import app                 # noqa: E402

AS_OF = date(2026, 9, 15)


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
