"""The v2 adapter must serve the trained models when present — and the API must
still work when they are absent, because the service has to start on a machine
with no ML stack.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services import forecast_v2_adapter

client = TestClient(app)
BODY = {"vessel_class": "Supramax", "horizon_days": 28, "refresh": True}


def test_forecast_endpoint_answers_either_way():
    r = client.post("/api/v1/forecast", json=BODY)
    assert r.status_code == 200
    d = r.json()
    assert d["model_meta"]["version"] in ("v1", "v2")
    assert d["index_forecast"]["interval_80"][0] <= d["index_forecast"]["point"] \
        <= d["index_forecast"]["interval_80"][1]


def test_fallback_when_v2_disabled():
    original = settings.forecast_v2_enabled
    settings.forecast_v2_enabled = False
    try:
        d = client.post("/api/v1/forecast", json=BODY).json()
        assert d["model_meta"]["version"] == "v1"
        assert "Built-in fallback" in d["model_meta"]["method"]
    finally:
        settings.forecast_v2_enabled = original


@pytest.mark.skipif(not forecast_v2_adapter.available(),
                    reason="forecast_v2 artifacts or dependencies not installed")
def test_v2_reports_its_real_training_cutoff_not_today():
    """Quoting as_of here would imply the model has seen data it never saw."""
    d = client.post("/api/v1/forecast", json=BODY).json()
    assert d["model_meta"]["version"] == "v2"
    assert d["model_meta"]["trained_on"] == "2019-07-31"
    assert d["model_meta"]["validation_mase"] is not None


@pytest.mark.skipif(not forecast_v2_adapter.available(),
                    reason="forecast_v2 artifacts or dependencies not installed")
def test_mixed_history_is_reported_as_mixed_with_counts():
    """A card claiming 'measured' over partly synthetic rows is a small lie."""
    d = client.post("/api/v1/forecast", json=BODY).json()
    if d["provenance"]["history"] == "mixed":
        detail = d["provenance_detail"]["history"]
        assert any(k.startswith("verified_real") for k in detail)
        assert sum(detail.values()) > 1000


def test_unavailable_v2_raises_typed_error_not_crash(monkeypatch):
    monkeypatch.setattr(forecast_v2_adapter, "_artifact_root",
                        lambda: (_ for _ in ()).throw(
                            forecast_v2_adapter.V2Unavailable("no artifacts")))
    assert client.post("/api/v1/forecast", json=BODY).status_code == 200
