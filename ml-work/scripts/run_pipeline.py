#!/usr/bin/env python
"""
SIH26006 CLI Runner: Modular Data Cleaning Pipeline
Usage:
    python run_pipeline.py --input <path_to_raw.csv> --output <path_to_processed.csv>
"""

import sys
import argparse
from pathlib import Path

# Add parent directory of scripts (ml-work) to sys.path so pipeline package can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.config import PipelineConfig
from pipeline.cleaner import load_raw_data, clean_dataset
from pipeline.validator import validate_series
from pipeline.reporter import generate_cleaning_report

def main():
    parser = argparse.ArgumentParser(description="SIH26006 Modular BPI Cleaning Pipeline")
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Path to raw dataset CSV file (defaults to ml-work/data/raw/original_dataset.csv)"
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Path to cleaned dataset CSV output (defaults to ml-work/data/processed/bpi_cleaned.csv)"
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=None,
        help="Path to generated cleaning report markdown (defaults to ml-work/CLEANING_REPORT.md)"
    )
    parser.add_argument(
        "--index-code",
        type=str,
        default="BPI",
        help="Baltic index code to filter (default: BPI)"
    )
    parser.add_argument(
        "--source-url",
        type=str,
        default=None,
        help="Source URL or origin descriptor for provenance tracking"
    )
    parser.add_argument(
        "--provenance-tag",
        type=str,
        default=None,
        help="Provenance tag (e.g. synthetic_calibrated_demo, official_feed)"
    )

    args = parser.parse_args()
    config = PipelineConfig()
    
    if args.input:
        config.raw_data_path = args.input
    if args.output:
        config.processed_data_path = args.output
    if args.report:
        config.report_output_path = args.report
    if args.index_code:
        config.target_index_code = args.index_code
    if args.source_url:
        config.default_source_url = args.source_url
    if args.provenance_tag:
        config.default_provenance_tag = args.provenance_tag

    print(f"==================================================")
    print(f"  SIH26006 Data Cleaning Pipeline")
    print(f"==================================================")
    print(f"Input Raw File:       {config.raw_data_path}")
    print(f"Target Index Code:    {config.target_index_code}")
    print(f"Output Cleaned File:  {config.processed_data_path}")
    print(f"Audit Report File:    {config.report_output_path}")
    print(f"--------------------------------------------------")

    # 1. Load Raw Data
    df_raw = load_raw_data(config.raw_data_path)
    print(f"Loaded {len(df_raw):,} raw rows.")

    # 2. Clean Dataset
    df_cleaned, audit = clean_dataset(df_raw, config)
    print(f"Cleaned {len(df_cleaned):,} rows for index '{config.target_index_code}'.")
    print(f"Date range: {audit['earliest_date']} to {audit['latest_date']}")

    # 3. Validate Series
    metrics = validate_series(df_cleaned, config)
    print(f"Validation complete. Outliers: {metrics['iqr_outliers_count']} (preserved).")
    print(f"Discontinuities (|return| > 10%): {metrics['jump_events_count']} detected.")

    # 4. Save Processed Dataset (Ensure parent directory exists)
    config.processed_data_path.parent.mkdir(parents=True, exist_ok=True)
    df_cleaned.to_csv(config.processed_data_path, index=False)
    print(f"Successfully wrote processed CSV to: {config.processed_data_path}")

    # 5. Generate Cleaning Report
    generate_cleaning_report(audit, metrics, config.report_output_path)
    print(f"Successfully generated audit report at: {config.report_output_path}")
    print(f"==================================================")

if __name__ == "__main__":
    main()
