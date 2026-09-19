"""
SIH26006 Modular Feature Engineering & Supervised Forecasting Dataset Pipeline.
"""

from .config import FeatureConfig
from .builder import build_features_for_row, build_feature_matrix
from .targets import create_supervised_forecasting_dataset, generate_all_forecasting_datasets
from .validation import verify_anti_leakage, get_time_aware_splits, walk_forward_folds

__all__ = [
    "FeatureConfig",
    "build_features_for_row",
    "build_feature_matrix",
    "create_supervised_forecasting_dataset",
    "generate_all_forecasting_datasets",
    "verify_anti_leakage",
    "get_time_aware_splits",
    "walk_forward_folds",
]
