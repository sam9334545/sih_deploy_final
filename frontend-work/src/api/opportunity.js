import { apiFetch, ApiError } from './client';

/**
 * Fetch Charter Opportunity Score for a requirement.
 * @param {Object} params
 * @param {string} params.cargoType - coking_coal | thermal_coal | iron_ore
 * @param {number} params.quantityT - tonnage
 * @param {string} params.originPort - e.g. AUHPT
 * @param {string} params.destinationPort - e.g. INPRT
 * @param {string} params.requiredBy - Deadline ISO date (YYYY-MM-DD)
 * @param {string} [params.asOf] - default 2026-09-15
 * @param {string} [params.vesselClass] - optional specific class
 * @param {number} [params.nSimulations=200]
 * @returns {Promise<Object>}
 */
export async function fetchOpportunityScore({
  cargoType = 'coking_coal',
  quantityT = 120000,
  originPort = 'AUHPT',
  destinationPort = 'INPRT',
  requiredBy,
  asOf = '2026-09-15',
  vesselClass = null,
  nSimulations = 200,
}) {
  if (!requiredBy) {
    throw new ApiError('required_by deadline is required.', 400);
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
    vessel_class: vesselClass || undefined,
    n_simulations: Number(nSimulations),
  };

  return await apiFetch('/api/v1/opportunity-score', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
