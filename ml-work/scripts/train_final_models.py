"""
Phase 7B Script 3: Train Final Production Models.
Trains the 72 Quantile LightGBM models (4 targets x 6 horizons x 3 quantiles)
on the SIH 2015–2022 train split, applies Chernozhukov monotonic rearrangement,
calibrates conformal prediction intervals on the 2023–2024 validation split,
and evaluates once on the 2025–present test split.

Archives previous Phase 5 models to ml-work/models/archive/phase5/ to preserve auditability.
"""
from __future__ import annotations

import sys
from pathlib import Path
import shutil
import pandas as pd
import numpy as np
import joblib

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from models.quantile_lightgbm import TripletQuantileForecaster, enforce_monotonic_quantiles
from models.conformal import SplitConformalCalibrator
from models.config import ModelConfig

EXTENDED_FEATURES_DIR = ROOT_DIR / "data" / "features" / "extended"
SAVED_MODELS_DIR = ROOT_DIR / "models" / "saved_models"
ARCHIVE_PHASE5_DIR = ROOT_DIR / "models" / "archive" / "phase5"
CALIB_OUTPUT_PATH = ROOT_DIR / "reports" / "phase7b_calibration_results.csv"
TEST_EVAL_OUTPUT_PATH = ROOT_DIR / "reports" / "phase7b_test_results.csv"


def archive_phase5_models():
    """Safely archive existing Phase 5 artifacts without deleting them (Section 68)."""
    ARCHIVE_PHASE5_DIR.mkdir(parents=True, exist_ok=True)
    existing_files = list(SAVED_MODELS_DIR.glob("quantile_lgb_*.joblib"))
    for f in existing_files:
        dest = ARCHIVE_PHASE5_DIR / f.name
        if not dest.exists():
            shutil.copy2(f, dest)
    print(f"Archived {len(existing_files)} Phase 5 model artifacts to {ARCHIVE_PHASE5_DIR}")


def main():
    print("=" * 70)
    print("SIH26006 — Phase 7B: Final Model Retraining & Calibration")
    print("=" * 70)

    # Check for extended feature datasets
    ext_files = list(EXTENDED_FEATURES_DIR.glob("dataset_*.csv"))
    if not ext_files or len(ext_files) < 24:
        print(f"\n[BLOCKED] Extended feature datasets not found in:")
        print(f"  {EXTENDED_FEATURES_DIR}")
        print("Expected 24 supervised feature CSV files (4 targets x 6 horizons).")
        print("\nPrerequisites:")
        print("1. Place legitimate post-2019 Baltic data in ml-work/data/raw/post_2019/candidate_sources/")
        print("2. Run python ml-work/scripts/validate_post_2019.py")
        print("3. Run python ml-work/scripts/build_extended_features.py")
        print("4. Re-run train_final_models.py")
        print("\nStatus: BLOCKED_HISTORICAL_ONLY preserved. Zero fake data synthesized.")
        return False

    archive_phase5_models()

    targets = ["BCI", "BPI", "BSI", "BHSI"]
    horizons = [7, 14, 28, 60, 90, 180]
    meta_cols = [
        "origin_date", "target_index", "horizon_sessions",
        "target_date", "calendar_days_elapsed", "target_value",
        "target_log_return", "split_set"
    ]

    calib_rows = []
    test_eval_rows = []

    for t in targets:
        for h in horizons:
            feat_file = EXTENDED_FEATURES_DIR / f"dataset_{t.lower()}_h{h}.csv"
            df = pd.read_csv(feat_file)

            feat_cols = [c for c in df.columns if c not in meta_cols]

            df_train = df[df["split_set"] == "train"]
            df_val = df[df["split_set"] == "val"]
            df_test = df[df["split_set"] == "test"]

            print(f"\nRetraining {t} h={h} (Train: {len(df_train)}, Val: {len(df_val)}, Test: {len(df_test)})")

            X_tr, y_tr = df_train[feat_cols], df_train["target_value"]
            X_val, y_val = df_val[feat_cols], df_val["target_value"]
            X_te, y_te = df_test[feat_cols], df_test["target_value"]

            # 1. Fit Triplet Quantile LightGBM
            triplet = TripletQuantileForecaster()
            triplet.fit(X_tr, y_tr)

            # 2. Conformal Calibration on Validation Split Only
            val_preds = triplet.predict(X_val)
            val_mono_10, val_mono_50, val_mono_90 = enforce_monotonic_quantiles(
                val_preds["p10"].values, val_preds["p50"].values, val_preds["p90"].values
            )
            calibrator = SplitConformalCalibrator(alpha=0.20)
            calibrator.fit(y_val.values, val_mono_10, val_mono_90)
            q_hat = calibrator.q_hat

            calib_rows.append({
                "target": t,
                "horizon": h,
                "n_val": len(df_val),
                "q_hat": round(q_hat, 2),
                "raw_val_coverage": round(np.mean((y_val.values >= val_mono_10) & (y_val.values <= val_mono_90)) * 100, 2),
                "cal_val_coverage": round(calibrator.empirical_coverage * 100, 2),
            })

            # 3. Save Production Artifact
            model_out_path = SAVED_MODELS_DIR / f"quantile_lgb_{t.lower()}_h{h}.joblib"
            joblib.dump(triplet, model_out_path)

            # 4. Final Evaluation on Test Split (if test observations exist)
            if len(df_test) > 0:
                te_preds = triplet.predict(X_te)
                te_mono_10, te_mono_50, te_mono_90 = enforce_monotonic_quantiles(
                    te_preds["p10"].values, te_preds["p50"].values, te_preds["p90"].values
                )
                te_cal_10, te_cal_90 = calibrator.predict_interval(te_mono_10, te_mono_90)

                test_mae = float(np.mean(np.abs(y_te.values - te_mono_50)))
                test_rmse = float(np.sqrt(np.mean((y_te.values - te_mono_50) ** 2)))
                test_cov = float(np.mean((y_te.values >= te_cal_10) & (y_te.values <= te_cal_90)) * 100)

                test_eval_rows.append({
                    "target": t,
                    "horizon": h,
                    "n_test": len(df_test),
                    "mae": round(test_mae, 2),
                    "rmse": round(test_rmse, 2),
                    "cal_interval_coverage_pct": round(test_cov, 2),
                    "mean_cal_width": round(float(np.mean(te_cal_90 - te_cal_10)), 2),
                })

    pd.DataFrame(calib_rows).to_csv(CALIB_OUTPUT_PATH, index=False)
    if test_eval_rows:
        pd.DataFrame(test_eval_rows).to_csv(TEST_EVAL_OUTPUT_PATH, index=False)
    print("\n[SUCCESS] Final models retrained, calibrated, and evaluated.")
    return True


if __name__ == "__main__":
    main()
