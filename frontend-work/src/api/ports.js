import { apiFetch } from './client';

/**
 * Fetch list of all registered ports.
 */
export async function fetchPortsList({ country = null, role = null } = {}) {
  const params = new URLSearchParams();
  if (country) params.set('country', country);
  if (role) params.set('role', role);

  const query = params.toString() ? `?${params.toString()}` : '';
  return await apiFetch(`/api/v1/ports${query}`);
}

/**
 * Fetch detailed port dossier including berths, congestion wait pools, weather climatology, and compatibility.
 */
export async function fetchPortDetail(portId, { cargoType = 'coking_coal', season = null, asOf = null } = {}) {
  const params = new URLSearchParams({ cargo_type: cargoType });
  if (season) params.set('season', season);
  if (asOf) params.set('as_of', asOf);

  return await apiFetch(`/api/v1/ports/${portId}?${params.toString()}`);
}

/**
 * Fetch full compatibility matrix for a specific port.
 */
export async function fetchPortCompatibility(portId, { season = null, cargoType = null } = {}) {
  const params = new URLSearchParams();
  if (season) params.set('season', season);
  if (cargoType) params.set('cargo_type', cargoType);

  const query = params.toString() ? `?${params.toString()}` : '';
  return await apiFetch(`/api/v1/ports/${portId}/compatibility${query}`);
}
