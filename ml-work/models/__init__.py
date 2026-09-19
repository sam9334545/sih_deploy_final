"""
Forecasting models, baselines, and probabilistic evaluation package for SIH26006.
"""
from .config import ModelConfig
from .evaluation import (
    calculate_mae,
    calculate_rmse,
    calculate_mape,
    calculate_mase,
    calculate_directional_accuracy,
    calculate_directional_metrics,
    calculate_naive_scale,
    evaluate_predictions
)
from .baselines import (
    NaivePersistence,
    SeasonalNaive,
    MovingAverage,
    DampedDrift
)
from .ridge_model import RidgeForecaster, tune_ridge_alpha
from .sarima_model import ArimaForecaster, SarimaForecaster
from .lightgbm_model import LightGBMForecaster
from .walk_forward import run_benchmark_for_target_horizon
from .quantile_lightgbm import (
    QuantileLightGBMForecaster,
    TripletQuantileForecaster,
    detect_quantile_crossings,
    enforce_monotonic_quantiles
)
from .conformal import SplitConformalCalibrator
from .probabilistic_evaluation import (
    calculate_pinball_loss,
    calculate_interval_coverage,
    calculate_interval_width,
    evaluate_probabilistic_forecasts
)

__all__ = [
    "ModelConfig",
    "calculate_mae",
    "calculate_rmse",
    "calculate_mape",
    "calculate_mase",
    "calculate_directional_accuracy",
    "calculate_directional_metrics",
    "calculate_naive_scale",
    "evaluate_predictions",
    "NaivePersistence",
    "SeasonalNaive",
    "MovingAverage",
    "DampedDrift",
    "RidgeForecaster",
    "tune_ridge_alpha",
    "ArimaForecaster",
    "SarimaForecaster",
    "LightGBMForecaster",
    "run_benchmark_for_target_horizon",
    "QuantileLightGBMForecaster",
    "TripletQuantileForecaster",
    "detect_quantile_crossings",
    "enforce_monotonic_quantiles",
    "SplitConformalCalibrator",
    "calculate_pinball_loss",
    "calculate_interval_coverage",
    "calculate_interval_width",
    "evaluate_probabilistic_forecasts"
]
