"""Everything needed to answer: which model produced this forecast, and on what?

A forecast that cannot be traced to a specific artifact, a specific dataset and a
specific environment is not auditable, and an unauditable number should not
inform a chartering decision.
"""
from __future__ import annotations

import hashlib
import importlib.metadata as md
import json
import platform
import subprocess
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

TRACKED = ("numpy", "pandas", "scipy", "scikit-learn", "lightgbm",
           "statsmodels", "joblib")


def file_sha256(path: str | Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def frame_sha256(df) -> str:
    """Content hash of a dataframe, stable across index and column order."""
    payload = df.sort_index(axis=1).to_csv(index=False).encode()
    return hashlib.sha256(payload).hexdigest()


def spec_sha256(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, default=str).encode()).hexdigest()


def git_sha() -> str | None:
    try:
        out = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True,
                             text=True, timeout=5, cwd=Path(__file__).resolve().parent)
        return out.stdout.strip() or None if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):      # pragma: no cover
        return None


def git_dirty() -> bool | None:
    try:
        out = subprocess.run(["git", "status", "--porcelain"], capture_output=True,
                             text=True, timeout=5, cwd=Path(__file__).resolve().parent)
        return bool(out.stdout.strip()) if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):      # pragma: no cover
        return None


def environment() -> dict:
    versions = {}
    for pkg in TRACKED:
        try:
            versions[pkg] = md.version(pkg)
        except md.PackageNotFoundError:                # pragma: no cover
            versions[pkg] = None
    return {"python": platform.python_version(), "platform": platform.platform(),
            "packages": versions}


@dataclass
class ModelProvenance:
    model_version: str
    index_code: str
    horizon_days: int
    selected_model: str
    selection_rule: str
    trained_at: str
    trained_through: str
    dataset_path: str
    dataset_sha256: str
    dataset_rows: int
    feature_spec_sha256: str
    feature_count: int
    n_train_real: int
    n_calibration: int
    augmentation_used: bool
    augmentation_source: str | None
    data_provenance: str
    git_commit: str | None
    git_dirty: bool | None
    environment: dict
    validation: dict = field(default_factory=dict)
    interval: dict = field(default_factory=dict)
    artifact_sha256: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")
