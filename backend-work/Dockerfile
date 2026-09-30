# SIH26006 Intelligent Freight Forecasting Backend
# For authoritative ML v2 packaging with LightGBM artifacts, build from repository root:
#   docker build -t sih26006-backend -f Dockerfile .

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ /app/app/
COPY data/ /app/data/
COPY scripts/ /app/scripts/

ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app API_HOST=0.0.0.0 PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8000}/health/ready || exit 1

CMD ["sh", "-c", "python -m app.seed && exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
