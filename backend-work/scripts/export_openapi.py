"""Freeze the OpenAPI schema to docs/openapi.json.

The contract is agreed on Day 3 and the frontend builds against it, so a diff on
this file in a PR is the signal that an API change needs the other members told.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.main import app                                          # noqa: E402

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "docs", "openapi.json")
    with open(out, "w") as f:
        json.dump(app.openapi(), f, indent=2, sort_keys=True)
        f.write("\n")
    print("wrote", os.path.abspath(out))
