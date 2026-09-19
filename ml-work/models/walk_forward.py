"""
Walk-Forward Evaluation Engine for SIH26006 Phase 4.
Coordinates chronological evaluation across baselines, statistical models, and ML models.
"""
from typing import Dict, List, Any, Tuple, Optional
import numpy as np
import pandas as pd
from .config import ModelConfig
from .evaluation import (
    evaluate_predictions,
    calculate_naive_scale,
    calculate_mae
)
from .baselines import (
    NaivePersistence,
    SeasonalNaive,
    MovingAverage,
    DampedDrift
)
from .ridge_model import RidgeForecaster, tune_ridge_alpha
from .sarima_model import SarimaForecaster
from .lightgbm_model import LightGBMForecaster

def run_benchmark_for_target_horizon(
    feature_df: pd.DataFrame,
    raw_df: pd.DataFrame,
    target_name: str,
    horizon: int,
    config: Optional[ModelConfig] = None,
    precomputed_sarima_val: Optional[np.ndarray] = None,
    precomputed_sarima_test: Optional[np.ndarray] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Execute full Phase 4 benchmark for a single (target, horizon) combination.
    Returns:
      1. aggregate_results: List of metric summaries (one per model per split)
      2. fold_results: List of row-level prediction entries for fold stability analysis
    """
    if config is None:
        config = ModelConfig()
        
    target_col = config.target_column_map[target_name]
    raw_dates = pd.to_datetime(raw_df["obs_date"]).tolist()
    raw_series = raw_df[target_col].values
    
    # Metadata columns in feature dataset
    meta_cols = [
        "origin_date", "target_index", "horizon_sessions",
        "target_date", "calendar_days_elapsed", "target_value",
        "target_log_return", "split_set"
    ]
    feat_cols = [c for c in feature_df.columns if c not in meta_cols]
    
    # Chronological splits
    train_mask = feature_df["split_set"] == "train"
    val_mask = feature_df["split_set"] == "val"
    test_mask = feature_df["split_set"] == "test"
    
    train_df = feature_df[train_mask].copy().reset_index(drop=True)
    val_df = feature_df[val_mask].copy().reset_index(drop=True)
    test_df = feature_df[test_mask].copy().reset_index(drop=True)
    train_val_df = pd.concat([train_df, val_df], ignore_index=True)
    
    # Compute in-sample training naive scale for MASE
    y_train_raw = raw_df[raw_df["obs_date"] <= config.train_end][target_col].values
    training_naive_scale = calculate_naive_scale(y_train_raw)
    
    # Pre-map origin dates to raw_df integer indices for baseline algorithms
    val_origin_dates = pd.to_datetime(val_df["origin_date"]).tolist()
    test_origin_dates = pd.to_datetime(test_df["origin_date"]).tolist()
    
    date_to_idx = {d: i for i, d in enumerate(raw_dates)}
    val_origin_indices = np.array([date_to_idx[d] for d in val_origin_dates])
    test_origin_indices = np.array([date_to_idx[d] for d in test_origin_dates])
    
    aggregate_results = []
    prediction_records = []
    
    # -------------------------------------------------------------
    # Step 1: Baseline Models
    # -------------------------------------------------------------
    baselines = {
        "naive_persistence": NaivePersistence(),
        "seasonal_naive": SeasonalNaive(seasonal_period=config.seasonal_period_trading_sessions),
        "moving_average_7": MovingAverage(window=7),
        "moving_average_30": MovingAverage(window=30),
        "damped_drift": DampedDrift(
            lookback=config.drift_lookback,
            damping_factor=config.drift_damping_factor
        )
    }
    
    for model_name, baseline in baselines.items():
        # Validation predictions
        if model_name == "naive_persistence":
            val_preds = baseline.predict(val_df["current_known_level"].values, horizon)
            test_preds = baseline.predict(test_df["current_known_level"].values, horizon)
        elif model_name == "seasonal_naive":
            val_preds = baseline.predict_series(raw_series, val_origin_indices, horizon)
            test_preds = baseline.predict_series(raw_series, test_origin_indices, horizon)
        elif "moving_average" in model_name:
            val_preds = baseline.predict_series(raw_series, val_origin_indices)
            test_preds = baseline.predict_series(raw_series, test_origin_indices)
        elif model_name == "damped_drift":
            val_preds = baseline.predict_series(raw_series, val_origin_indices, horizon)
            test_preds = baseline.predict_series(raw_series, test_origin_indices, horizon)
            
        # Evaluate Validation
        val_metrics = evaluate_predictions(
            y_origin=val_df["current_known_level"].values,
            y_true=val_df["target_value"].values,
            y_pred=val_preds,
            training_naive_scale=training_naive_scale
        )
        val_metrics.update({
            "target": target_name,
            "horizon": horizon,
            "model": model_name,
            "split": "val",
            "failed_folds": 0
        })
        aggregate_results.append(val_metrics)
        
        # Record validation predictions
        for i, row in val_df.iterrows():
            prediction_records.append({
                "target": target_name,
                "horizon": horizon,
                "model": model_name,
                "split": "val",
                "fold": 1,
                "train_start": config.train_start,
                "train_end": config.train_end,
                "origin_date": row["origin_date"],
                "target_date": row["target_date"],
                "actual": float(row["target_value"]),
                "prediction": float(val_preds[i]),
                "mae": abs(float(row["target_value"]) - float(val_preds[i])),
                "absolute_error": abs(float(row["target_value"]) - float(val_preds[i])),
                "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(val_preds[i]) - float(row["current_known_level"])))
            })
            
        # Evaluate Test
        test_metrics = evaluate_predictions(
            y_origin=test_df["current_known_level"].values,
            y_true=test_df["target_value"].values,
            y_pred=test_preds,
            training_naive_scale=training_naive_scale
        )
        test_metrics.update({
            "target": target_name,
            "horizon": horizon,
            "model": model_name,
            "split": "test",
            "failed_folds": 0
        })
        aggregate_results.append(test_metrics)
        
        # Record test predictions
        for i, row in test_df.iterrows():
            prediction_records.append({
                "target": target_name,
                "horizon": horizon,
                "model": model_name,
                "split": "test",
                "fold": 1,
                "train_start": config.train_start,
                "train_end": config.val_end,
                "origin_date": row["origin_date"],
                "target_date": row["target_date"],
                "actual": float(row["target_value"]),
                "prediction": float(test_preds[i]),
                "mae": abs(float(row["target_value"]) - float(test_preds[i])),
                "absolute_error": abs(float(row["target_value"]) - float(test_preds[i])),
                "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(test_preds[i]) - float(row["current_known_level"])))
            })

    # -------------------------------------------------------------
    # Step 2: Ridge Regression
    # -------------------------------------------------------------
    # Tune alpha on validation split
    best_alpha, _ = tune_ridge_alpha(
        X_train=train_df[feat_cols],
        y_train=train_df["target_value"],
        X_val=val_df[feat_cols],
        y_val=val_df["target_value"],
        alphas=config.ridge_alphas,
        random_state=config.random_state
    )
    
    # Train on Train, evaluate on Validation
    ridge_val_model = RidgeForecaster(alpha=best_alpha, random_state=config.random_state)
    ridge_val_model.fit(train_df[feat_cols], train_df["target_value"])
    val_preds_ridge = ridge_val_model.predict(val_df[feat_cols])
    
    val_metrics_ridge = evaluate_predictions(
        y_origin=val_df["current_known_level"].values,
        y_true=val_df["target_value"].values,
        y_pred=val_preds_ridge,
        training_naive_scale=training_naive_scale
    )
    val_metrics_ridge.update({
        "target": target_name,
        "horizon": horizon,
        "model": "ridge",
        "split": "val",
        "failed_folds": 0
    })
    aggregate_results.append(val_metrics_ridge)
    
    for i, row in val_df.iterrows():
        prediction_records.append({
            "target": target_name,
            "horizon": horizon,
            "model": "ridge",
            "split": "val",
            "fold": 1,
            "train_start": config.train_start,
            "train_end": config.train_end,
            "origin_date": row["origin_date"],
            "target_date": row["target_date"],
            "actual": float(row["target_value"]),
            "prediction": float(val_preds_ridge[i]),
            "mae": abs(float(row["target_value"]) - float(val_preds_ridge[i])),
            "absolute_error": abs(float(row["target_value"]) - float(val_preds_ridge[i])),
            "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(val_preds_ridge[i]) - float(row["current_known_level"])))
        })
        
    # Retrain on (Train + Validation) with frozen best_alpha, evaluate on Test
    ridge_test_model = RidgeForecaster(alpha=best_alpha, random_state=config.random_state)
    ridge_test_model.fit(train_val_df[feat_cols], train_val_df["target_value"])
    test_preds_ridge = ridge_test_model.predict(test_df[feat_cols])
    
    test_metrics_ridge = evaluate_predictions(
        y_origin=test_df["current_known_level"].values,
        y_true=test_df["target_value"].values,
        y_pred=test_preds_ridge,
        training_naive_scale=training_naive_scale
    )
    test_metrics_ridge.update({
        "target": target_name,
        "horizon": horizon,
        "model": "ridge",
        "split": "test",
        "failed_folds": 0
    })
    aggregate_results.append(test_metrics_ridge)
    
    for i, row in test_df.iterrows():
        prediction_records.append({
            "target": target_name,
            "horizon": horizon,
            "model": "ridge",
            "split": "test",
            "fold": 1,
            "train_start": config.train_start,
            "train_end": config.val_end,
            "origin_date": row["origin_date"],
            "target_date": row["target_date"],
            "actual": float(row["target_value"]),
            "prediction": float(test_preds_ridge[i]),
            "mae": abs(float(row["target_value"]) - float(test_preds_ridge[i])),
            "absolute_error": abs(float(row["target_value"]) - float(test_preds_ridge[i])),
            "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(test_preds_ridge[i]) - float(row["current_known_level"])))
        })

    # -------------------------------------------------------------
    # Step 3: LightGBM GBDT
    # -------------------------------------------------------------
    lgb_val_model = LightGBMForecaster(params=config.lgb_params)
    lgb_val_model.fit(train_df[feat_cols], train_df["target_value"])
    val_preds_lgb = lgb_val_model.predict(val_df[feat_cols])
    
    val_metrics_lgb = evaluate_predictions(
        y_origin=val_df["current_known_level"].values,
        y_true=val_df["target_value"].values,
        y_pred=val_preds_lgb,
        training_naive_scale=training_naive_scale
    )
    val_metrics_lgb.update({
        "target": target_name,
        "horizon": horizon,
        "model": "lightgbm",
        "split": "val",
        "failed_folds": 0
    })
    aggregate_results.append(val_metrics_lgb)
    
    for i, row in val_df.iterrows():
        prediction_records.append({
            "target": target_name,
            "horizon": horizon,
            "model": "lightgbm",
            "split": "val",
            "fold": 1,
            "train_start": config.train_start,
            "train_end": config.train_end,
            "origin_date": row["origin_date"],
            "target_date": row["target_date"],
            "actual": float(row["target_value"]),
            "prediction": float(val_preds_lgb[i]),
            "mae": abs(float(row["target_value"]) - float(val_preds_lgb[i])),
            "absolute_error": abs(float(row["target_value"]) - float(val_preds_lgb[i])),
            "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(val_preds_lgb[i]) - float(row["current_known_level"])))
        })
        
    # Retrain on (Train + Validation) with frozen params, evaluate on Test
    lgb_test_model = LightGBMForecaster(params=config.lgb_params)
    lgb_test_model.fit(train_val_df[feat_cols], train_val_df["target_value"])
    test_preds_lgb = lgb_test_model.predict(test_df[feat_cols])
    
    test_metrics_lgb = evaluate_predictions(
        y_origin=test_df["current_known_level"].values,
        y_true=test_df["target_value"].values,
        y_pred=test_preds_lgb,
        training_naive_scale=training_naive_scale
    )
    test_metrics_lgb.update({
        "target": target_name,
        "horizon": horizon,
        "model": "lightgbm",
        "split": "test",
        "failed_folds": 0
    })
    aggregate_results.append(test_metrics_lgb)
    
    for i, row in test_df.iterrows():
        prediction_records.append({
            "target": target_name,
            "horizon": horizon,
            "model": "lightgbm",
            "split": "test",
            "fold": 1,
            "train_start": config.train_start,
            "train_end": config.val_end,
            "origin_date": row["origin_date"],
            "target_date": row["target_date"],
            "actual": float(row["target_value"]),
            "prediction": float(test_preds_lgb[i]),
            "mae": abs(float(row["target_value"]) - float(test_preds_lgb[i])),
            "absolute_error": abs(float(row["target_value"]) - float(test_preds_lgb[i])),
            "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(test_preds_lgb[i]) - float(row["current_known_level"])))
        })

    # -------------------------------------------------------------
    # Step 4: ARIMA(1,1,1) Univariate Benchmark
    # -------------------------------------------------------------
    # Use precomputed multi-horizon forecasts if available, otherwise compute dynamically
    arima_model = SarimaForecaster(
        order=config.sarima_order,
        fallback_order=config.sarima_fallback_order,
        trend=config.sarima_trend
    )
    
    if precomputed_sarima_val is not None:
        val_preds_sarima = precomputed_sarima_val
    else:
        val_preds_sarima = arima_model.forecast_series(raw_series, val_origin_indices, horizon)
        
    val_metrics_sarima = evaluate_predictions(
        y_origin=val_df["current_known_level"].values,
        y_true=val_df["target_value"].values,
        y_pred=val_preds_sarima,
        training_naive_scale=training_naive_scale
    )
    val_metrics_sarima.update({
        "target": target_name,
        "horizon": horizon,
        "model": "arima_111",
        "split": "val",
        "failed_folds": arima_model.failed_fits
    })
    aggregate_results.append(val_metrics_sarima)
    
    for i, row in val_df.iterrows():
        prediction_records.append({
            "target": target_name,
            "horizon": horizon,
            "model": "arima_111",
            "split": "val",
            "fold": 1,
            "train_start": config.train_start,
            "train_end": config.train_end,
            "origin_date": row["origin_date"],
            "target_date": row["target_date"],
            "actual": float(row["target_value"]),
            "prediction": float(val_preds_sarima[i]),
            "mae": abs(float(row["target_value"]) - float(val_preds_sarima[i])),
            "absolute_error": abs(float(row["target_value"]) - float(val_preds_sarima[i])),
            "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(val_preds_sarima[i]) - float(row["current_known_level"])))
        })
        
    # For test origins
    if precomputed_sarima_test is not None:
        test_preds_sarima = precomputed_sarima_test
    else:
        test_preds_sarima = arima_model.forecast_series(raw_series, test_origin_indices, horizon)
    test_metrics_sarima = evaluate_predictions(
        y_origin=test_df["current_known_level"].values,
        y_true=test_df["target_value"].values,
        y_pred=test_preds_sarima,
        training_naive_scale=training_naive_scale
    )
    test_metrics_sarima.update({
        "target": target_name,
        "horizon": horizon,
        "model": "arima_111",
        "split": "test",
        "failed_folds": arima_model.failed_fits
    })
    aggregate_results.append(test_metrics_sarima)
    
    for i, row in test_df.iterrows():
        prediction_records.append({
            "target": target_name,
            "horizon": horizon,
            "model": "arima_111",
            "split": "test",
            "fold": 1,
            "train_start": config.train_start,
            "train_end": config.val_end,
            "origin_date": row["origin_date"],
            "target_date": row["target_date"],
            "actual": float(row["target_value"]),
            "prediction": float(test_preds_sarima[i]),
            "mae": abs(float(row["target_value"]) - float(test_preds_sarima[i])),
            "absolute_error": abs(float(row["target_value"]) - float(test_preds_sarima[i])),
            "direction_correct": int(np.sign(float(row["target_value"]) - float(row["current_known_level"])) == np.sign(float(test_preds_sarima[i]) - float(row["current_known_level"])))
        })
        
    return aggregate_results, prediction_records
