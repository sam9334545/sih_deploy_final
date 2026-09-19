PY := .venv/bin/python
PIP := .venv/bin/pip

.PHONY: venv install bootstrap seed dev test lint contract compat clean

venv:
	python3 -m venv .venv

install: venv
	$(PIP) install -q -r requirements.txt

bootstrap: install
	./scripts/bootstrap_db.sh

seed:
	cd backend && ../$(PY) -m app.seed

dev:
	cd backend && ../$(PY) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	cd backend && ../$(PY) -m pytest -q

contract:
	$(PY) scripts/export_openapi.py

compat:
	$(PY) scripts/rebuild_compatibility.py 2026-09-15

clean:
	rm -f backend/charter.db
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
