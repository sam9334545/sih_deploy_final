import { apiFetch } from './client';

/**
 * Fetch explainable risk assessment for a port and vessel class.
 * @param {Object} params
 * @param {string} params.portId - Discharge port UN/LOCODE (e.g. INPRT)
 * @param {string} [params.vesselClass] - Supramax | Panamax | Capesize | Handysize
 * @param {number} [params.month] - 1 to 12
 * @param {string} [params.asOf] - As-of date (e.g. 2026-09-15)
 * @returns {Promise<Object>}
 */
export async function fetchRisks({
  portId = 'INPRT',
  vesselClass = 'Panamax',
  month = null,
  asOf = null,
} = {}) {
  const params = new URLSearchParams({
    port_id: portId.trim().toUpperCase(),
    vessel_class: vesselClass,
  });
  if (month) params.set('month', String(month));
  if (asOf) params.set('as_of', asOf);

  return await apiFetch(`/api/v1/risks?${params.toString()}`);
}
