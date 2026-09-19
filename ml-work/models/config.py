"""
Configuration parameters for Phase 4 forecasting benchmarks, baselines, and ML models.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any

@dataclass
class ModelConfig:
    # Deterministic seed for reproducible benchmarks
    random_state: int = 42
    
    # Target Baltic dry-bulk sub-indices
    target_indices: List[str] = field(
        default_factory=lambda: ["BPI", "BCI", "BSI", "BHSI"]
    )
    
    # Target column mapping in processed multivariate dataset
    target_column_map: Dict[str, str] = field(
        default_factory=lambda: {
            "BPI": "bpi_value",
            "BCI": "bci_value",
            "BSI": "bsi_value",
            "BHSI": "bhsi_value"
        }
    )
    
    # Forecast horizons (discrete Baltic exchange trading sessions)
    horizons: List[int] = field(
        default_factory=lambda: [7, 14, 28, 60, 90, 180]
    )
    
    # Historical benchmark split dates
    warmup_start: str = "2012-08-01"
    warmup_end: str = "2012-12-10"
    train_start: str = "2012-12-11"
    train_end: str = "2017-07-31"
    val_start: str = "2017-08-01"
    val_end: str = "2018-07-31"
    test_start: str = "2018-08-01"
    test_end: str = "2019-07-31"
    
    # Seasonal period (discrete trading sessions per calendar year)
    seasonal_period_trading_sessions: int = 250
    
    # Moving average windows
    ma_windows: List[int] = field(default_factory=lambda: [7, 30])
    
    # Damped drift parameters
    drift_lookback: int = 30
    drift_damping_factor: float = 0.95
    
    # Ridge regression alpha tuning grid
    ridge_alphas: List[float] = field(
        default_factory=lambda: [0.01, 0.1, 1.0, 10.0, 100.0]
    )
    
    # LightGBM default conservative parameters
    lgb_params: Dict[str, Any] = field(
        default_factory=lambda: {
            "objective": "regression",
            "n_estimators": 300,
            "learning_rate": 0.03,
            "num_leaves": 15,
            "max_depth": 5,
            "min_child_samples": 20,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "random_state": 42,
            "n_jobs": 1,
            "verbose": -1
        }
    )
    
    # SARIMA default order and fallback orders
    sarima_order: tuple = (1, 1, 1)
    sarima_fallback_order: tuple = (1, 1, 0)
    sarima_trend: str = "c"
