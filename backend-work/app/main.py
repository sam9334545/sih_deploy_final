from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.errors import ApiError, api_error_handler, unhandled_handler, validation_handler
from app.routers import forecast, health, historical, market, optimize, ports, risks, sources, vessels

DESCRIPTION = """
Decision-support API for chartering bulk carriers into India's East Coast ports.

**Forecast the market → understand the constraints → simulate charter strategies →
recommend the best decision.**

This is not a freight price oracle. It is a constrained decision engine that treats
the freight forecast as an uncertain input, not as the answer. Every response carries
`provenance`, `as_of` and `assumptions`, and every infeasible option comes back with
the constraint and the source that ruled it out.

Provenance values: `measured` (from an official published record), `derived` (computed
by one of our models from measured inputs), `estimated` (a documented judgement where no
publication exists), `expert_set` (a hand-curated parameter), `simulated_demo` (a
seeded demo series standing in for a feed that needs credentials).
"""

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(
    lifespan=lifespan,
    title="SIH26006 — Charter Intelligence API",
    version="1.0.0",
    description=DESCRIPTION,
    openapi_tags=[
        {"name": "forecast", "description": "Freight index and route-rate forecasting"},
        {"name": "ports", "description": "Constraint registry, congestion and compatibility"},
        {"name": "vessels", "description": "Class profiles and vessel selection"},
        {"name": "decision", "description": "Optimisation, simulation and opportunity scoring"},
        {"name": "market", "description": "Market dashboard, demand regime and ballast"},
        {"name": "risk", "description": "Explainable risk assessment"},
        {"name": "provenance", "description": "Live data-lineage registry"},
        {"name": "meta", "description": "Health and diagnostics"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    rid = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = rid
    response = await call_next(request)
    response.headers["x-request-id"] = rid
    return response


app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_handler)
app.add_exception_handler(Exception, unhandled_handler)

# Expose standard production /health, /health/ready, /health/live probes at root
app.include_router(health.router)

API_V1 = "/api/v1"
for r in (forecast.router, ports.router, vessels.router, optimize.router,
          market.router, risks.router, sources.router, health.router, historical.router):
    app.include_router(r, prefix=API_V1)


@app.get("/", include_in_schema=False)
def root():
    return {"service": "SIH26006 Charter Intelligence API", "version": "1.0.0",
            "docs": "/docs", "openapi": "/openapi.json", "api": API_V1}
