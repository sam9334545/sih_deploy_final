"""
Dataset Versioning and Checksum Verification for SIH26006.
Ensures reproducible data tracking, auditability, and tamper-evident storage
for both historical baseline and extended post-2019 datasets.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import pandas as pd


@dataclass(frozen=True)
class DatasetVersionMetadata:
    """Immutable metadata tracking a specific version of the freight index dataset."""
    dataset_id: str
    dataset_version: str
    file_path: str
    checksum_sha256: str
    row_count: int
    column_schema: list[str]
    date_min: str
    date_max: str
    indices: list[str]
    provenance_tag: str
    source_url: str
    created_at_utc: str
    is_extended: bool
    notes: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


def compute_sha256(file_path: Path) -> str:
    """Compute deterministic SHA-256 checksum of a file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def generate_dataset_version(
    file_path: Path,
    dataset_id: str = "baltic_dry_subindices",
    provenance_tag: str = "mendeley_verified_2012_2019",
    source_url: str = "https://doi.org/10.17632/m645w433cx.1",
    is_extended: bool = False,
    notes: str = ""
) -> DatasetVersionMetadata:
    """
    Inspect a processed dataset CSV, compute its hash, and generate deterministic version metadata.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset not found at {file_path}")

    checksum = compute_sha256(file_path)
    df = pd.read_csv(file_path)

    # Date bounds
    date_col = "obs_date" if "obs_date" in df.columns else "Date"
    dates = pd.to_datetime(df[date_col])
    date_min = str(dates.min().date())
    date_max = str(dates.max().date())

    date_tag = date_max.replace("-", "")
    version_str = f"{dataset_id}_v{date_tag}_{len(df)}rows"

    # Identify target indices present
    potential_indices = ["bpi_value", "bci_value", "bsi_value", "bhsi_value"]
    indices_found = [c for c in potential_indices if c in df.columns]

    metadata = DatasetVersionMetadata(
        dataset_id=dataset_id,
        dataset_version=version_str,
        file_path=str(file_path.as_posix()),
        checksum_sha256=checksum,
        row_count=len(df),
        column_schema=list(df.columns),
        date_min=date_min,
        date_max=date_max,
        indices=indices_found,
        provenance_tag=provenance_tag,
        source_url=source_url,
        created_at_utc=datetime.utcnow().isoformat() + "Z",
        is_extended=is_extended,
        notes=notes or f"Generated version {version_str} with {len(df)} rows spanning {date_min} to {date_max}."
    )
    return metadata


def save_dataset_metadata(metadata: DatasetVersionMetadata, output_path: Path) -> Path:
    """Save version metadata to JSON sidecar file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(metadata.to_json())
    return output_path
