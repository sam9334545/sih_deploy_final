import { apiFetch } from './client';

/**
 * Fetch live data sources and provenance registry.
 * @returns {Promise<Array>}
 */
export async function fetchSources() {
  return await apiFetch('/api/v1/sources');
}

/**
 * Fetch verification coverage statistics across all constraints and entities.
 * @returns {Promise<Object>}
 */
export async function fetchSourceCoverage() {
  return await apiFetch('/api/v1/sources/coverage');
}
