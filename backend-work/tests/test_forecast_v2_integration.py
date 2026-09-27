"""v2 adapter, fallback labelling, and the canonical frontend flow.

Items 12, 13, 14: the adapter degrades rather than crashes, the API always says
which engine answered, and the path the UI calls is the v2 path.
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services import forecast_v2_adapter

client = TestClient(app)
V1 = "/api/v1"
BODY = {"vessel_class": "Supramax", "horizon_days": 28, "refresh": True}
MATRIX = [(vc, h) for vc in ("Handysize", "Supramax", "Panamax", "Capesize")
          for h in (7, 14, 28, 60, 90, 180)]


def _forecast(**over):
    return client.post(f"{V1}/forecast", json={**BODY, **over}).json()


# ───────────────────────── canonical flow (item 13) ─────────────────────────

@pytest.mark.parametrize("vessel_class,horizon", MATRIX, ids=lambda v: str(v))
def test_every_combination_is_servable_through_the_canonical_endpoint(vessel_class, horizon):
    """All 24 combinations must serve through /api/v1/forecast, not just the easy ones."""
    r = client.post(f"{V1}/forecast",
                    json={"vessel_class": vessel_class, "horizon_days": horizon})
    assert r.status_code == 200, r.text
    d = r.json()
    lo, hi = d["index_forecast"]["interval_80"]
    assert lo <= d["index_forecast"]["point"] <= hi
    assert d["model_meta"]["model_source"] in ("forecast_v2", "fallback_v1")


@pytest.mark.skipif(not forecast_v2_adapter.available(), reason="v2 artifacts absent")
def test_canonical_endpoint_is_served_by_v2_when_available():
    """Frontend -> /api/v1/forecast -> forecast_service -> forecast_v2."""
    d = _forecast()
    assert d["model_meta"]["model_source"] == "forecast_v2"
    assert d["model_meta"]["version"] == "v2"
    assert d["model_meta"]["fallback_reason"] is None
    assert d["validation"]["mase"] > 0
    assert d["interval"]["empirical_coverage_pct"] > 0


def test_frontend_payload_shape_is_satisfied():
    """The exact fields src/api/forecast.js mapLiveForecast() reads."""
    d = _forecast()
    assert isinstance(d["index_forecast"]["point"], (int, float))
    assert len(d["index_forecast"]["interval_80"]) == 2
    for key in ("index", "as_of", "target_date", "horizon_days", "trend",
                "forecast_quality_score", "model_meta", "drivers", "provenance"):
        assert key in d, f"frontend reads {key} and it is absent"
    assert {"name", "version", "model_source"} <= set(d["model_meta"])


# ───────────────────────── no silent fallback (item 14) ─────────────────────────

def test_fallback_is_labelled_and_explains_itself():
    original = settings.forecast_v2_enabled
    settings.forecast_v2_enabled = False
    try:
        d = _forecast()
        assert d["model_meta"]["model_source"] == "fallback_v1"
        assert d["model_meta"]["version"] == "v1"
        assert d["model_meta"]["fallback_reason"]
        assert "Built-in fallback" in d["model_meta"]["method"]
    finally:
        settings.forecast_v2_enabled = original


@pytest.mark.skipif(not forecast_v2_adapter.available(), reason="v2 artifacts absent")
def test_a_v1_forecast_is_never_presented_as_v2():
    original = settings.forecast_v2_enabled
    settings.forecast_v2_enabled = False
    try:
        fallback = _forecast()
    finally:
        settings.forecast_v2_enabled = original
    live = _forecast()
    assert fallback["model_meta"]["model_source"] != live["model_meta"]["model_source"]
    assert fallback["model_meta"]["name"] != live["model_meta"]["name"]


# ───────────────────────── adapter robustness (item 12) ─────────────────────────

def test_missing_artifacts_fall_back_instead_of_crashing(monkeypatch):
    monkeypatch.setattr(forecast_v2_adapter, "_artifact_root",
                        lambda: (_ for _ in ()).throw(
                            forecast_v2_adapter.V2Unavailable("no artifacts")))
    d = _forecast()
    assert d["model_meta"]["model_source"] == "fallback_v1"
    assert "no artifacts" in (d["model_meta"]["fallback_reason"] or "")


def test_corrupted_artifact_falls_back_instead_of_crashing(monkeypatch, tmp_path):
    (tmp_path / "bsi_h28.joblib").write_bytes(b"corrupted")
    monkeypatch.setattr(forecast_v2_adapter, "_artifact_root", lambda: tmp_path)
    d = _forecast()
    assert d["model_meta"]["model_source"] == "fallback_v1"


def test_broken_import_falls_back_instead_of_crashing(monkeypatch):
    monkeypatch.setattr(forecast_v2_adapter, "_predict_module",
                        lambda: (_ for _ in ()).throw(
                            forecast_v2_adapter.V2Unavailable("lightgbm missing")))
    assert _forecast()["model_meta"]["model_source"] == "fallback_v1"


def test_insufficient_history_is_detected(db):
    from datetime import date
    with pytest.raises(forecast_v2_adapter.V2Unavailable, match="sessions"):
        forecast_v2_adapter._history(db, date(2012, 9, 1))


def test_inconsistent_interval_is_rejected(monkeypatch, db):
    """If v2 ever returns point outside its own band, do not serve it."""
    from datetime import date
    real = forecast_v2_adapter._predict_module()

    class Broken:
        lo_80, point, hi_80 = 100.0, 500.0, 200.0
        provenance, validation, interval = {}, {}, {}
        forecast_quality_score, trend = 0.5, "stable"
        quality_score_components, quality_score_definition = {}, ""
        model_source, selected_model, model_version = "forecast_v2", "ensemble", "v2"
        drivers, driver_groups, origin_level = [], [], 100.0

    monkeypatch.setattr(real, "forecast", lambda *a, **k: Broken())
    with pytest.raises(forecast_v2_adapter.V2Unavailable, match="inconsistent interval"):
        forecast_v2_adapter.forecast(db, "BSI", 28, date(2026, 9, 15))


def test_status_reports_why_v2_is_or_is_not_serving():
    s = forecast_v2_adapter.status()
    assert "available" in s
    if s["available"]:
        assert s["artifact_count"] == 24
    else:
        assert s["reason"]


# ───────────────────────── explainability & provenance ─────────────────────────

@pytest.mark.skipif(not forecast_v2_adapter.available(), reason="v2 artifacts absent")
def test_drivers_are_real_features_not_ensemble_weights():
    d = _forecast()
    assert d["drivers"]
    for driver in d["drivers"]:
        assert not driver["feature"].startswith("ensemble_weight")
        assert driver.get("group")
    assert d["driver_groups"]


@pytest.mark.skipif(not forecast_v2_adapter.available(), reason="v2 artifacts absent")
def test_response_carries_traceable_provenance():
    p = _forecast()["model_provenance"]
    for key in ("dataset_sha256", "artifact_sha256", "git_commit", "environment",
                "trained_through", "n_train_real", "augmentation_used"):
        assert key in p
    assert p["augmentation_used"] is False
    assert p["environment"]["packages"]["lightgbm"]


def test_quality_score_is_documented_as_a_heuristic():
    """Item 10: it must not read as a probability of being correct."""
    d = _forecast()
    assert 0.0 <= d["forecast_quality_score"] <= 1.0
    definition = d.get("quality_score_definition") or ""
    assert "NOT a probability" in definition or "Not a probability" in definition
    assert any("heuristic" in a for a in d["assumptions"])


@pytest.mark.skipif(not forecast_v2_adapter.available(), reason="v2 artifacts absent")
def test_v2_reports_its_real_training_cutoff_not_today():
    assert _forecast()["model_meta"]["trained_on"] == "2019-07-31"


def test_mixed_history_is_reported_as_mixed_with_counts():
    d = _forecast()
    if d["provenance"]["history"] == "mixed":
        detail = d["provenance_detail"]["history"]
        assert any(k.startswith("verified_real") for k in detail)
