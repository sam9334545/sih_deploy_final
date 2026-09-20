import { apiFetch, ApiError } from './client';

/**
 * Authoritative supported routes mapped to backend SUPPORTED_ROUTES in ml-work/route/route_config.py.
 */
export const CANONICAL_ROUTES = [
  { id: 'AUHPT-INPRT', name: 'Australia (Hay Point) → India (Paradip)', originPort: 'AUHPT', destPort: 'INPRT', originName: 'Hay Point', destName: 'Paradip', country: 'Australia', dist: 5180, cargo: 'coking_coal' },
  { id: 'AUHPT-INVTZ', name: 'Australia (Hay Point) → India (Visakhapatnam)', originPort: 'AUHPT', destPort: 'INVTZ', originName: 'Hay Point', destName: 'Visakhapatnam', country: 'Australia', dist: 5240, cargo: 'coking_coal' },
  { id: 'AUHPT-INDHA', name: 'Australia (Hay Point) → India (Dhamra)', originPort: 'AUHPT', destPort: 'INDHA', originName: 'Hay Point', destName: 'Dhamra', country: 'Australia', dist: 5195, cargo: 'coking_coal' },
  { id: 'AUHPT-INGGV', name: 'Australia (Hay Point) → India (Gangavaram)', originPort: 'AUHPT', destPort: 'INGGV', originName: 'Hay Point', destName: 'Gangavaram', country: 'Australia', dist: 5250, cargo: 'coking_coal' },
  { id: 'AUHPT-INHAL', name: 'Australia (Hay Point) → India (Haldia)', originPort: 'AUHPT', destPort: 'INHAL', originName: 'Hay Point', destName: 'Haldia', country: 'Australia', dist: 5320, cargo: 'coking_coal' },
  { id: 'AUGLT-INPRT', name: 'Australia (Gladstone) → India (Paradip)', originPort: 'AUGLT', destPort: 'INPRT', originName: 'Gladstone', destName: 'Paradip', country: 'Australia', dist: 5410, cargo: 'coking_coal' },
  { id: 'AUGLT-INDHA', name: 'Australia (Gladstone) → India (Dhamra)', originPort: 'AUGLT', destPort: 'INDHA', originName: 'Gladstone', destName: 'Dhamra', country: 'Australia', dist: 5425, cargo: 'coking_coal' },
  { id: 'AUGLT-INVTZ', name: 'Australia (Gladstone) → India (Visakhapatnam)', originPort: 'AUGLT', destPort: 'INVTZ', originName: 'Gladstone', destName: 'Visakhapatnam', country: 'Australia', dist: 5470, cargo: 'coking_coal' },
  { id: 'IDTBA-INPRT', name: 'Indonesia (Taboneo) → India (Paradip)', originPort: 'IDTBA', destPort: 'INPRT', originName: 'Taboneo', destName: 'Paradip', country: 'Indonesia', dist: 3180, cargo: 'thermal_coal' },
  { id: 'IDTBA-INVTZ', name: 'Indonesia (Taboneo) → India (Visakhapatnam)', originPort: 'IDTBA', destPort: 'INVTZ', originName: 'Taboneo', destName: 'Visakhapatnam', country: 'Indonesia', dist: 3060, cargo: 'thermal_coal' },
  { id: 'IDTBA-INDHA', name: 'Indonesia (Taboneo) → India (Dhamra)', originPort: 'IDTBA', destPort: 'INDHA', originName: 'Taboneo', destName: 'Dhamra', country: 'Indonesia', dist: 3195, cargo: 'thermal_coal' },
  { id: 'IDTBA-INHAL', name: 'Indonesia (Taboneo) → India (Haldia)', originPort: 'IDTBA', destPort: 'INHAL', originName: 'Taboneo', destName: 'Haldia', country: 'Indonesia', dist: 3250, cargo: 'thermal_coal' },
  { id: 'ZARBY-INPRT', name: 'South Africa (Richards Bay) → India (Paradip)', originPort: 'ZARBY', destPort: 'INPRT', originName: 'Richards Bay', destName: 'Paradip', country: 'South Africa', dist: 4520, cargo: 'thermal_coal' },
  { id: 'ZARBY-INDHA', name: 'South Africa (Richards Bay) → India (Dhamra)', originPort: 'ZARBY', destPort: 'INDHA', originName: 'Richards Bay', destName: 'Dhamra', country: 'South Africa', dist: 4540, cargo: 'thermal_coal' },
  { id: 'ZARBY-INVTZ', name: 'South Africa (Richards Bay) → India (Visakhapatnam)', originPort: 'ZARBY', destPort: 'INVTZ', originName: 'Richards Bay', destName: 'Visakhapatnam', country: 'South Africa', dist: 4450, cargo: 'thermal_coal' },
  { id: 'USHAM-INPRT', name: 'United States (Hampton Roads) → India (Paradip)', originPort: 'USHAM', destPort: 'INPRT', originName: 'Hampton Roads', destName: 'Paradip', country: 'United States', dist: 9150, cargo: 'coking_coal' },
  { id: 'USHAM-INVTZ', name: 'United States (Hampton Roads) → India (Visakhapatnam)', originPort: 'USHAM', destPort: 'INVTZ', originName: 'Hampton Roads', destName: 'Visakhapatnam', country: 'United States', dist: 9080, cargo: 'coking_coal' },
  { id: 'USHAM-INDHA', name: 'United States (Hampton Roads) → India (Dhamra)', originPort: 'USHAM', destPort: 'INDHA', originName: 'Hampton Roads', destName: 'Dhamra', country: 'United States', dist: 9170, cargo: 'coking_coal' },
  { id: 'MZBEW-INPRT', name: 'Mozambique (Beira) → India (Paradip)', originPort: 'MZBEW', destPort: 'INPRT', originName: 'Beira', destName: 'Paradip', country: 'Mozambique', dist: 4210, cargo: 'coking_coal' },
  { id: 'MZBEW-INVTZ', name: 'Mozambique (Beira) → India (Visakhapatnam)', originPort: 'MZBEW', destPort: 'INVTZ', originName: 'Beira', destName: 'Visakhapatnam', country: 'Mozambique', dist: 4150, cargo: 'coking_coal' },
];

/**
 * Fetch verified routes from backend.
 */
export async function fetchRoutesList() {
  const data = await apiFetch('/api/v1/historical/routes');
  return data.routes || [];
}

/**
 * Execute route voyage economics translation.
 */
export async function fetchRouteEstimate({
  target,
  originDate = '2019-07-31',
  horizonSessions = 28,
  routeId,
  cargoType = 'coking_coal',
  desiredCargoTonnes = null,
  riskAversion = 0.5,
  bunkerLocation = 'Singapore'
}) {
  if (!routeId) throw new ApiError('Route ID is required.', 400);

  const payload = {
    target: target.toUpperCase(),
    origin_date: originDate,
    horizon_sessions: Number(horizonSessions),
    route_id: routeId,
    cargo_type: cargoType,
    desired_cargo_tonnes: desiredCargoTonnes ? Number(desiredCargoTonnes) : null,
    risk_aversion: Number(riskAversion),
    bunker_location: bunkerLocation,
  };

  const raw = await apiFetch('/api/v1/historical/route-estimate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (import.meta.env.DEV) {
    console.debug('[Route Estimate Response]', raw);
  }

  return raw;
}
