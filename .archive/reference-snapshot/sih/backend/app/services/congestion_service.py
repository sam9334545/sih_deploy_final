"""Waiting-time distributions from observed port calls — blueprint §28.2.

The discharge-port waiting time is bootstrapped from the port's own published
daily traffic records, stratified by month and vessel class. That is the single
most valuable thing in the simulator, so it is deliberately non-parametric: we
resample observations rather than assume a shape.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PortCall

_MIN_SAMPLE = 25


@dataclass(slots=True)
class WaitPool:
    port_id: str
    vessel_class: str | None
    month: int | None
    samples: np.ndarray
    strata: str          # how much stratification survived the sample-size floor
    sample_days: int

    @property
    def p50(self) -> float:
        return float(np.percentile(self.samples, 50))

    @property
    def p90(self) -> float:
        return float(np.percentile(self.samples, 90))

    @property
    def mean(self) -> float:
        return float(self.samples.mean())

    def draw(self, rng: np.random.Generator, size: int = 1) -> np.ndarray:
        return rng.choice(self.samples, size=size, replace=True)


def _fetch(db: Session, port_id: str, vessel_class: str | None, month: int | None) -> list[float]:
    stmt = select(PortCall.waiting_hours, PortCall.report_date).where(
        PortCall.port_id == port_id, PortCall.waiting_hours.is_not(None)
    )
    if vessel_class:
        stmt = stmt.where(PortCall.vessel_class == vessel_class)
    rows = db.execute(stmt).all()
    if month:
        rows = [r for r in rows if r.report_date.month == month]
    return [float(r.waiting_hours) for r in rows]


def wait_pool(db: Session, port_id: str, vessel_class: str | None = None,
              month: int | None = None) -> WaitPool:
    """Back off stratification until the sample is large enough to resample from."""
    for vc, mo, label in (
        (vessel_class, month, "port+class+month"),
        (vessel_class, None, "port+class"),
        (None, month, "port+month"),
        (None, None, "port"),
    ):
        vals = _fetch(db, port_id, vc, mo)
        if len(vals) >= _MIN_SAMPLE:
            return WaitPool(port_id, vc, mo, np.asarray(vals, dtype=float), label, len(vals))
    vals = _fetch(db, port_id, None, None)
    if not vals:
        # No record at all: fall back to a flat 24 h with a wide spread, and say so.
        return WaitPool(port_id, None, None, np.asarray([12.0, 24.0, 48.0, 96.0]), "default_prior", 0)
    return WaitPool(port_id, None, None, np.asarray(vals, dtype=float), "port", len(vals))


def port_month_median(db: Session, port_id: str, month: int) -> float:
    """Reference level the Port risk component is measured against."""
    return wait_pool(db, port_id, None, month).p50


def port_baseline_median(db: Session, port_id: str) -> float:
    return wait_pool(db, port_id).p50


def queue_pressure_z(db: Session, port_id: str, vessel_class: str, month: int) -> float:
    """z of expected wait vs this port's all-month distribution of monthly medians."""
    monthly = [wait_pool(db, port_id, None, m).p50 for m in range(1, 13)]
    arr = np.asarray(monthly, dtype=float)
    sd = float(arr.std()) or 1.0
    here = wait_pool(db, port_id, vessel_class, month).p50
    return float((here - arr.mean()) / sd)
