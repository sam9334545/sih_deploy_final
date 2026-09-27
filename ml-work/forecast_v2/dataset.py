"""Feature construction and supervised targets.

The forecast target is the h-session log return, y = log(P[t+h]) − log(P[t]).
Modelling the return rather than the level keeps the series stationary, makes the
loss scale-free across indices whose levels differ by an order of magnitude, and
makes the naive forecast exactly y = 0 — so any skill the model has is visible.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

INDEX_COLS = ["bpi_value", "bci_value", "bsi_value", "bhsi_value"]
INDEX_CODE = {"bpi_value": "BPI", "bci_value": "BCI", "bsi_value": "BSI", "bhsi_value": "BHSI"}


@dataclass(frozen=True)
class FeatureSpec:
    lags: tuple[int, ...] = (1, 2, 3, 5, 7, 10, 14, 21, 30, 60)
    rolls: tuple[int, ...] = (7, 14, 30, 60, 90)
    momentum: tuple[int, ...] = (1, 5, 10, 21, 63)
    cross_lags: tuple[int, ...] = (0, 1, 7)
    fourier_k: int = 3
    vol_windows: tuple[int, ...] = (10, 21, 63)
    extreme_windows: tuple[int, ...] = (63, 252)

    @property
    def warmup(self) -> int:
        return max(max(self.lags), max(self.rolls), max(self.extreme_windows)) + 5


def load_real(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, parse_dates=["obs_date"]).sort_values("obs_date")
    df = df.drop_duplicates("obs_date").reset_index(drop=True)
    return df[["obs_date", *INDEX_COLS]]


def build_features(df: pd.DataFrame, target_col: str, spec: FeatureSpec = FeatureSpec()) -> pd.DataFrame:
    """One row per origin session. Every column uses information up to that session only."""
    out = pd.DataFrame(index=df.index)
    out["obs_date"] = df["obs_date"].to_numpy()

    log_px = {c: np.log(df[c].to_numpy(dtype=float)) for c in INDEX_COLS}
    y = log_px[target_col]
    ret1 = pd.Series(y).diff()

    # NOTE: the raw log level is deliberately NOT a feature. It is non-stationary,
    # and a linear model handed it will "revert" every forecast toward the mean of
    # the training window — which is why the first benchmark had ridge scoring 17%
    # worse than persistence. Level information enters only through stationary
    # transforms: deviation from moving averages, drawdown, and range position.

    # ── own-index momentum: the dominant signal in an assessed index ──
    for l in spec.lags:
        out[f"logret_lag_{l}"] = pd.Series(y).diff(l).to_numpy()
    for m in spec.momentum:
        out[f"mom_{m}"] = (pd.Series(y) - pd.Series(y).shift(m)).to_numpy()
        out[f"ret1_ma_{m}"] = ret1.rolling(m).mean().to_numpy()

    # ── level relative to its own recent history ──
    for w in spec.rolls:
        ma = pd.Series(y).rolling(w).mean()
        out[f"dev_ma_{w}"] = (pd.Series(y) - ma).to_numpy()
        out[f"slope_{w}"] = (ma - ma.shift(w)).to_numpy()

    # ── volatility and regime ──
    for w in spec.vol_windows:
        vol = ret1.rolling(w).std()
        out[f"vol_{w}"] = vol.to_numpy()
        out[f"vol_pctile_{w}"] = vol.rolling(252, min_periods=60).rank(pct=True).to_numpy()
    out["vol_ratio_10_63"] = (ret1.rolling(10).std() / ret1.rolling(63).std()).to_numpy()

    for w in spec.extreme_windows:
        hi = pd.Series(y).rolling(w).max()
        lo = pd.Series(y).rolling(w).min()
        out[f"drawdown_{w}"] = (pd.Series(y) - hi).to_numpy()
        out[f"runup_{w}"] = (pd.Series(y) - lo).to_numpy()
        out[f"range_pos_{w}"] = ((pd.Series(y) - lo) / (hi - lo)).to_numpy()

    # ── cross-index structure: the four classes share a market factor, and the
    #    spreads between them lead each other (Cape softness bleeds into Panamax) ──
    for other in INDEX_COLS:
        if other == target_col:
            continue
        o = log_px[other]
        tag = INDEX_CODE[other].lower()
        spread = pd.Series(y - o)
        for l in spec.cross_lags:
            out[f"spread_{tag}_lag_{l}"] = spread.shift(l).to_numpy()
        out[f"spread_{tag}_dev_60"] = (spread - spread.rolling(60).mean()).to_numpy()
        out[f"{tag}_ret_5"] = pd.Series(o).diff(5).to_numpy()
        out[f"{tag}_ret_21"] = pd.Series(o).diff(21).to_numpy()
        out[f"{tag}_vol_21"] = pd.Series(o).diff().rolling(21).std().to_numpy()

    # market breadth: how many of the four are rising
    breadth = np.zeros(len(df))
    for c in INDEX_COLS:
        breadth += (pd.Series(log_px[c]).diff(5) > 0).to_numpy().astype(float)
    out["breadth_5"] = breadth / len(INDEX_COLS)

    # ── calendar ──
    doy = df["obs_date"].dt.dayofyear.to_numpy() / 365.25
    for k in range(1, spec.fourier_k + 1):
        out[f"sin_{k}y"] = np.sin(2 * np.pi * k * doy)
        out[f"cos_{k}y"] = np.cos(2 * np.pi * k * doy)
    out["dow"] = df["obs_date"].dt.dayofweek.to_numpy()
    out["month"] = df["obs_date"].dt.month.to_numpy()

    return out


def supervised(df: pd.DataFrame, target_col: str, horizon: int,
               spec: FeatureSpec = FeatureSpec()) -> pd.DataFrame:
    """Attach the h-session-ahead target to each origin, dropping unusable rows."""
    feats = build_features(df, target_col, spec)
    level = df[target_col].to_numpy(dtype=float)
    y = np.log(level)

    n = len(df)
    tgt_ret = np.full(n, np.nan)
    tgt_level = np.full(n, np.nan)
    tgt_date = np.full(n, np.datetime64("NaT", "ns"), dtype="datetime64[ns]")
    idx = np.arange(n - horizon)
    tgt_ret[idx] = y[idx + horizon] - y[idx]
    tgt_level[idx] = level[idx + horizon]
    tgt_date[idx] = df["obs_date"].to_numpy()[idx + horizon]

    feats = feats.assign(origin_level=level, target_logret=tgt_ret,
                         target_level=tgt_level, target_date=tgt_date)
    feats = feats.iloc[spec.warmup:].copy()
    feats = feats[np.isfinite(feats["target_logret"])]
    return feats.replace([np.inf, -np.inf], np.nan).reset_index(drop=True)


def feature_columns(frame: pd.DataFrame) -> list[str]:
    drop = {"obs_date", "target_date", "target_logret", "target_level", "origin_level"}
    return [c for c in frame.columns if c not in drop]
