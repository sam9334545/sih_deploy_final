# SIH26006 — ML Work & Reproducible Data Pipeline

This directory manages the data provenance, ingestion, validation, and cleaning pipeline for the Baltic Panamax Index (BPI) freight forecasting engine.

---

## 1. Directory Structure

```text
ml-work/
├── data/
│   ├── raw/
│   │   └── original_dataset.csv       # IMMUTABLE: Teammates drop raw CSV files here
│   └── processed/
│       └── bpi_cleaned.csv            # CLEANED OUTPUT: Ready for downstream model training
├── pipeline/
│   ├── __init__.py
│   ├── config.py                      # Dynamic paths & column aliases (zero hard-coded rows)
│   ├── cleaner.py                     # Functional cleaning: deduplication, sorting, type coercion
│   ├── validator.py                   # Anomaly checks: physical bounds, IQR outliers, daily jumps
│   └── reporter.py                    # Automatic markdown report generator
├── scripts/
│   └── run_pipeline.py                # Command-line interface to execute the pipeline
├── tests/
│   └── test_data_pipeline.py          # Pytest suite verifying transformations and idempotence
├── DATA_PROVENANCE.md                 # Complete provenance audit of the raw data sources
├── CLEANING_REPORT.md                 # Automatically refreshed report on each pipeline run
└── README.md                          # This documentation
```

---

## 2. Core Architectural Guarantees

1. **Strict Raw vs. Processed Separation**:
   - `data/raw/` is treated as read-only. Scripts never overwrite or mutate the raw data files.
   - `data/processed/` contains the standardized output generated deterministically.
2. **Zero Hard-Coded Observations**:
   - No dates, price values, or specific row indices are hard-coded into the pipeline or models.
   - Column aliases (e.g. `obs_date`, `as_of_date`, `date`) are dynamically resolved.
3. **Decoupled from Backend & Frontend**:
   - Changes in `ml-work/` do not require modifying `backend-work/` or `frontend-work/`.
   - The ML pipeline produces clean standardized artifacts (`.csv`) consumed at runtime.

---

## 3. How Teammates Add, Remove, or Correct Observations

### Scenario A: Adding New Observations
1. Open or append new rows to `ml-work/data/raw/original_dataset.csv`.
2. Ensure columns include a date (`obs_date` or `date`), index code (`index_code`), and index value (`value` or `bpi_value`).
3. Rerun the cleaning pipeline from the workspace root:
   ```bash
   python ml-work/scripts/run_pipeline.py
   ```
4. Check `ml-work/CLEANING_REPORT.md` to review the newly updated row counts, date ranges, and any flagged price jump events.

### Scenario B: Correcting or Removing Faulty Rows
1. Edit the raw file in `ml-work/data/raw/` directly to correct typographical errors or delete duplicate/invalid rows.
2. Rerun the pipeline:
   ```bash
   python ml-work/scripts/run_pipeline.py
   ```
3. The pipeline will automatically re-sort chronologically, re-compute statistics, re-validate physical constraints, and refresh `ml-work/data/processed/bpi_cleaned.csv`.

### Scenario C: Custom Input / Output Paths
You can target any arbitrary raw CSV or produce custom outputs using CLI flags:
```bash
python ml-work/scripts/run_pipeline.py \
    --input ml-work/data/raw/new_market_feed_2026.csv \
    --output ml-work/data/processed/bpi_cleaned.csv \
    --report ml-work/CLEANING_REPORT.md \
    --index-code BPI
```

---

## 4. Running Unit Tests

Verify the integrity of the data transformations at any time:
```bash
pytest ml-work/tests/
```
All tests validate:
- Monotonic chronological ordering (no time-series shuffling).
- Strict non-negative physical bounds.
- Conflict detection on identical dates.
- Seamless processing when new observations are appended.
