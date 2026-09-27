"""Forecasting v2 — honest benchmark harness, synthetic augmentation, calibrated intervals.

Design rules that the whole package obeys:
  1. Every feature at origin t is computable from data up to and including t.
  2. Test metrics are reported on REAL observations only. Synthetic data may be
     used to fit, never to score.
  3. A model is only preferred over the naive baseline if it wins on rolling-origin
     MASE across many origins, not on a single split.
"""
