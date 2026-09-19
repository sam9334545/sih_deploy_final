# SIH26006 — Charter Intelligence (backend + API)

Decision-support backend for chartering bulk carriers to bring coal and other dry
bulk into India's East Coast ports.

**Forecast the market → understand the constraints → simulate charter strategies →
recommend the best decision.**

This is not a freight price oracle. It is a *constrained decision engine* that treats
the freight forecast as an uncertain input, not as the answer. Every response carries
`provenance`, `as_of` and `assumptions`, and every option that is ruled out comes back
with the constraint and the source that ruled it out.

## Run it in three commands

```bash
make install          # python venv + dependencies
make bootstrap        # generate demo series, build the database, freeze the API contract
make dev              # http://localhost:8000/docs
```

```bash
make test             # 78 tests
```

Or with Docker:

```bash
docker compose up --build
```

## What is in here

```
backend/app/
├── main.py                    FastAPI app, CORS, request-id middleware, routers
├── config.py                  every judgement parameter, env-overridable
├── models.py                  the schema of blueprint §31, portable SQLite/Postgres
├── seed.py                    load reference CSVs + demo series, rebuild the grid
├── errors.py                  the one error envelope
├── schemas/                   the API contract as Pydantic models
├── routers/                   forecast · ports · vessels · optimize · market · risks · sources · health
├── repositories/              SQL access only, no business logic
└── services/
    ├── constraint_service.py  hard feasibility + draft-limited intake      §21.3 §24.1
    ├── compatibility_service.py  the port × berth × class × cargo × season grid   §21
    ├── congestion_service.py  empirical waiting distributions               §28.2
    ├── forecast_model.py      the model ladder, conformal intervals         §22
    ├── forecast_service.py    train/cache/serve forecasts
    ├── shadow_freight.py      route $/tonne from Baltic TCE + our costs     §17.4
    ├── cost_model.py          pure voyage-cost functions, unit-tested
    ├── scenario.py            assembles one decision's whole context
    ├── simulator.py           the Charter Strategy Digital Twin             §28
    ├── optimizer.py           enumerate-then-simulate, + a CP-SAT crosscheck §25
    ├── opportunity.py         Charter Opportunity Score                     §23
    ├── risk_engine.py         six components, sensitivity-derived weights   §27
    └── idle_service.py        idle days, low-demand windows, ballast        §26

data/reference/                the constraint registry — the crown jewel
├── ports.csv  berths.csv  vessel_classes.csv  routes.csv  port_tariffs.csv
├── weather_climatology.csv
└── demo/                      seeded stand-in series, clearly labelled
```

## The four things that make this defensible

**1. Constraints are data, not code.** Berth limits live in `dim_berth` with
`effective_from` / `effective_to`, so a port dredging a new berth is an INSERT,
not an UPDATE — old recommendations stay explainable. Every row carries
`source_url`, `retrieved_at` and a verification state, and `GET /sources/coverage`
reports how much of the registry is manually verified.

**2. Nothing is a weighted sum of hand-picked numbers.**

- The compatibility score is a product of four ratios that each have a physical
  meaning: how much of the ship you can use, how much of the port time is
  productive, cost against the best feasible option, and weather exposure.
- The risk weights come from a ±1σ sensitivity analysis of the simulator itself:
  literally how much each factor moves the money in *this* scenario.
- LOW/MEDIUM/HIGH cut-offs are tertiles of each component's own history.
- The Charter Opportunity Score is the percentile position of today's
  risk-adjusted cost among every remaining commit date. `COS 95` means committing
  today beats 95% of the days you have left.

**3. The uncertainty is real.** Forecast intervals are conformal quantiles of a
rolling-origin backtest, and the realised coverage is reported next to the band.
Waiting time is an empirical bootstrap of observed port calls, stratified by class
and month, rather than an assumed distribution. The simulator reports mean, p10,
p50, p90, CVaR₉₀ and P(deadline miss) — and the recommendation is chosen on
risk-adjusted cost, not on the mean.

**4. Infeasible is a useful answer.** `422 infeasible_request` is success-shaped:
the body explains, per class, which constraint bit and where the number came from.

## What is real and what is simulated

| Layer | Status |
|---|---|
| Port and berth constraints, tariffs | Hand-curated from official sources, marked `manually_verified` / `partially_verified` / `estimated` per row |
| Vessel class profiles | Baltic Exchange standard vessel descriptions — the same source that defines the index we forecast |
| Freight, commodity, macro series | `simulated_demo` seeded series with realistic statistics. Schema-identical to the real feed; swap in the ingestion output and nothing above changes |
| Port call waiting times | `simulated_demo`. The real pipeline parses published daily traffic reports |
| AIS | Not used. No free source with usable coverage and licensing exists, so the design does not need one |

`GET /sources` returns this as live data, so the lineage is queryable rather than a slide.

## Configuration

Copy `.env.example` to `.env`. Notable settings:

| Variable | Default | Effect |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./charter.db` | Postgres works unchanged |
| `DEMO_MODE` | `true` | Freezes "today" to `DEMO_AS_OF` so a demo is reproducible |
| `DEMO_AS_OF` | `2026-09-15` | The frozen clock |
| `STALE_DATA_DAYS` | `7` | Beyond this the forecast endpoint returns `503 stale_data` |
| `DEFAULT_RISK_AVERSION` | `0.5` | λ on the `CVaR₉₀ − mean` term |
| `DEFAULT_DEADLINE_MISS_PENALTY_USD` | `500000` | M on P(deadline miss) |
| `UKC_FRACTION` / `UKC_MIN_M` | `0.10` / `0.5` | Under-keel clearance convention |
| `CONTRACT_DISCOUNT` | `0.05` | Multi-voyage COA discount |

Every one of these is echoed back in the `assumptions` of the responses it affects.

## Docs

- [`docs/api_contract.md`](docs/api_contract.md) — the frozen contract the frontend builds against
- [`docs/assumptions.md`](docs/assumptions.md) — every judgement call, and the deliberate non-assumptions
- [`docs/openapi.json`](docs/openapi.json) — machine-readable; a diff here means the frontend needs telling

## Extending it

- **New port or berth**: add a row to `data/reference/*.csv`, run `make seed && make compat`.
  No code changes — constraints are never hard-coded.
- **Real data**: point the ingestion jobs at the same tables with
  `provenance='measured'`. The API reports the change automatically.
- **Scale**: `optimizer.milp_crosscheck` holds the CP-SAT formulation. Install
  `ortools` and pass `include_milp_crosscheck: true` to run both and compare.
  Enumerate-then-simulate stays the served answer at this problem size, because
  at a few dozen strategies it is exact rather than approximate.
