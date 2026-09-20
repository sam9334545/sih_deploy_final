FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ /app/app/
COPY data/ /app/data/
COPY scripts/ /app/scripts/

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app
EXPOSE 8000
CMD ["sh", "-c", "python -m app.seed && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]
