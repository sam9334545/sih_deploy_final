from __future__ import annotations

from datetime import date

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import InvalidInput, NotFound
from app.models import Port
from app.services.constants import VESSEL_CLASSES


def resolve_as_of(requested: date | str | None) -> date:
    """DEMO_AS_OF freezes the clock so a demo is reproducible; otherwise today."""
    if requested:
        if isinstance(requested, str):
            return date.fromisoformat(requested)
        return requested
    return settings.demo_as_of if settings.demo_mode else date.today()


def rid(request: Request) -> str:
    return request.state.request_id


def require_port(db: Session, port_id: str) -> Port:
    port = db.get(Port, port_id.upper())
    if port is None:
        known = [p.port_id for p in db.query(Port).all()]
        raise NotFound(f"Unknown port '{port_id}'", field="port_id",
                       hint="Call GET /api/v1/ports for the registry", allowed=known)
    return port


def require_vessel_class(name: str) -> str:
    if name not in VESSEL_CLASSES:
        raise InvalidInput(f"Unknown vessel class '{name}'", field="vessel_class",
                           allowed=VESSEL_CLASSES,
                           hint="We model the four Baltic standard classes")
    return name


DbSession = Depends(get_db)
