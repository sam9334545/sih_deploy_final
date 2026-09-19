"""
Phase 7B Script 1: Validate Post-2019 Candidate Datasets.
Scans ml-work/data/raw/post_2019/candidate_sources/ for candidate data files,
applies the ExtendedDataValidator pipeline, audits overlap with the 2012–2019 baseline,
and outputs a diagnostic validation report.
"""
from __future__ import annotations

import sys
from pathlib import Path
import pandas as pd
import json

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from pipeline.validate_extended_data import ExtendedDataValidator, ValidationReport
from pipeline.dataset_versioning import generate_dataset_version

CANDIDATES_DIR = ROOT_DIR / "data" / "raw" / "post_2019" / "candidate_sources"
VERIFIED_DIR = ROOT_DIR / "data" / "raw" / "post_2019" / "verified"
REPORT_PATH = ROOT_DIR / "reports" / "post_2019_data_validation_report.md"
REGISTRY_PATH = ROOT_DIR / "data" / "source_registry.json"


def main():
    print("=" * 70)
    print("SIH26006 — Phase 7B: Post-2019 Candidate Data Validation")
    print("=" * 70)

    CANDIDATES_DIR.mkdir(parents=True, exist_ok=True)
    VERIFIED_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Search for candidate CSV or Excel files
    candidate_files = [
        f for f in CANDIDATES_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in [".csv", ".xlsx", ".xls"] and not f.name.startswith(".")
    ]

    if not candidate_files:
        print(f"\n[BLOCKED] No candidate files found in {CANDIDATES_DIR}")
        print("Please place authorized Baltic Exchange sub-index observations into:")
        print(f"  {CANDIDATES_DIR}")
        print("\nRequired targets: BCI, BPI, BSI, BHSI (daily 2019-08-01 to present)")
        
        # Write blocked report
        report_content = f"""# Post-2019 Data Validation & Source Assessment Report
**Project:** SIH26006 — Intelligent Freight Forecasting & Charter Optimization  
**Phase:** 7B — Licensed Post-2019 Data Integration  
**Date:** {pd.Timestamp.now().strftime('%Y-%m-%d')}  
**Status:** BLOCKED (No post-2019 data file provided in candidate directory)

---

## 1. Candidate Source Audit

- **Directory Inspected:** `{CANDIDATES_DIR.as_posix()}`
- **Files Found:** 0 candidate datasets.
- **Decision:** **BLOCKED**. Zero synthetic data fabricated.

---

## 2. Required Action to Unblock Phase 7B

1. Export legitimate daily BCI, BPI, BSI, BHSI observations (2019-08-01 to present).
2. Save file to `{CANDIDATES_DIR.as_posix()}/<filename>.csv`.
3. Re-run:
   ```bash
   python ml-work/scripts/validate_post_2019.py
   ```
"""
        with open(REPORT_PATH, "w", encoding="utf-8") as f:
            f.write(report_content)
        return False

    print(f"Found {len(candidate_files)} candidate file(s): {[f.name for f in candidate_files]}")
    validator = ExtendedDataValidator()

    for cand_file in candidate_files:
        print(f"\nEvaluating: {cand_file.name}")
        try:
            if cand_file.suffix.lower() == ".csv":
                df = pd.read_csv(cand_file)
            else:
                df = pd.read_excel(cand_file)

            report = validator.validate(
                candidate_df=df,
                dataset_name=cand_file.name,
                check_continuity_with_baseline=True
            )

            print(f"  Passed: {report.passed}")
            print(f"  Rows: {report.row_count}")
            print(f"  Date Range: {report.date_min} to {report.date_max}")
            print(f"  Indices Detected: {report.indices_detected}")
            print(f"  Missing Indices: {report.missing_indices}")
            if report.errors:
                print(f"  Errors ({len(report.errors)}): {report.errors}")
            if report.warnings:
                print(f"  Warnings ({len(report.warnings)}): {report.warnings[:3]}")

            if report.passed:
                print(f"  [SUCCESS] {cand_file.name} is verified! Copying to {VERIFIED_DIR}...")
                target_path = VERIFIED_DIR / cand_file.name
                df.to_csv(target_path, index=False)
                return True
            else:
                print(f"  [REJECTED] {cand_file.name} failed validation criteria.")
                return False

        except Exception as e:
            print(f"  [ERROR] Failed to read/validate {cand_file.name}: {str(e)}")
            return False

    return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
