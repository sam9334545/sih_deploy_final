import React, { useState, useEffect } from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import HistoricalForecast from './HistoricalForecast';
import { 
  VESSEL_INDEX_MAP, 
  VALID_HORIZONS, 
  executeForecast, 
  fetchHistoricalSeries,
  ApiError
} from '../api';

export default function FreightForecast() {
  const [activeSubTab, setActiveSubTab] = useState('inference'); // 'inference' | 'backtest'
  const [vesselClass, setVesselClass] = useState('Panamax');
  const [originDate, setOriginDate] = useState('2019-07-31');
  const [horizon, setHorizon] = useState(28);
  
  // UX States: 'initial' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState('initial');
  const [forecastResult, setForecastResult] = useState(null);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const mappedIndex = VESSEL_INDEX_MAP[vesselClass]?.index || 'BPI';

  // Load initial forecast & historical series on mount
  useEffect(() => {
    runForecast();
  }, [vesselClass, horizon]);

  async function runForecast() {
    setStatus('loading');
    setErrorMessage(null);
    try {
      // 1. Call real backend inference endpoint
      const result = await executeForecast({
        target: mappedIndex,
        originDate,
        horizonSessions: Number(horizon),
        vesselType: vesselClass,
      });
      setForecastResult(result);

      // 2. Fetch context history up to origin date from real /historical/series
      try {
        const histData = await fetchHistoricalSeries({
          target: mappedIndex,
          endDate: originDate,
          limit: 90,
        });
        setHistoryPoints(histData.observations || []);
      } catch (histErr) {
        console.warn('Historical series context fetch notice:', histErr);
      }

      setStatus('success');
    } catch (err) {
      console.error('[Forecast Inference Error]:', err);
      setStatus('error');
      setForecastResult(null);
      setErrorMessage(
        err instanceof ApiError 
          ? err.message 
          : 'Unable to compute forecast for selected parameters. Please verify input selections.'
      );
    }
  }

  // Calculate SVG Chart coordinates from actual API data
  const renderForecastChart = () => {
    if (!forecastResult) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded border border-dashed border-slate-200 p-8">
          <p className="text-xs font-semibold">No active forecast trajectory loaded</p>
          <p className="text-[11px] mt-1 text-slate-500">Configure parameters above and click "Execute Model Inference".</p>
        </div>
      );
    }

    const w = 560;
    const h = 180;
    const padX = 50;
    const padY = 25;

    const histVals = historyPoints.map(d => d.value);
    const p10 = forecastResult.p10;
    const p50 = forecastResult.p50;
    const p90 = forecastResult.p90;
    const actual = forecastResult.actualValue;

    const allVals = [...(histVals.length ? histVals : [p50]), p10, p90];
    if (actual !== null) allVals.push(actual);

    const minV = Math.min(...allVals) * 0.90;
    const maxV = Math.max(...allVals) * 1.10;
    const range = maxV - minV || 1;

    const toY = (val) => padY + h - ((val - minV) / range) * (h - 20);

    // Historical points path
    const recentHistory = historyPoints.slice(-40);
    const histPoints = recentHistory.map((d, i, arr) => {
      const x = padX + (i / (arr.length + 8)) * (w * 0.72);
      const y = toY(d.value);
      return { x, y, date: d.obs_date, val: d.value };
    });

    const histLine = histPoints.length > 0
      ? histPoints.reduce((acc, p, i) => (i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`), '')
      : null;

    const originPt = histPoints.length > 0 
      ? histPoints[histPoints.length - 1] 
      : { x: padX + w * 0.72, y: toY(p50) };

    // Forecast coordinates
    const forecastX = Math.min(w + 35, originPt.x + 85);
    const p50Y = toY(p50);
    const p10Y = toY(p10);
    const p90Y = toY(p90);
    const actualY = actual !== null ? toY(actual) : null;

    return (
      <svg className="w-full h-full select-none" viewBox={`0 0 ${w + 70} ${h + 45}`}>
        {/* Horizontal grid lines */}
        <line stroke="#E2E8F0" strokeWidth="1" x1={padX} x2={w + 50} y1={padY} y2={padY} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 6} y={padY + 3}>{Math.round(maxV)}</text>

        <line stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3,3" x1={padX} x2={w + 50} y1={padY + h / 2} y2={padY + h / 2} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 6} y={padY + h / 2 + 3}>{Math.round((maxV + minV) / 2)}</text>

        <line stroke="#E2E8F0" strokeWidth="1" x1={padX} x2={w + 50} y1={padY + h} y2={padY + h} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 6} y={padY + h + 3}>{Math.round(minV)}</text>

        {/* Observed history trajectory */}
        {histLine && (
          <path d={histLine} fill="none" stroke="#003366" strokeWidth="2.2" strokeLinecap="round" />
        )}

        {/* Forecast Origin T0 Vertical Marker */}
        <line 
          x1={originPt.x} 
          x2={originPt.x} 
          y1={padY} 
          y2={padY + h} 
          stroke="#D97706" 
          strokeWidth="1.5" 
          strokeDasharray="4,3" 
        />
        <text fill="#B45309" fontSize="9" fontWeight="bold" textAnchor="middle" x={originPt.x} y={padY - 8}>
          T₀ Origin ({originDate})
        </text>

        {/* 80% Conformal Prediction Cone */}
        <polygon 
          points={`${originPt.x},${originPt.y} ${forecastX},${p10Y} ${forecastX},${p90Y}`}
          fill="#0284C7" 
          fillOpacity="0.14" 
        />
        <line x1={forecastX} x2={forecastX} y1={p10Y} y2={p90Y} stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />

        {/* Trajectory dashed line to P50 */}
        <line 
          x1={originPt.x} 
          x2={forecastX} 
          y1={originPt.y} 
          y2={p50Y} 
          stroke="#0B5FA5" 
          strokeWidth="2" 
          strokeDasharray="4,4" 
        />

        {/* P50 Forecast Node */}
        <circle cx={forecastX} cy={p50Y} r="4.5" fill="#003366" stroke="#FFFFFF" strokeWidth="2" />
        <text fill="#003366" fontSize="9.5" fontWeight="bold" x={forecastX + 8} y={p50Y + 3}>
          P50: {Math.round(p50).toLocaleString()} pts
        </text>

        {/* P10 & P90 boundary labels */}
        <text fill="#64748B" fontSize="8" x={forecastX + 8} y={p90Y + 3}>
          P90: {Math.round(p90).toLocaleString()}
        </text>
        <text fill="#64748B" fontSize="8" x={forecastX + 8} y={p10Y + 3}>
          P10: {Math.round(p10).toLocaleString()}
        </text>

        {/* Actual Observed realisation if available */}
        {actual !== null && actualY !== null && (
          <>
            <circle cx={forecastX} cy={actualY} r="5" fill="#059669" stroke="#FFFFFF" strokeWidth="2" />
            <text fill="#047857" fontSize="9" fontWeight="bold" x={forecastX + 8} y={actualY + 12}>
              Actual: {Math.round(actual).toLocaleString()} pts
            </text>
          </>
        )}

        {/* Bottom X-axis session markers */}
        <text fill="#64748B" fontSize="9" x={padX} y={padY + h + 16}>History Window</text>
        <text fill="#B45309" fontSize="9" fontWeight="semibold" textAnchor="middle" x={originPt.x} y={padY + h + 16}>T₀</text>
        <text fill="#0B5FA5" fontSize="9" fontWeight="bold" textAnchor="middle" x={forecastX} y={padY + h + 16}>
          +{horizon} Sessions
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header with Tab Switcher */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">Freight Market Forecasting Engine</h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                Quantile LightGBM
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Probabilistic freight index forecasting with finite-sample conformal calibration across 6 discrete trading horizons.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveSubTab('inference')}
              className={`px-3 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                activeSubTab === 'inference'
                  ? 'bg-govNavy text-white border-govNavy'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
            >
              Model Inference
            </button>
            <button
              onClick={() => setActiveSubTab('backtest')}
              className={`px-3 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                activeSubTab === 'backtest'
                  ? 'bg-govNavy text-white border-govNavy'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
            >
              Historical Backtesting
            </button>
          </div>
        </div>
      </div>

      {/* Sub-view: Historical Backtesting view */}
      {activeSubTab === 'backtest' ? (
        <HistoricalForecast initialVessel={vesselClass} />
      ) : (
        /* Sub-view: Main Live Model Inference */
        <>
          {/* Controls & Configuration Panel */}
          <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
            <h2 className="text-xs font-bold text-govNavy mb-3 pb-1 border-b border-slate-100 uppercase tracking-wide">
              Model Inference Configuration
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* 1. Vessel Class */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Vessel Segment
                </label>
                <select
                  value={vesselClass}
                  onChange={(e) => setVesselClass(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
                >
                  {Object.keys(VESSEL_INDEX_MAP).map(cls => (
                    <option key={cls} value={cls}>{cls} ({VESSEL_INDEX_MAP[cls].deadweight})</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Baltic Target: <strong className="text-govNavy font-mono">{mappedIndex}</strong>
                </span>
              </div>

              {/* 2. Forecast Origin Date */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Forecast Origin Date (T₀)
                </label>
                <input
                  type="date"
                  value={originDate}
                  max="2019-07-31"
                  min="2013-01-01"
                  onChange={(e) => setOriginDate(e.target.value)}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none font-mono cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Verified Range: 2012-08-01 to 2019-07-31
                </span>
              </div>

              {/* 3. Horizon Selector */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Forecast Horizon
                </label>
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                  className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
                >
                  {VALID_HORIZONS.map(h => (
                    <option key={h} value={h}>{h} Trading Sessions</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Discrete pre-trained model checkpoint
                </span>
              </div>

              {/* 4. Action Button */}
              <div className="flex items-end">
                <button
                  onClick={runForecast}
                  disabled={status === 'loading'}
                  className={`w-full py-2 px-3 rounded text-xs font-bold transition shadow-xs flex items-center justify-center space-x-1.5 ${
                    status === 'loading'
                      ? 'bg-slate-400 text-white cursor-not-allowed'
                      : 'bg-govNavy hover:bg-govNavyLight text-white cursor-pointer'
                  }`}
                >
                  {status === 'loading' ? (
                    <span>Running Inference...</span>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      <span>Execute Model Inference</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Notice if API fails */}
          {status === 'error' && (
            <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800 flex items-start space-x-2">
              <span className="font-bold">Error:</span>
              <div>
                <p>{errorMessage}</p>
                <p className="text-[10px] text-rose-600 mt-0.5">Please check backend status and parameters.</p>
              </div>
            </div>
          )}

          {/* Results Summary & KPI Strip */}
          {status === 'success' && forecastResult && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* P50 Forecast Card */}
              <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Median Point Forecast (P50)
                </span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className="text-xl font-extrabold text-govNavy font-mono">
                    {Math.round(forecastResult.p50).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">pts</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                  <span>Target Index:</span>
                  <strong className="text-govNavy font-mono">{forecastResult.target}</strong>
                </div>
                <ProvenanceBadge type="model" text="Quantile LightGBM P50" className="mt-2" />
              </div>

              {/* Conformal Prediction Interval Card */}
              <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Conformal Interval (P10 – P90)
                </span>
                <div className="flex items-baseline space-x-1 mt-0.5">
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {Math.round(forecastResult.p10).toLocaleString()}
                  </span>
                  <span className="text-slate-400 font-bold">–</span>
                  <span className="text-lg font-bold text-slate-900 font-mono">
                    {Math.round(forecastResult.p90).toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold ml-1">pts</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                  <span>Interval Width:</span>
                  <strong className="text-slate-800 font-mono">
                    ± {forecastResult.conformalQHat ? Math.round(forecastResult.conformalQHat).toLocaleString() : Math.round((forecastResult.p90 - forecastResult.p10) / 2).toLocaleString()} pts
                  </strong>
                </div>
                <ProvenanceBadge type="conformal" text="80% Conformal Calibrated" className="mt-2" />
              </div>

              {/* Validation Actual Observed Card */}
              <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Observed Actual Realisation
                </span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className={`text-xl font-extrabold font-mono ${
                    forecastResult.actualValue !== null ? 'text-emerald-800' : 'text-slate-500'
                  }`}>
                    {forecastResult.actualValue !== null 
                      ? `${Math.round(forecastResult.actualValue).toLocaleString()} pts` 
                      : 'Post-2019 Unobserved'}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Validation Status:</span>
                  {forecastResult.actualValue !== null ? (
                    <span className="font-mono font-bold text-emerald-700">
                      {forecastResult.percentageError !== null 
                        ? `${Math.abs(forecastResult.percentageError).toFixed(1)}% Error`
                        : 'Observed'}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Target post-2019 cutoff</span>
                  )}
                </div>
                <ProvenanceBadge 
                  type={forecastResult.actualValue !== null ? "observed" : "unavailable"} 
                  text={forecastResult.actualValue !== null ? "Observed Historical" : "Unobserved"} 
                  className="mt-2" 
                />
              </div>

              {/* Inference Specifications */}
              <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
                <span className="text-[10px] text-slate-500 font-medium block">
                  Inference Provenance
                </span>
                <div className="text-[10px] space-y-1 mt-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model:</span>
                    <span className="font-semibold text-slate-800 font-mono truncate">{forecastResult.modelName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active Horizon:</span>
                    <span className="font-bold text-slate-800 font-mono">+{forecastResult.horizonSessions} sessions</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Date:</span>
                    <span className="font-mono text-slate-700">{forecastResult.targetDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data Cutoff:</span>
                    <span className="font-mono font-semibold text-govNavy">{forecastResult.dataCutoff}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Visual Forecast Chart */}
          <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-2">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-xs font-bold text-govNavy">
                  Historical Observation &amp; Conformal Forecast Trajectory
                </h2>
                <p className="text-[10px] text-slate-500">
                  Visual trajectory from verified trading history into future horizon T₀+{horizon} sessions.
                </p>
              </div>
              <div className="flex items-center space-x-3 text-[10px]">
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-1 bg-govNavy inline-block" />
                  <span className="text-slate-600">Observed History</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-1 bg-blue-500 border-dashed inline-block" />
                  <span className="text-slate-600">P50 Median</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 bg-sky-200 inline-block" />
                  <span className="text-slate-600">80% Prediction Band (P10–P90)</span>
                </div>
                {forecastResult?.actualValue !== null && (
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full inline-block" />
                    <span className="text-slate-600">Observed Realisation</span>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full h-56 sm:h-64 pt-2">
              {renderForecastChart()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
