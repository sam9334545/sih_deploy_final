# SIH26006 Charter Intelligence — API Smoke Test Results

**Date**: 2026-09-20  
**Environment**: Windows 11, Python 3.12.8, FastAPI 0.115.6, Node v24.13.0, Vite 5.4.21  
**Database**: SQLite (`backend-work/charter.db`, 14 ports, 22 berths, 10,055 freight rows)  
**ML Models**: 72 serialized Quantile LightGBM models with Split-Conformal Calibration  

---

## 1. Automated Test Suite Execution Summary

### Backend Test Suite (`backend-work/tests/`)
```
platform win32 -- Python 3.12.8, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\win11\Downloads\sih\backend-work
configfile: pytest.ini
collected 99 items

tests\test_api.py ..........................                             [ 26%]
tests\test_audit_smoke.py .....................                          [ 47%]
tests\test_compatibility_and_forecast.py ...............                 [ 62%]
tests\test_constraints.py ...............                                [ 77%]
tests\test_cost_model.py ...........                                     [ 88%]
tests\test_simulator.py ...........                                      [100%]

============================= 99 passed in 29.26s =============================
```

### ML Pipeline Test Suite (`ml-work/tests/`)
```
platform win32 -- Python 3.12.8, pytest-9.1.1, pluggy-1.6.0
rootdir: C:\Users\win11\Downloads\sih\ml-work
collected 73 items

tests\test_data_pipeline.py ..........                                   [ 13%]
tests\test_feature_pipeline.py ...........                               [ 28%]
tests\test_phase4_models.py ............                                 [ 45%]
tests\test_phase5_probabilistic.py .............                         [ 63%]
tests\test_phase6a_route_architecture.py ..........                      [ 76%]
tests\test_phase6b_integration.py ........                               [ 87%]
tests\test_phase7a_readiness.py .........                                [100%]

============================= 73 passed in 31.50s =============================
```

### Frontend Production Bundle Build (`frontend-work/`)
```
> sih26006-frontend@1.0.0 build
> vite build

vite v5.4.21 building for production...
✓ 1614 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.60 kB
dist/assets/index-HOwcZB1l.css   56.99 kB │ gzip:  9.70 kB
dist/assets/index-D5OkmKJb.js   301.40 kB │ gzip: 77.56 kB
✓ built in 3.69s
```

---

## 2. API Smoke Test Results Matrix

| Test ID | Test Category | Target / Route | Inputs | Status | Observed Results |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ST-01** | Historical Series | BCI | `target=BCI, limit=50` | `200 OK` | Returned 50 verified daily records, non-null values, cutoff $\le 2019-07-31$. |
| **ST-02** | Historical Series | BPI | `target=BPI, limit=50` | `200 OK` | Returned 50 verified daily records, valid ISO dates. |
| **ST-03** | Historical Series | BSI | `target=BSI, limit=50` | `200 OK` | Returned 50 verified daily records. |
| **ST-04** | Historical Series | BHSI | `target=BHSI, limit=50` | `200 OK` | Returned 50 verified daily records. |
| **ST-05** | Forecast Model | BCI | `2019-06-28, h=7, Capesize` | `200 OK` | $P10 \le P50 \le P90$, $P50 = 1,720.5$, observed actual returned. |
| **ST-06** | Forecast Model | BCI | `2019-06-28, h=28, Capesize` | `200 OK` | $P10 \le P50 \le P90$, $P50 = 1,945.2$, verified actual returned. |
| **ST-07** | Forecast Model | BPI | `2019-06-28, h=7, Panamax` | `200 OK` | $P10 \le P50 \le P90$, $P50 = 1,180.1$, observed actual returned. |
| **ST-08** | Forecast Model | BPI | `2019-06-28, h=28, Panamax` | `200 OK` | $P10 \le P50 \le P90$, $P50 = 1,220.4$, observed actual returned. |
| **ST-09** | Forecast Model | BSI | `2019-06-28, h=14, Supramax` | `200 OK` | $P10 \le P50 \le P90$, $P50 = 780.2$, observed actual returned. |
| **ST-10** | Forecast Model | BHSI | `2019-06-28, h=60, Handysize`| `200 OK` | $P10 \le P50 \le P90$, $P50 = 460.8$, observed actual returned. |
| **ST-11** | Forecast Post-2019 | BPI | `2019-07-31, h=28, Panamax` | `200 OK` | $P50 = 1,780.4$, `actual_value = null`, `actual_status = "NOT_AVAILABLE"`, zero fabrication. |
| **ST-12** | Route Analysis | AUHPT-INPRT | `BCI, Capesize, 159k MT` | `200 OK` | $P50 = \$13.42$/t, Sea days = 16.6, Total days = 45.3, Bunker = \$827k. |
| **ST-13** | Route Analysis | IDTBA-INPRT | `BPI, Panamax, 75k MT` | `200 OK` | $P50 = \$11.85$/t, Sea days = 10.6, Total days = 31.2. |
| **ST-14** | Route Analysis | ZARBY-INPRT | `BPI, Panamax, 75k MT` | `200 OK` | $P50 = \$14.20$/t, Sea days = 15.1, Total days = 35.8. |
| **ST-15** | Route Analysis | USHAM-INPRT | `BCI, Capesize, 159k MT` | `200 OK` | $P50 = \$22.50$/t, Sea days = 29.3, Total days = 58.0. |
| **ST-16** | Route Analysis | MZBEW-INPRT | `BPI, Panamax, 75k MT` | `200 OK` | $P50 = \$13.80$/t, Sea days = 14.0, Total days = 34.6. |
| **ST-17** | Charter Optimizer | Feasible Case | `AUHPT -> INPRT, 150k MT, 45d` | `200 OK` | Recommendation: Panamax Spot consecutive voyages (\$19.45/t, ₹24.2 Cr). |
| **ST-18** | Charter Optimizer | Infeasible Case| `AUHPT -> INPRT, 150k MT, 2d` | `422 Unproc`| Correctly reported infeasible deadline with structured reasons payload. |
| **ST-19** | Port Intelligence | Port List | `country=IN` | `200 OK` | Returned 6 major ports (INPRT, INVTZ, INDHA, INGGV, INHAL, INGPR). |
| **ST-20** | Port Intelligence | Paradip Dossier| `INPRT, coking_coal` | `200 OK` | Returned berths, wait pool hours, weather climatology, vessel compatibility. |
| **ST-21** | System Status | Market Summary | Cutoff levels | `200 OK` | BCI, BPI, BSI, BHSI cutoff levels returned as of 2019-07-31. |
