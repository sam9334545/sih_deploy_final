from typing import Dict, Any, List
import pandas as pd
import numpy as np
from .config import PipelineConfig

def validate_series(df: pd.DataFrame, config: PipelineConfig = None) -> Dict[str, Any]:
    """
    Perform statistical and structural validation on the cleaned series.
    Identifies outliers and jump discontinuities without dropping legitimate market moves.
    """
    if config is None:
        config = PipelineConfig()
        
    dates = pd.to_datetime(df["obs_date"])
    values = df["bpi_value"].values
    
    # 1. Calendar Continuity
    min_date = dates.min()
    max_date = dates.max()
    full_calendar_days = (max_date - min_date).days + 1
    
    # Expected business days
    expected_b_days = pd.date_range(start=min_date, end=max_date, freq="B")
    missing_b_days = expected_b_days.difference(dates)
    
    # 2. Statistical Outliers via IQR
    q25 = np.percentile(values, 25)
    q75 = np.percentile(values, 75)
    iqr = q75 - q25
    lower_bound = q25 - 1.5 * iqr
    upper_bound = q75 + 1.5 * iqr
    
    iqr_outliers = df[(df["bpi_value"] < lower_bound) | (df["bpi_value"] > upper_bound)]
    
    # 3. Daily Jump Discontinuities
    daily_returns = pd.Series(values).pct_change()
    jumps_mask = daily_returns.abs() > config.max_jump_pct_warning
    jump_indices = jumps_mask[jumps_mask].index
    
    jump_events: List[Dict[str, Any]] = []
    for idx in jump_indices:
        jump_events.append({
            "obs_date": df.iloc[idx]["obs_date"],
            "prev_value": float(df.iloc[idx - 1]["bpi_value"]),
            "curr_value": float(df.iloc[idx]["bpi_value"]),
            "pct_change": float(round(daily_returns.iloc[idx] * 100, 2))
        })
        
    return {
        "min_date": str(min_date.date()),
        "max_date": str(max_date.date()),
        "total_calendar_days": int(full_calendar_days),
        "actual_trading_days": len(df),
        "expected_business_days": len(expected_b_days),
        "missing_business_days_count": len(missing_b_days),
        "min_bpi": float(values.min()),
        "max_bpi": float(values.max()),
        "mean_bpi": float(round(values.mean(), 2)),
        "std_bpi": float(round(values.std(), 2)),
        "q25": float(round(q25, 2)),
        "q75": float(round(q75, 2)),
        "iqr_lower_bound": float(round(lower_bound, 2)),
        "iqr_upper_bound": float(round(upper_bound, 2)),
        "iqr_outliers_count": len(iqr_outliers),
        "iqr_outliers_retained": True,
        "jump_events_count": len(jump_events),
        "jump_events": jump_events
    }
