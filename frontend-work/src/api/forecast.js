import { apiFetch, ApiError } from './client';

/**
 * Vessel class to Baltic index code mapping.
 */
export const VESSEL_INDEX_MAP = {
  Capesize: { index: 'BCI', name: 'Baltic Capesize Index', deadweight: '180,000 DWT', tcMult: 8.29 },
  Panamax: { index: 'BPI', name: 'Baltic Panamax Index', deadweight: '82,500 DWT', tcMult: 9.0 },
  Supramax: { index: 'BSI', name: 'Baltic Supramax Index', deadweight: '58,000 DWT', tcMult: 11.0 },
  Handysize: { index: 'BHSI', name: 'Baltic Handysize Index', deadweight: '38,000 DWT', tcMult: 17.5 },
};

export const INDEX_VESSEL_MAP = {
  BCI: 'Capesize',
  BPI: 'Panamax',
  BSI: 'Supramax',
  BHSI: 'Handysize',
};

export const VALID_HORIZONS = [7, 14, 28, 60, 90, 180];
export const DATA_CUTOFF = '2019-07-31';

/**
 * Fetch available verified forecast origin dates.
 */
export async function fetchAvailableDates() {
  const data = await apiFetch('/api/v1/historical/dates');
  return data;
}

/**
 * Canonical Forecast Model interface.
 * Validates backend response and ensures no silent zero conversion.
 */
export function mapBackendForecast(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('Backend returned empty or invalid forecast payload.', 500);
  }

  // Check required numerical fields
  const p50 = typeof raw.p50 === 'number' ? raw.p50 : null;
  const p10 = typeof raw.p10_calibrated === 'number' ? raw.p10_calibrated : null;
  const p90 = typeof raw.p90_calibrated === 'number' ? raw.p90_calibrated : null;

  if (p50 === null || p10 === null || p90 === null) {
    console.error('[Forecast Integration Error] Missing required forecast percentiles:', raw);
    throw new ApiError(
      `Integration Error: Backend response missing valid numerical percentiles (p50: ${raw.p50}, p10_calibrated: ${raw.p10_calibrated}, p90_calibrated: ${raw.p90_calibrated}).`,
      500
    );
  }

  if (import.meta.env.DEV) {
    console.debug('[ML Forecast Response]', raw);
  }

  return {
    target: raw.target,
    vesselType: raw.vessel_type || INDEX_VESSEL_MAP[raw.target] || 'Panamax',
    originDate: raw.origin_date,
    targetDate: raw.target_date,
    horizonSessions: raw.horizon_sessions,
    p10,
    p50,
    p90,
    p10Raw: typeof raw.p10_raw === 'number' ? raw.p10_raw : p10,
    p50Raw: typeof raw.p50_raw === 'number' ? raw.p50_raw : p50,
    p90Raw: typeof raw.p90_raw === 'number' ? raw.p90_raw : p90,
    conformalQHat: typeof raw.conformal_q_hat === 'number' ? raw.conformal_q_hat : null,
    rawWidth: typeof raw.raw_width === 'number' ? raw.raw_width : null,
    calibratedWidth: typeof raw.calibrated_width === 'number' ? raw.calibrated_width : null,
    actualValue: typeof raw.actual_value === 'number' ? raw.actual_value : null,
    actualStatus: raw.actual_status || (raw.actual_value !== null ? 'OBSERVED' : 'NOT_AVAILABLE'),
    absoluteError: typeof raw.absolute_error === 'number' ? raw.absolute_error : null,
    percentageError: typeof raw.percentage_error === 'number' ? raw.percentage_error : null,
    insideRawInterval: typeof raw.inside_raw_interval === 'boolean' ? raw.inside_raw_interval : null,
    insideCalibratedInterval: typeof raw.inside_calibrated_interval === 'boolean' ? raw.inside_calibrated_interval : null,
    modelName: raw.model_name || 'QuantileLightGBM_SplitConformal',
    modelVersion: raw.model_version || 'phase5_triplet_v1',
    dataMode: raw.data_mode || 'HISTORICAL_DEVELOPMENT',
    dataCutoff: raw.data_cutoff || DATA_CUTOFF,
    provenance: raw.provenance || 'HISTORICAL_DEVELOPMENT',
    // Nominal coverage: SplitConformalCalibrator targets 80% (P10 to P90)
    nominalCoverage: 0.80,
    nominalCoverageLabel: '80% Conformal Calibrated (P10–P90)',
  };
}

/**
 * Execute real ML forecast inference via backend endpoint.
 */
export async function executeForecast({ target, originDate, horizonSessions, vesselType }) {
  if (!target) throw new ApiError('Target index is required.', 400);
  if (!originDate) throw new ApiError('Forecast origin date is required.', 400);
  if (!horizonSessions) throw new ApiError('Horizon sessions is required.', 400);

  const payload = {
    target: target.toUpperCase().trim(),
    origin_date: originDate,
    horizon_sessions: Number(horizonSessions),
    vessel_type: vesselType || INDEX_VESSEL_MAP[target.toUpperCase().trim()] || 'Panamax',
  };

  const raw = await apiFetch('/api/v1/historical/forecast', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return mapBackendForecast(raw);
}
