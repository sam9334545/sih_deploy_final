#!/usr/bin/env bash
# Build the database from scratch: reference CSVs, demo series, compatibility grid.
set -euo pipefail
cd "$(dirname "$0")/.."

PY=${PYTHON:-.venv/bin/python}
[ -x "$PY" ] || PY=python3

echo "→ generating demo series"
"$PY" scripts/generate_demo_series.py

echo "→ loading database"
(cd backend && "../$PY" -m app.seed)

echo "→ freezing the API contract"
"$PY" scripts/export_openapi.py

echo "done. start the API with: make dev"
