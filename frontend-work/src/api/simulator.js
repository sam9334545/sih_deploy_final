import { apiFetch, ApiError } from './client';

/**
 * Execute Monte Carlo charter strategy simulation.
 * @param {Object} params
 * @param {string} params.cargoType - coking_coal | thermal_coal | iron_ore
 * @param {number} params.quantityT - Cargo quantity in tonnes
 * @param {string} params.originPort - Load port code (e.g. AUHPT)
 * @param {string} params.destinationPort - Discharge port code (e.g. INPRT)
 * @param {string} params.requiredBy - Deadline ISO date (YYYY-MM-DD)
 * @param {string} [params.asOf] - Decision as_of date (default 2026-09-15)
 * @param {number} [params.riskAversion] - Lambda in [0, 1]
 * @param {number} [params.deadlinePenaltyUsd] - User penalty for late arrival
 * @param {number} [params.nSimulations] - 100 to 5000 (default 1000)
 * @param {number|null} [params.seed] - Seed for exact reproducibility (default 42)
 * @param {Array<string>} [params.strategies] - ["auto"] or list of strategy IDs/class names
 * @returns {Promise<Object>}
 */
export async function simulateStrategy({
  cargoType = 'coking_coal',
  quantityT = 120000,
  originPort = 'AUHPT',
  destinationPort = 'INPRT',
  requiredBy,
  asOf = '2026-09-15',
  riskAversion = 0.5,
  deadlinePenaltyUsd = 500000,
  nSimulations = 1000,
  seed = 42,
  strategies = ['auto'],
}) {
  if (!requiredBy) {
    throw new ApiError('Delivery deadline (required_by) is required for strategy simulation.', 400);
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
    seed: seed !== null ? Number(seed) : undefined,
    strategies: strategies || ['auto'],
  };

  return await apiFetch('/api/v1/simulate-strategy', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
