"""Rebuild derived_compatibility from the current constraint registry.

Run after editing data/reference/berths.csv or ports.csv:
    python scripts/rebuild_compatibility.py
"""
from __future__ import annotations

import os
import sys
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db import SessionLocal                                   # noqa: E402
from app.services.compatibility_service import rebuild            # noqa: E402

if __name__ == "__main__":
    as_of = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date.today()
    db = SessionLocal()
    try:
        print(f"{rebuild(db, as_of)} compatibility rows rebuilt as of {as_of}")
    finally:
        db.close()
