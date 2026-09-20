import { apiFetch } from './client';

/**
 * Fetch verified historical Baltic observations from Mendeley dataset.
 * Zero synthetic observations.
 */
export async function fetchHistoricalSeries({ target = 'BPI', startDate = null, endDate = null, limit = 100 } = {}) {
  const params = new URLSearchParams({ target: target.toUpperCase() });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (limit) params.set('limit', String(limit));

  const data = await apiFetch(`/api/v1/historical/series?${params.toString()}`);
  return {
    target: data.target,
    dataMode: data.data_mode,
    dataCutoff: data.data_cutoff,
    count: data.count,
    startDate: data.start_date,
    endDate: data.end_date,
    observations: data.observations || data.data || [],
  };
}

/**
 * Fetch latest verified Baltic market index levels as of 2019-07-31 cutoff.
 */
export async function fetchMarketSummary() {
  return await apiFetch('/api/v1/historical/market-summary');
}

/**
 * Fetch readiness & data status.
 */
export async function fetchSystemStatus() {
  return await apiFetch('/api/v1/historical/status');
}
