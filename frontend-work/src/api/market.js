import { apiFetch } from './client';

/**
 * Fetch full live market dashboard (indices, bunker, commodities, FX, availability signals).
 * @param {string} [asOf]
 * @returns {Promise<Object>}
 */
export async function fetchMarketData(asOf = null) {
  const query = asOf ? `?as_of=${encodeURIComponent(asOf)}` : '';
  return await apiFetch(`/api/v1/market${query}`);
}

/**
 * Fetch 6-month demand-regime strip for a vessel class.
 * @param {string} vesselClass - Capesize | Panamax | Supramax | Handysize
 * @param {number} [months=6]
 * @param {string} [asOf]
 * @returns {Promise<Object>}
 */
export async function fetchLowDemand(vesselClass = 'Supramax', months = 6, asOf = null) {
  const params = new URLSearchParams({
    vessel_class: vesselClass,
    months: String(months),
  });
  if (asOf) params.set('as_of', asOf);
  return await apiFetch(`/api/v1/market/low-demand?${params.toString()}`);
}

/**
 * Fetch ballast cost matrix and premium owners price in.
 * @param {string} vesselClass - Capesize | Panamax | Supramax | Handysize
 * @param {string|null} [fromPort] - Optional origin port (e.g. INPRT)
 * @param {string} [asOf]
 * @returns {Promise<Object>}
 */
export async function fetchBallastMatrix(vesselClass = 'Supramax', fromPort = null, asOf = null) {
  const params = new URLSearchParams({ vessel_class: vesselClass });
  if (fromPort) params.set('from_port', fromPort.trim().toUpperCase());
  if (asOf) params.set('as_of', asOf);
  return await apiFetch(`/api/v1/market/ballast-matrix?${params.toString()}`);
}

/**
 * Fetch backhaul insight for a specific lane.
 * @param {string} originPort - e.g. AUHPT
 * @param {string} destinationPort - e.g. INPRT
 * @param {string} [vesselClass='Supramax']
 * @param {string} [asOf]
 * @returns {Promise<Object>}
 */
export async function fetchBackhaul(originPort, destinationPort, vesselClass = 'Supramax', asOf = null) {
  const params = new URLSearchParams({
    origin_port: originPort.trim().toUpperCase(),
    destination_port: destinationPort.trim().toUpperCase(),
    vessel_class: vesselClass,
  });
  if (asOf) params.set('as_of', asOf);
  return await apiFetch(`/api/v1/market/backhaul?${params.toString()}`);
}
