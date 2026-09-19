from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple

BASE_DIR = Path(__file__).resolve().parent.parent

@dataclass
class FeatureConfig:
    # Target indices in real_baltic_multivariate.csv
    target_indices: List[str] = field(default_factory=lambda: [
        "bpi_value", "bci_value", "bsi_value", "bhsi_value"
    ])
    
    # Required forecast horizons (trading sessions)
    horizons: List[int] = field(default_factory=lambda: [
        7, 14, 28, 60, 90, 180
    ])
    
    # Target lag periods (trading sessions back from forecast origin)
    lags: Tuple[int, ...] = (1, 2, 3, 5, 7, 10, 14, 21, 30, 60)
    
    # Rolling window sizes (strictly backwards from origin)
    rolling_windows: Tuple[int, ...] = (7, 14, 30, 60, 90)
    
    # Momentum / Return lookbacks
    return_lookbacks: Tuple[int, ...] = (1, 7, 14, 30)
    
    # Cross-index lags (using sibling Baltic indices)
    cross_index_lags: Tuple[int, ...] = (0, 1, 7)
    
    # Fourier annual harmonics (k=1: annual, k=2: semi-annual)
    fourier_harmonics: int = 2
    
    # Input/Output paths
    input_processed_path: Path = field(
        default_factory=lambda: BASE_DIR / "data" / "processed" / "real_baltic_multivariate.csv"
    )
    output_features_dir: Path = field(
        default_factory=lambda: BASE_DIR / "data" / "features"
    )
    
    # Benchmark split boundaries
    train_end_date: str = "2017-07-31"
    val_end_date: str = "2018-07-31"
    test_end_date: str = "2019-07-31"
