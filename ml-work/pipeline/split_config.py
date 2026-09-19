"""
Temporal Split Configuration for SIH26006.
Maintains strict chronological separation and test-set isolation.

Partitions:
1. Historical Development Split (2012–2019)
   - Warmup:     2012-08-01 -> 2012-12-10
   - Train:      2012-12-11 -> 2017-07-31
   - Validation: 2017-08-01 -> 2018-07-31
   - Test:       2018-08-01 -> 2019-07-31

2. Final Production Extended Split (2015–present) [Section 22 & 23]
   - Train:      2015-01-01 -> 2022-12-31 (Model fitting)
   - Validation: 2023-01-01 -> 2024-12-31 (Model selection & Conformal Calibration)
   - Test:       2025-01-01 -> present (Frozen final evaluation only)
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Tuple
import pandas as pd


@dataclass(frozen=True)
class TemporalSplitWindow:
    name: str
    train_start: str
    train_end: str
    val_start: str
    val_end: str
    test_start: str
    test_end: str

    def assign_split(self, date_series: pd.Series) -> pd.Series:
        """
        Assign each date in the series strictly to 'train', 'val', 'test', or 'warmup'/'unassigned'.
        Zero shuffling, zero overlap.
        """
        dates = pd.to_datetime(date_series).dt.strftime("%Y-%m-%d")
        split_col = pd.Series("unassigned", index=date_series.index)
        
        split_col[(dates >= self.train_start) & (dates <= self.train_end)] = "train"
        split_col[(dates >= self.val_start) & (dates <= self.val_end)] = "val"
        split_col[(dates >= self.test_start) & (dates <= self.test_end)] = "test"
        return split_col

    def validate_non_overlapping(self):
        """Assert strict chronological ordering between train, val, and test."""
        t_end = datetime.strptime(self.train_end, "%Y-%m-%d")
        v_start = datetime.strptime(self.val_start, "%Y-%m-%d")
        v_end = datetime.strptime(self.val_end, "%Y-%m-%d")
        te_start = datetime.strptime(self.test_start, "%Y-%m-%d")

        assert t_end < v_start, f"Train end ({self.train_end}) must be strictly before Val start ({self.val_start})"
        assert v_end < te_start, f"Val end ({self.val_end}) must be strictly before Test start ({self.test_start})"


# 1. Verified Historical Baseline Split (Phase 4–6B)
HISTORICAL_SPLIT = TemporalSplitWindow(
    name="historical_development_2012_2019",
    train_start="2012-12-11",
    train_end="2017-07-31",
    val_start="2017-08-01",
    val_end="2018-07-31",
    test_start="2018-08-01",
    test_end="2019-07-31",
)
HISTORICAL_SPLIT.validate_non_overlapping()

# 2. Target Production Extended Split (Phase 7A Specification)
EXTENDED_PRODUCTION_SPLIT = TemporalSplitWindow(
    name="production_extended_2015_present",
    train_start="2015-01-01",
    train_end="2022-12-31",
    val_start="2023-01-01",
    val_end="2024-12-31",
    test_start="2025-01-01",
    test_end="2026-12-31",
)
EXTENDED_PRODUCTION_SPLIT.validate_non_overlapping()
