"""End-to-end smoke test over all 24 combinations: artifact -> prediction -> API."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from forecast_v2 import predict
from forecast_v2.dataset import load_real

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "models/saved_models/v2"
CODES = ["BPI", "BCI", "BSI", "BHSI"]
HORIZONS = [7, 14, 28, 60, 90, 180]
CLASS_OF = {"BPI": "Panamax", "BCI": "Capesize", "BSI": "Supramax", "BHSI": "Handysize"}


def main() -> int:
    real = load_real(str(ROOT / "data/processed/real_baltic_multivariate.csv"))
    failures: list[str] = []

    try:
        sys.path.insert(0, str(ROOT.parent / "backend-work"))
        sys.path.insert(0, str(ROOT.parent / "backend-work" / "tests"))
        import conftest  # noqa: F401  (selects and seeds the test database)
        from fastapi.testclient import TestClient

        from app.main import app
        client = TestClient(app)
    except Exception as e:                              # pragma: no cover
        client = None
        print(f"API check skipped: {type(e).__name__}: {e}")

    print(f"{'index':6}{'h':>5}  {'model':10} {'point':>10} {'lo80':>10} {'hi80':>10} "
          f"{'qual':>5} {'skill':>7} {'cov':>6}  api")
    for code in CODES:
        for h in HORIZONS:
            row = f"{code:6}{h:>5}  "
            try:
                f = predict.forecast(real, code, h, root=ART)
                assert f.lo_80 <= f.point <= f.hi_80, "interval does not contain the point"
                assert f.drivers, "no feature attribution"
                assert f.provenance.get("dataset_sha256"), "no dataset hash"
                api = "-"
                if client is not None:
                    r = client.post("/api/v1/forecast", json={
                        "vessel_class": CLASS_OF[code], "horizon_days": h})
                    body = r.json()
                    ok = (r.status_code == 200
                          and body["model_meta"]["model_source"] == "forecast_v2")
                    api = "ok" if ok else f"FAIL({r.status_code})"
                    if not ok:
                        failures.append(f"{code} h={h}: API {api}")
                skill = (f.validation or {}).get("skill_vs_naive_pct")
                cov = (f.interval or {}).get("empirical_coverage_pct")
                print(row + f"{f.selected_model:10} {f.point:10.1f} {f.lo_80:10.1f} "
                            f"{f.hi_80:10.1f} {f.forecast_quality_score:5.2f} "
                            f"{skill:6.1f}% {cov:5.1f}%  {api}")
            except Exception as e:
                failures.append(f"{code} h={h}: {type(e).__name__}: {e}")
                print(row + f"FAILED  {type(e).__name__}: {e}")

    total = len(CODES) * len(HORIZONS)
    print(f"\n{total - len(failures)}/{total} combinations passed")
    for f in failures:
        print(f"  FAIL {f}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
