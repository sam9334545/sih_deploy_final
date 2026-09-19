from __future__ import annotations

from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Port, PortTariff, Route, VesselClass, WeatherClimatology


def get_route(db: Session, origin: str, destination: str) -> Route | None:
    return db.execute(
        select(Route).where(Route.origin_port == origin, Route.destination_port == destination)
    ).scalars().first()


def get_vessel_class(db: Session, name: str) -> VesselClass | None:
    return db.get(VesselClass, name)


def all_vessel_classes(db: Session) -> list[VesselClass]:
    return db.execute(select(VesselClass).order_by(VesselClass.ref_dwt)).scalars().all()


def all_ports(db: Session, country: str | None = None, role: str | None = None) -> list[Port]:
    stmt = select(Port).order_by(Port.country, Port.port_name)
    if country:
        stmt = stmt.where(Port.country == country)
    if role:
        stmt = stmt.where(or_(Port.role == role, Port.role == "both"))
    return db.execute(stmt).scalars().all()


def tariffs(db: Session, port_id: str, on: date) -> list[PortTariff]:
    rows = db.execute(select(PortTariff).where(PortTariff.port_id == port_id)).scalars().all()
    return [t for t in rows
            if t.effective_from <= on and (t.effective_to is None or on <= t.effective_to)]


def weather(db: Session, port_id: str, month: int) -> WeatherClimatology | None:
    return db.get(WeatherClimatology, (port_id, month))
