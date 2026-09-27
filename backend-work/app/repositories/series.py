from __future__ import annotations

from datetime import date, timedelta

import numpy as np
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CommodityPrice, FreightIndex


def index_history(db: Session, index_code: str, as_of: date, lookback_days: int = 2200):
    rows = db.execute(
        select(FreightIndex.obs_date, FreightIndex.value, FreightIndex.tc_avg_usd_day)
        .where(FreightIndex.index_code == index_code,
               FreightIndex.obs_date <= as_of,
               FreightIndex.obs_date >= as_of - timedelta(days=lookback_days))
        .order_by(FreightIndex.obs_date)
    ).all()
    dates = [r.obs_date for r in rows]
    values = np.asarray([float(r.value) for r in rows])
    tc = np.asarray([float(r.tc_avg_usd_day) if r.tc_avg_usd_day else np.nan for r in rows])
    t = np.asarray([(d - dates[0]).days for d in dates], dtype=float) if dates else np.asarray([])
    return dates, values, tc, t


def latest_index(db: Session, index_code: str, as_of: date):
    return db.execute(
        select(FreightIndex).where(FreightIndex.index_code == index_code,
                                   FreightIndex.obs_date <= as_of)
        .order_by(FreightIndex.obs_date.desc()).limit(1)
    ).scalars().first()


def series_history(db: Session, series_code: str, as_of: date, lookback_days: int = 800):
    """Respects `available_from` so a feature can never see a number before it was published."""
    rows = db.execute(
        select(CommodityPrice.obs_date, CommodityPrice.value)
        .where(CommodityPrice.series_code == series_code,
               CommodityPrice.available_from <= as_of,
               CommodityPrice.obs_date >= as_of - timedelta(days=lookback_days))
        .order_by(CommodityPrice.obs_date)
    ).all()
    return [r.obs_date for r in rows], np.asarray([float(r.value) for r in rows])


def latest_value(db: Session, series_code: str, as_of: date) -> tuple[date | None, float | None]:
    row = db.execute(
        select(CommodityPrice).where(CommodityPrice.series_code == series_code,
                                     CommodityPrice.available_from <= as_of)
        .order_by(CommodityPrice.obs_date.desc()).limit(1)
    ).scalars().first()
    return (row.obs_date, float(row.value)) if row else (None, None)


def realised_vol(values: np.ndarray, window: int = 20) -> float:
    if len(values) < window + 2:
        return 0.0
    lr = np.diff(np.log(values[-(window + 1):]))
    return float(lr.std() * np.sqrt(252))


def vol_percentile(values: np.ndarray, window: int = 20, lookback: int = 500) -> float:
    if len(values) < window + 60:
        return 0.5
    lr = np.diff(np.log(values))
    rolling = np.asarray([lr[i - window:i].std() for i in range(window, len(lr))])
    rolling = rolling[-lookback:]
    return float((rolling <= rolling[-1]).mean())


def pct_change(values: np.ndarray, days: int) -> float | None:
    if len(values) <= days:
        return None
    return round(float((values[-1] / values[-1 - days] - 1) * 100), 2)


_KNOWN = {"measured", "derived", "estimated", "simulated_demo", "expert_set",
          "synthetic_postcovid", "mixed", "unknown"}


def history_provenance(db: Session, index_code: str, as_of: date) -> tuple[str, dict[str, int]]:
    """What the served history actually is, rather than what DEMO_MODE assumes.

    A mixed series reports the mix, because a card that says 'measured' over rows
    that are partly synthetic is the kind of small lie that loses a jury.
    """
    rows = db.execute(
        select(FreightIndex.provenance, func.count())
        .where(FreightIndex.index_code == index_code, FreightIndex.obs_date <= as_of)
        .group_by(FreightIndex.provenance)
    ).all()
    if not rows:
        return "unknown", {}
    tags = {p: int(n) for p, n in rows}
    if len(tags) == 1:
        only = next(iter(tags))
        label = "measured" if only.startswith("verified_real") else only
        return (label if label in _KNOWN else "unknown"), tags
    return "mixed", tags
