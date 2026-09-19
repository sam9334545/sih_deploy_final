# API contract — v1

Base URL: `http://localhost:8000/api/v1` · Interactive docs: `/docs` · Machine-readable: `/openapi.json` (frozen into `docs/openapi.json`)

Principles (blueprint §29.1):

- The frontend never imports Python. Everything crosses an HTTP/JSON boundary.
- Versioned paths, so a breaking change never silently breaks the dashboard mid-demo.
- Every response carries `provenance`, `as_of` and `assumptions`.
- `infeasible_request` is a **success-shaped failure**: "nothing can serve this cargo"
  is a useful answer, so the body explains why, per class, with the source that ruled it out.

## Endpoint catalogue

| Method | Path | Purpose |
|---|---|---|
| POST | `/forecast` | Freight index forecast for a vessel class; add a `route` to get a derived $/tonne |
| POST | `/recommend-vessel` | Hard feasibility filter → parcel split → deadline check → ranked classes |
| POST | `/optimize-charter` | The recommendation: class, voyage count, contract structure, window, cost, risk, explanation |
| POST | `/simulate-strategy` | Charter Strategy Digital Twin — every feasible strategy simulated and compared |
| POST | `/opportunity-score` | Charter Opportunity Score for a requirement, with attribution and λ-sensitivity |
| GET | `/ports` | Port registry (`?country=IN`, `?role=discharge`) |
| GET | `/ports/{port_id}` | Berth-level constraints, congestion, weather, per-class compatibility |
| GET | `/ports/{port_id}/compatibility` | The full port × berth × class × cargo × season grid |
| GET | `/vessels`, `/vessels/{class}` | Baltic standard class profiles with attribution |
| GET | `/market` | Indices, bunker, commodities, FX, availability signal, generic opportunity reading |
| GET | `/market/low-demand` | Six-month demand-regime strip per class, read for a charterer |
| GET | `/market/ballast-matrix` | Ballast cost between ports, and the premium owners price into the rate |
| GET | `/market/backhaul` | Backhaul insight for one lane, with better-backhaul alternatives |
| GET | `/risks` | Six-component explainable risk assessment with "what would change this" |
| GET | `/sources` | Live provenance registry (powers the Data Sources page) |
| GET | `/sources/coverage` | Verification status of every constraint record |
| GET | `/health` | Liveness and data freshness |
| GET | `/historical/status` | Historical data status, coverage window, and ML model availability |
| GET | `/historical/series` | Verified historical Baltic index series (BCI, BPI, BSI, BHSI) with metadata |
| POST | `/historical/forecast` | Point & conformal quantile forecasts (q10, q50, q90) from verified historical dates |
| POST | `/historical/route-estimate` | End-to-end voyage economics and charter estimate for specific corridor |
| GET | `/historical/supported-routes` | Catalogue of validated East Coast India maritime routes |

## Common types

```jsonc
// Cargo
{"type": "coking_coal|thermal_coal|iron_ore", "quantity_t": 120000}

// Every interval in the API is an 80% band
{"point": 1652.0, "interval_80": [1548.0, 1771.0]}

// Provenance values
"measured" | "derived" | "estimated" | "expert_set" | "simulated_demo"
```

## POST /forecast

```jsonc
// request
{
  "vessel_class": "Supramax",          // Handysize|Supramax|Panamax|Capesize
  "horizon_days": 28,                  // 7|14|28|60|90|180
  "route": {"origin_port": "AUHPT", "destination_port": "INPRT"},  // optional
  "as_of": "2026-09-15",               // optional; defaults to DEMO_AS_OF or today
  "refresh": false                     // recompute instead of serving the cached forecast
}
```

```jsonc
// 200
{
  "vessel_class": "Supramax", "index": "BSI", "as_of": "2026-09-15",
  "horizon_days": 28, "target_date": "2026-10-13",
  "index_forecast": {"point": 1740.87, "interval_80": [1565.96, 1887.16]},
  "tc_avg_usd_day": {"point": 19149.6, "interval_80": [17225.6, 20759.2]},
  "usd_per_tonne": {
    "point": 21.351, "interval_80": [18.673, 24.029],
    "provenance": "derived", "model": "shadow_freight_v1",
    "calibration_mape": 0.085,
    "calibration_route": "Capesize Australia–China iron ore (publicly quoted voyage route)",
    "cargo_t": 60600, "components_usd": {"hire": 575636.94, "bunker": 526369.96,
                                         "port": 74243.15, "margin": 117625.01}
  },
  "confidence": 0.43, "trend": "decreasing",
  "history": [{"date": "2026-08-15", "value": 1601.2}],
  "model_meta": {"name": "ridge_log_v1", "version": "v1", "trained_on": "2026-09-15",
                 "validation_mase": 0.88, "interval_coverage_80": 0.79, "method": "..."},
  "drivers": [{"feature": "logret_lag_7", "direction": "up", "contribution_log": 0.42}],
  "provenance": {...}, "assumptions": [...], "request_id": "uuid"
}
```

Errors: `400 invalid_input` (unknown class, untrained horizon), `404 not_found`
(no route in `dim_route`), `503 stale_data` (index older than `STALE_DATA_DAYS`).

## POST /recommend-vessel

```jsonc
// request
{"cargo": {"type": "coking_coal", "quantity_t": 120000},
 "origin_port": "AUHPT", "destination_port": "INPRT", "required_by": "2026-12-20"}
```

```jsonc
// 200 — `recommended` may be null if nothing meets the deadline
{
  "recommended": {
    "vessel_class": "Panamax", "voyages": 2, "parcel_t": 79500, "last_parcel_t": 40500,
    "intake_ratio": 0.964, "compatibility_score": 61.2,
    "compatibility_factors": {"u_cargo": 0.964, "u_time": 0.69, "u_cost": 1.0,
                              "u_reliability": 0.92},
    "estimated_days_per_voyage": 39.4, "deadline_feasible": true,
    "binding_constraint": "class capacity", "binding_port": "AUHPT",
    "requires_lighterage": false, "expected_cost_usd": 2573482.0,
    "interval_80_usd": [2353412, 2596439], "note": null
  },
  "alternatives": [...],
  "rejected": [{"vessel_class": "Capesize", "reason": "draft",
                "detail": "Paradip: Requires 18.2 m plus 1.8 m UKC; Coal Berth-01 permits 13.5 m effective",
                "port_id": "INPRT", "source": "https://paradipport.gov.in/..."}],
  "constraints_as_of": "2026-09-15", "as_of": "2026-09-15",
  "assumptions": [...], "provenance": {...}, "request_id": "uuid"
}
```

## POST /optimize-charter

Adds to the `/recommend-vessel` request: `contract_horizon_voyages`, `risk_aversion`
(0–1), `deadline_miss_penalty_usd`, `n_simulations` (100–5000), `seed`,
`include_opportunity_score` (default true), `include_milp_crosscheck` (default false).

```jsonc
// 200
{
  "recommendation": {
    "vessel_class": "Panamax", "voyages": 2, "execution": "sequential",
    "contract_structure": "short_term_multi_voyage",
    "charter_window": {"start": "2026-09-15", "end": "2026-09-20"},
    "expected_cost_usd": 2470155.68, "expected_cost_inr": 197725000.0,
    "expected_usd_per_tonne": 20.58, "fx_rate": 80.05, "fx_date": "2026-09-15",
    "interval_80_usd": [2358739, 2601344], "cvar_90_usd": 2657715,
    "p_deadline_miss": 0.023, "risk_adjusted_cost_usd": 2573482,
    "risk": "MEDIUM", "charter_opportunity_score": 92.3
  },
  "cost_breakdown_usd": {"freight": 1835156.93, "bunker": 0.0, "port_costs": 163388.8,
                         "waiting": 39065.63, "expected_demurrage": 43858.22,
                         "lighterage": 0.0, "repositioning": 398797.98, "total": 2480267.56},
  "idle": {"idle_days": 11.67, "idle_cost_usd": 126027.29},
  "alternatives": [/* same shape as simulate-strategy results */],
  "infeasible": [{"id": "S1", "label": "1 × Handysize, spot", "reason": "deadline",
                  "detail": "Sequential execution needs 131.0 days but only 86.0 days remain"}],
  "explanation": ["Port compatible: ...", "Freight outlook: ...", "..."],
  "opportunity": {"charter_opportunity_score": 92.3, "verdict": "charter_now",
                  "window": [...], "attribution_usd": {...},
                  "lambda_sensitivity": [{"risk_aversion": 0.0, "score": 92.3,
                                          "preferred": "now"}], "note": "..."},
  "risk": {"overall": "MEDIUM", "main_driver": "...", "components": [...]},
  "milp_crosscheck": {"available": false, "note": "..."},
  "assumptions": [...], "provenance": {...}, "as_of": "2026-09-15",
  "runtime_ms": 220, "request_id": "uuid"
}
```

`cost_breakdown_usd.total` always equals `recommendation.expected_cost_usd`.

## POST /simulate-strategy

Adds `strategies` (`["auto"]`, or strategy ids / class names), `n_simulations`, `seed`.

```jsonc
// 200 — results sorted by risk-adjusted cost, cheapest first
{
  "results": [{
    "id": "S11", "label": "1 × Panamax, 2-voyage contract", "vessel_class": "Panamax",
    "voyages": 2, "structure": "multi_voyage", "execution": "sequential",
    "total_days": 78.8,
    "cost": {"mean": 2470728, "p10": 2353412, "p50": 2468000, "p90": 2596439,
             "cvar_90": 2659893, "std": 94000},
    "usd_per_tonne": 20.59, "p_deadline_miss": 0.023, "risk_adjusted_cost": 2573482,
    "breakdown": {...}, "idle_days": 11.7, "idle_cost_usd": 126027,
    "feasible": true, "notes": ["Final parcel is only 40,500 t (51% of intake) — poor utilisation"]
  }],
  "infeasible": [...], "winner": "S11",
  "n_simulations": 1000, "seed": 42, "runtime_ms": 140,
  "distributions": {"waiting_discharge": "Empirical bootstrap of observed calls, ...", "...": "..."},
  "as_of": "2026-09-15", "assumptions": [...], "provenance": {...}, "request_id": "uuid"
}
```

Same request + same seed ⇒ identical numbers. This is asserted in `tests/test_api.py`.

## GET /ports/{port_id}

`?cargo_type=coking_coal&season=post_monsoon&as_of=2026-09-15`

```jsonc
{
  "port_id": "INPRT", "name": "Paradip", "country": "IN", "lat": 20.2654, "lon": 86.6763,
  "authority": "Paradip Port Authority", "authority_type": "major_port",
  "berths": [{"berth_id": "INPRT-CB1", "name": "Coal Berth-01",
              "cargo_types": ["thermal_coal", "coking_coal"], "max_loa_m": 300.0,
              "max_beam_m": 48.0, "max_draft_m": 14.5, "tide_allowance_m": 0.5,
              "handling_rate_tpd": 32000.0,
              "coupling_constraint": "Subject to Iron Ore Berth being vacant",
              "status": "operational", "effective_from": "2024-04-01",
              "source_url": "https://paradipport.gov.in/...", "verification": "manually_verified"}],
  "congestion": {"expected_wait_hours_p50": 28.4, "p90": 96.2,
                 "strata": "port+month", "sample_size": 365, "as_of": "2026-09-15"},
  "weather": [{"month": 10, "weather_stop_fraction": 0.055, "cyclone_freq_per_decade": 3.4}],
  "vessel_compatibility": [{"vessel_class": "Supramax", "feasible": true,
                            "max_intake_t": 60600, "compat_score": 61.2,
                            "factors": {...}, "requires_lighterage": false}],
  "source_url": "...", "retrieved_at": "2026-09-10", "verification": "manually_verified",
  "constraints_as_of": "2026-09-15", "request_id": "uuid"
}
```

## GET /risks

`?port_id=INPRT&vessel_class=Panamax&month=11`

```jsonc
{
  "overall": "MEDIUM", "overall_raw": 1.04,
  "components": [{"name": "market", "level": "HIGH", "score": 2, "signal_z": 0.76,
                  "detail": "20-day realised volatility 40% annualised — 74% percentile of its own history",
                  "weight": 0.30, "contribution_pct": 45.4}],
  "main_driver": "Market risk contributes 45% of the overall score. ...",
  "what_would_change": ["Volatility returning to its 12-month median → market risk LOW"],
  "alerts": [{"code": "congestion_buildup", "severity": "medium", "message": "..."}],
  "weights_method": "Weights are |∂ risk-adjusted cost / ∂ component| from a ±1σ perturbation of the simulator, normalised — not chosen by hand.",
  "as_of": "2026-09-15", "request_id": "uuid"
}
```

## Error envelope

Every failure, on every endpoint:

```jsonc
{"error": "<machine_code>", "message": "<human readable>",
 "field": "<offending field, if any>", "request_id": "uuid",
 "hint": "<what to do about it>", "allowed": [...], "as_of": "2026-09-06"}
```

| Code | HTTP | When |
|---|---|---|
| `invalid_input` | 400 | Validation failure, unknown class, untrained horizon |
| `infeasible_request` | 422 | No class can serve the cargo, or every strategy misses the deadline. Body carries `rejected` / `infeasible` with per-option reasons |
| `no_model` | 404 | No trained model for that index/horizon |
| `not_found` | 404 | Unknown port, vessel class or route |
| `stale_data` | 503 | Underlying series older than `STALE_DATA_DAYS`; `as_of` says how old |
| `internal_error` | 500 | Unexpected; quote the `request_id` |

Every response — success or failure — also returns the `x-request-id` header,
echoing a client-supplied one when present.
