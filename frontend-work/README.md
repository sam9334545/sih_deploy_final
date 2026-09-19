# SIH26006 — Frontend Work

This directory hosts the web client interface for the SIH26006 Intelligent Freight Forecasting & Charter Decision Support System.

## Architecture
- `src/`: UI components, dashboard, interactive charter scenario simulator, and visualization widgets.
- Communicates directly with the backend API (`backend-work/`) running on `http://localhost:8000`.

## Clean Flow Separation
- The frontend consumes JSON contracts exposed by `backend-work/`.
- The frontend does NOT interact directly with raw ML models, training pipelines, or SQLite databases.
