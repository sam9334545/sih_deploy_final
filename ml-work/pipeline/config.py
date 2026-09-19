from dataclasses import dataclass, field
from pathlib import Path
from typing import List

# Base root directory for ml-work
BASE_DIR = Path(__file__).resolve().parent.parent

@dataclass
class PipelineConfig:
    raw_data_path: Path = field(default_factory=lambda: BASE_DIR / "data" / "raw" / "original_dataset.csv")
    processed_data_path: Path = field(default_factory=lambda: BASE_DIR / "data" / "processed" / "bpi_cleaned.csv")
    report_output_path: Path = field(default_factory=lambda: BASE_DIR / "CLEANING_REPORT.md")
    
    target_index_code: str = "BPI"
    
    # Supported date column aliases in incoming raw datasets
    date_column_aliases: List[str] = field(default_factory=lambda: [
        "obs_date", "date", "as_of_date", "Date", "DATE", "time", "timestamp"
    ])
    
    # Supported value column aliases
    value_column_aliases: List[str] = field(default_factory=lambda: [
        "value", "bpi_value", "bpi", "price", "close", "index_value", "Value"
    ])
    
    output_columns: List[str] = field(default_factory=lambda: [
        "obs_date", "index_code", "bpi_value", "tc_avg_usd_day", "source_url", "provenance_tag"
    ])
    
    # Sub-index column aliases for multivariate Baltic datasets
    subindex_column_mapping: dict = field(default_factory=lambda: {
        "PI": "bpi_value",
        "CI": "bci_value",
        "SI": "bsi_value",
        "HSI": "bhsi_value"
    })
    
    real_raw_path: Path = field(default_factory=lambda: BASE_DIR / "data" / "raw" / "mendeley_baltic_subindices_2012_2019.csv")
    real_processed_path: Path = field(default_factory=lambda: BASE_DIR / "data" / "processed" / "real_baltic_multivariate.csv")
    
    default_source_url: str = "local://sih/scripts/generate_demo_series.py"
    default_provenance_tag: str = "synthetic_calibrated_demo"
    
    # Audit thresholds
    max_jump_pct_warning: float = 0.10  # Flag price jumps > 10%
    min_allowable_value: float = 0.0     # Freight indices cannot be negative

