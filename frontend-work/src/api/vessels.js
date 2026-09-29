import { apiFetch, ApiError } from './client';

/**
 * Fetch Baltic standard vessel class profiles.
 * @returns {Promise<Array>}
 */
export async function fetchVesselClasses() {
  return await apiFetch('/api/v1/vessels');
}

/**
 * Fetch profile for a specific vessel class.
 * @param {string} vesselClass - Capesize | Panamax | Supramax | Handysize
 * @returns {Promise<Object>}
 */
export async function fetchVesselClass(vesselClass) {
  return await apiFetch(`/api/v1/vessels/${encodeURIComponent(vesselClass)}`);
}

/**
 * Run vessel recommendation and feasibility check.
 * @param {Object} params
 * @param {string} params.cargoType - coking_coal | thermal_coal | iron_ore
 * @param {number} params.quantityT - total quantity in metric tonnes
 * @param {string} params.originPort - Load port code (e.g. AUHPT)
 * @param {string} params.destinationPort - Discharge port code (e.g. INPRT)
 * @param {string} params.requiredBy - Deadline ISO date (YYYY-MM-DD)
 * @param {string} [params.asOf] - As-of date (e.g. 2026-09-15)
 * @returns {Promise<Object>}
 */
export async function recommendVessel({
  cargoType = 'coking_coal',
  quantityT = 120000,
  originPort = 'AUHPT',
  destinationPort = 'INPRT',
  requiredBy,
  asOf = '2026-09-15',
}) {
  if (!requiredBy) {
    throw new ApiError('Delivery deadline (required_by) is required.', 400);
  }

  const payload = {
    cargo: {
      type: cargoType,
      quantity_t: Number(quantityT),
    },
    origin_port: originPort.trim().toUpperCase(),
    destination_port: destinationPort.trim().toUpperCase(),
    required_by: requiredBy,
    as_of: asOf,
  };

  return await apiFetch('/api/v1/recommend-vessel', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
