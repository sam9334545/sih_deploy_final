# SIH26006 Intelligent Freight Forecasting & Charter Decision-Support System
# Production-Hardened Backend + ML Serving Image

FROM python:3.12-slim AS runtime

# System runtime dependencies for LightGBM OpenMP threading and container health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install explicit production runtime dependencies (FastAPI + LightGBM stack)
COPY backend-work/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copy backend application, database seeds, and operational scripts
COPY backend-work/app /app/app
COPY backend-work/data /app/data
COPY backend-work/scripts /app/scripts

# 3. Copy authoritative ML v2 forecasting pipeline & LightGBM model artifacts
# (72 LightGBM quantile regression models + split-conformal calibrators)
COPY ml-work/forecast_v2 /app/ml-work/forecast_v2
COPY ml-work/models/saved_models/v2 /app/ml-work/models/saved_models/v2
COPY ml-work/route /app/ml-work/route
COPY ml-work/data/processed/baltic_real_plus_postcovid.csv /app/ml-work/data/processed/baltic_real_plus_postcovid.csv

# 4. Configure serving environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    FORECAST_V2_ROOT=/app/ml-work \
    FORECAST_V2_ARTIFACTS=/app/ml-work/models/saved_models/v2 \
    REQUIRE_V2_FORECAST=false \
    DEMO_MODE=true

EXPOSE 8000

# Explicit container healthcheck probing the ML-aware readiness endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health/ready || exit 1

# Seed reference data and start production ASGI server
CMD ["sh", "-c", "python -m app.seed && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]
