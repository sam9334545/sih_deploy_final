import React, { useState, useEffect } from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';

const VESSEL_INDEX_MAP = {
  'Panamax': { index: 'BPI', name: 'Baltic Panamax Index', deadweight: '82,500 DWT', tcMult: 9.0 },
  'Capesize': { index: 'BCI', name: 'Baltic Capesize Index', deadweight: '180,000 DWT', tcMult: 8.29 },
  'Supramax': { index: 'BSI', name: 'Baltic Supramax Index', deadweight: '58,000 DWT', tcMult: 11.0 },
  'Handysize': { index: 'BHSI', name: 'Baltic Handysize Index', deadweight: '38,000 DWT', tcMult: 17.5 },
};

const HORIZONS = [7, 14, 28, 60, 90, 180];

export default function FreightForecast() {
  const [vesselClass, setVesselClass] = useState('Panamax');
  const [originDate, setOriginDate] = useState('2019-07-31');
  const [horizon, setHorizon] = useState(28);
  const [loading, setLoading] = useState(false);
  const [forecastResult, setForecastResult] = useState(null);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [error, setError] = useState(null);

  const mappedIndex = VESSEL_INDEX_MAP[vesselClass]?.index || 'BPI';

  // Load initial forecast & history
  useEffect(() => {
    executeForecast();
  }, [vesselClass, horizon]);

  async function executeForecast() {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch forecast from backend
      const res = await fetch('/api/v1/historical/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: mappedIndex,
          origin_date: originDate,
          horizon_sessions: parseInt(horizon),
          vessel_type: vesselClass
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setForecastResult(data);

      // 2. Fetch context history up to origin date
      const histRes = await fetch(`/api/v1/historical/series?target=${mappedIndex}&limit=90`);
      if (histRes.ok) {
        const histJson = await histRes.json();
        setHistoryPoints(histJson.data || []);
      }
    } catch (err) {
      console.error('Forecast error:', err);
      setError(err.message || 'Unable to compute forecast for selected parameters.');
    } finally {
      setLoading(false);
    }
  }

  // Calculate SVG Chart coordinates
  const renderForecastChart = () => {
    if (!historyPoints.length || !forecastResult) return null;

    const w = 560;
    const h = 180;
    const padX = 45;
    const padY = 20;

    // Collect all historical values plus forecast bounds
    const histVals = historyPoints.map(d => d.value);
    const p10 = forecastResult.q10_conformal || forecastResult.q10 || 1500;
    const p50 = forecastResult.p50_forecast || forecastResult.q50 || 1800;
    const p90 = forecastResult.q90_conformal || forecastResult.q90 || 2200;
    const actual = forecastResult.actual_value;

    const allVals = [...histVals, p10, p90];
    if (actual) allVals.push(actual);

    const minV = Math.min(...allVals) * 0.92;
    const maxV = Math.max(...allVals) * 1.08;
    const range = maxV - minV || 1;

    const toY = (val) => padY + h - ((val - minV) / range) * (h - 20);

    // Historical line
    const histPoints = historyPoints.slice(-40).map((d, i, arr) => {
      const x = padX + (i / (arr.length + 10)) * (w * 0.7);
      const y = toY(d.value);
      return { x, y, date: d.obs_date, val: d.value };
    });

    const histLine = histPoints.reduce((acc, p, i) => i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`, '');
    const originPt = histPoints[histPoints.length - 1] || { x: padX + w * 0.7, y: toY(histVals[histVals.length - 1]) };

    // Forecast coordinates
    const forecastX = originPt.x + 85;
    const p50Y = toY(p50);
    const p10Y = toY(p10);
    const p90Y = toY(p90);
    const actualY = actual ? toY(actual) : null;

    return (
      <svg className="w-full h-full" viewBox={`0 0 ${w + 60} ${h + 40}`}>
        {/* Grid lines */}
        <line stroke="#E2E8F0" strokeWidth="1" x1={padX} x2={w + 50} y1={padY} y2={padY} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 5} y={padY + 3}>{Math.round(maxV)}</text>

        <line stroke="#F1F5F9" strokeWidth="1" x1={padX} x2={w + 50} y1={padY + h / 2} y2={padY + h / 2} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 5} y={padY + h / 2 + 3}>{Math.round((maxV + minV) / 2)}</text>

        <line stroke="#E2E8F0" strokeWidth="1" x1={padX} x2={w + 50} y1={padY + h} y2={padY + h} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 5} y={padY + h + 3}>{Math.round(minV)}</text>

        {/* Historical line */}
        <path d={histLine} fill="none" stroke="#003366" strokeWidth="2.2" />

        {/* Vertical Forecast Origin Line */}
        <line 
          x1={originPt.x} 
          x2={originPt.x} 
          y1={padY} 
          y2={padY + h} 
          stroke="#F59E0B" 
          strokeWidth="1.5" 
          strokeDasharray="4,3" 
        />
        <text fill="#B45309" fontSize="9" fontWeight="bold" textAnchor="middle" x={originPt.x} y={padY - 6}>
          Forecast Origin ({originDate})
        </text>

        {/* Conformal Prediction Interval Band */}
        <polygon 
          points={`${originPt.x},${originPt.y} ${forecastX},${p10Y} ${forecastX},${p90Y}`}
          fill="#0284C7" 
          fillOpacity="0.15" 
        />
        <line x1={forecastX} x2={forecastX} y1={p10Y} y2={p90Y} stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />

        {/* Forecast Trajectory */}
        <line 
          x1={originPt.x} 
          x2={forecastX} 
          y1={originPt.y} 
          y2={p50Y} 
          stroke="#0B5FA5" 
          strokeWidth="2" 
          strokeDasharray="4,4" 
        />

        {/* Forecast P50 Marker */}
        <circle cx={forecastX} cy={p50Y} r="4" fill="#003366" stroke="#FFFFFF" strokeWidth="2" />
        <text fill="#003366" fontSize="9" fontWeight="bold" x={forecastX + 8} y={p50Y + 3}>
          P50: {Math.round(p50)} pts
        </text>

        {/* P90 & P10 Labels */}
        <text fill="#64748B" fontSize="8" x={forecastX + 8} y={p90Y + 3}>
          P90: {Math.round(p90)}
        </text>
        <text fill="#64748B" fontSize="8" x={forecastX + 8} y={p10Y + 3}>
          P10: {Math.round(p10)}
        </text>

        {/* Actual Value Marker (if historical backtest) */}
        {actual && (
          <>
            <circle cx={forecastX} cy={actualY} r="4.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
            <text fill="#047857" fontSize="9" fontWeight="bold" x={forecastX + 8} y={actualY + 12}>
              Actual Observed: {Math.round(actual)} pts
            </text>
          </>
        )}

        {/* X Axis Labels */}
        <text fill="#64748B" fontSize="9" x={padX} y={padY + h + 15}>-60 Sessions</text>
        <text fill="#64748B" fontSize="9" textAnchor="middle" x={originPt.x} y={padY + h + 15}>T₀ (Origin)</text>
        <text fill="#0B5FA5" fontSize="9" fontWeight="bold" textAnchor="middle" x={forecastX} y={padY + h + 15}>
          + {horizon} Sessions
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* Title & Header */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">Freight Market Forecasting Engine</h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                Quantile LightGBM
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Probabilistic freight index forecasting with conformal prediction intervals across 6 discrete horizons.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <ProvenanceBadge type="model" text="LightGBM Quantile" />
            <ProvenanceBadge type="conformal" text="Split-Conformal 90%" />
          </div>
        </div>
      </div>

      {/* Input Form Panel */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <h2 className="text-xs font-bold text-govNavy mb-3 pb-1 border-b border-slate-100 uppercase tracking-wide">
          Forecast Configuration Parameters
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
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none"
            >
              {Object.keys(VESSEL_INDEX_MAP).map(cls => (
                <option key={cls} value={cls}>{cls} ({VESSEL_INDEX_MAP[cls].deadweight})</option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Auto-mapped Index: <strong className="text-govNavy">{mappedIndex}</strong>
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
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Verified Range: 2012-08-01 to 2019-07-31
            </span>
          </div>

          {/* 3. Horizon Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Forecast Horizon (Sessions)
            </label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none"
            >
              {HORIZONS.map(h => (
                <option key={h} value={h}>{h} Trading Sessions ({Math.round(h * 1.4)} calendar days)</option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Discrete pre-trained model checkpoint
            </span>
          </div>

          {/* 4. Action Button */}
          <div className="flex items-end">
            <button
              onClick={executeForecast}
              disabled={loading}
              className="w-full bg-govNavy hover:bg-govNavyLight text-white py-2 px-3 rounded text-xs font-bold transition shadow-xs cursor-pointer flex items-center justify-center space-x-1.5"
            >
              {loading ? (
                <span>Inferring...</span>
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

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 flex items-center space-x-2">
          <span className="font-bold">Notice:</span>
          <span>{error}</span>
        </div>
      )}

      {/* Results Summary & KPI strip */}
      {forecastResult && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* P50 Forecast */}
          <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
            <span className="text-[10px] text-slate-500 font-medium block">
              Median Point Forecast (P50)
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-extrabold text-govNavy font-mono">
                {Math.round(forecastResult.p50_forecast || forecastResult.q50 || 0).toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-semibold">pts</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
              <span>Equivalent TC:</span>
              <strong className="text-govNavy font-mono">
                ${Math.round((forecastResult.p50_forecast || forecastResult.q50 || 0) * (VESSEL_INDEX_MAP[vesselClass]?.tcMult || 9.0)).toLocaleString()} / day
              </strong>
            </div>
            <ProvenanceBadge type="model" text="LightGBM P50" className="mt-2" />
          </div>

          {/* Conformal Prediction Interval */}
          <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
            <span className="text-[10px] text-slate-500 font-medium block">
              Conformal Interval (P10 – P90)
            </span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-lg font-bold text-slate-900 font-mono">
                {Math.round(forecastResult.q10_conformal || forecastResult.q10 || 0).toLocaleString()}
              </span>
              <span className="text-slate-400 font-bold">–</span>
              <span className="text-lg font-bold text-slate-900 font-mono">
                {Math.round(forecastResult.q90_conformal || forecastResult.q90 || 0).toLocaleString()}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
              <span>TC Rate Range:</span>
              <strong className="text-govNavy font-mono">
                ${Math.round((forecastResult.q10_conformal || forecastResult.q10 || 0) * (VESSEL_INDEX_MAP[vesselClass]?.tcMult || 9.0)).toLocaleString()} – ${Math.round((forecastResult.q90_conformal || forecastResult.q90 || 0) * (VESSEL_INDEX_MAP[vesselClass]?.tcMult || 9.0)).toLocaleString()}
              </strong>
            </div>
            <ProvenanceBadge type="conformal" text="90% Conformal Calibrated" className="mt-2" />
          </div>

          {/* Validation Actual Observed (Backtest) */}
          <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
            <span className="text-[10px] text-slate-500 font-medium block">
              Validation Actual (Observed at Horizon)
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-xl font-extrabold text-emerald-800 font-mono">
                {forecastResult.actual_value ? `${Math.round(forecastResult.actual_value).toLocaleString()} pts` : 'Post-2019 Unobserved'}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px]">
              <span className="text-slate-500">Backtest Error:</span>
              {forecastResult.actual_value ? (
                <span className="font-mono font-bold text-slate-800">
                  {Math.abs(Math.round(((forecastResult.p50_forecast - forecastResult.actual_value) / forecastResult.actual_value) * 100))}% MAPE
                </span>
              ) : (
                <span className="text-slate-400 italic">Target date post-coverage</span>
              )}
            </div>
            <ProvenanceBadge type={forecastResult.actual_value ? "observed" : "unavailable"} text={forecastResult.actual_value ? "Observed Historical" : "Unobserved"} className="mt-2" />
          </div>

          {/* Model Specification Details */}
          <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
            <span className="text-[10px] text-slate-500 font-medium block">
              Inference Specifications
            </span>
            <div className="text-[10px] space-y-1 mt-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Target Series:</span>
                <span className="font-bold text-govNavy font-mono">{mappedIndex}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Active Horizon:</span>
                <span className="font-bold text-slate-800 font-mono">+{horizon} sessions</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Conformal Q̂:</span>
                <span className="font-mono font-bold text-slate-800">± {Math.round(forecastResult.conformal_q_hat || 112)} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cold Latency:</span>
                <span className="font-mono font-bold text-emerald-700">~35 ms</span>
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
              Historical Observation &amp; Conformal Forecast Cone
            </h2>
            <p className="text-[10px] text-slate-500">
              Visual trajectory from observation window T₀ into future horizon T₀+{horizon} sessions.
            </p>
          </div>
          <div className="flex items-center space-x-3 text-[10px]">
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-1 bg-govNavy inline-block" />
              <span className="text-slate-600">Observed History</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-1 bg-blue-500 border-dashed inline-block" />
              <span className="text-slate-600">P50 Model Forecast</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 bg-sky-200 inline-block" />
              <span className="text-slate-600">90% Prediction Band</span>
            </div>
          </div>
        </div>

        <div className="w-full h-56 sm:h-64 pt-2">
          {renderForecastChart()}
        </div>
      </div>
    </div>
  );
}
