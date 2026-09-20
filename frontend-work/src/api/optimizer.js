import { apiFetch, ApiError } from './client';

/**
 * Call the constrained charter optimizer engine.
 * @param {Object} params
 * @param {string} params.cargoType - thermal_coal | coking_coal | iron_ore
 * @param {number} params.quantityT - Parcel or total procurement tonnage
 * @param {string} params.originPort - Load port UN/LOCODE (e.g. AUHPT)
 * @param {string} params.destinationPort - Discharge port UN/LOCODE (e.g. INPRT)
 * @param {string} params.requiredBy - Deadline ISO date (YYYY-MM-DD)
 * @param {string} [params.asOf] - Decision as_of date
 * @param {number} [params.riskAversion] - Lambda in [0, 1]
 * @param {number} [params.deadlinePenaltyUsd]
 * @param {number} [params.nSimulations] - 100 to 5000
 * @returns {Promise<any>}
 */
export async function optimizeCharter({
  cargoType = 'coking_coal',
  quantityT = 150000,
  originPort = 'AUHPT',
  destinationPort = 'INPRT',
  requiredBy,
  asOf = '2026-09-15',
  riskAversion = 0.5,
  deadlinePenaltyUsd = 500000,
  nSimulations = 500,
}) {
  if (!requiredBy) {
    throw new ApiError('Laycan / delivery deadline date is required.', 400);
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
    risk_aversion: Number(riskAversion),
    deadline_miss_penalty_usd: Number(deadlinePenaltyUsd),
    n_simulations: Number(nSimulations),
  };

  const raw = await apiFetch('/api/v1/optimize-charter', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (import.meta.env.DEV) {
    console.debug('[Charter Optimizer Response]', raw);
  }

  return raw;
}
