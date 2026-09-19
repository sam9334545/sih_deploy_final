from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

CODES = ("invalid_input", "infeasible_request", "no_model", "stale_data",
         "not_found", "internal_error")


class ApiError(Exception):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "invalid_input"

    def __init__(self, message: str, *, field: str | None = None, hint: str | None = None,
                 allowed: list[Any] | None = None, as_of: date | None = None,
                 payload: dict | None = None, status_code: int | None = None,
                 code: str | None = None):
        self.message = message
        self.field = field
        self.hint = hint
        self.allowed = allowed
        self.as_of = as_of
        self.payload = payload or {}
        if status_code:
            self.status_code = status_code
        if code:
            self.code = code
        super().__init__(message)


class InvalidInput(ApiError):
    status_code = 400
    code = "invalid_input"


class NotFound(ApiError):
    status_code = 404
    code = "not_found"


class NoModel(ApiError):
    status_code = 404
    code = "no_model"


class StaleData(ApiError):
    status_code = 503
    code = "stale_data"


class InfeasibleRequestError(ApiError):
    """A success-shaped failure: 'nothing can serve this cargo' is a useful answer,
    so the body carries the per-class reasons rather than a bare error string."""
    status_code = 422
    code = "infeasible_request"


def request_id(request: Request | None = None) -> str:
    if request is not None:
        rid = getattr(request.state, "request_id", None)
        if rid:
            return rid
    return str(uuid.uuid4())


def envelope(exc: ApiError, rid: str) -> dict:
    body = {"error": exc.code, "message": exc.message, "request_id": rid}
    if exc.field:
        body["field"] = exc.field
    if exc.hint:
        body["hint"] = exc.hint
    if exc.allowed:
        body["allowed"] = exc.allowed
    if exc.as_of:
        body["as_of"] = exc.as_of.isoformat()
    body.update(exc.payload)
    return body


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code,
                        content=envelope(exc, request_id(request)))


async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    loc = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query"))
    return JSONResponse(status_code=400, content={
        "error": "invalid_input",
        "message": first.get("msg", "Request failed validation"),
        "field": loc or None,
        "request_id": request_id(request),
        "hint": "Check the field against the OpenAPI schema at /docs",
    })


async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={
        "error": "internal_error",
        "message": "An unexpected error occurred while serving this request",
        "request_id": request_id(request),
        "hint": "Quote the request_id when reporting this",
    })
