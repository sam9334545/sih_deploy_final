import React, { useState, useEffect } from 'react';
import { 
  LineChart as ChartIcon, Calendar, Clock, Target, AlertCircle, 
  CheckCircle, ArrowRight, ShieldCheck, HelpCircle, Layers 
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';

const VESSEL_TO_INDEX = {
  Panamax: 'BPI',
  Capesize: 'BCI',
  Supramax: 'BSI',
  Handysize: 'BHSI',
};

const HORIZONS = [
  { value: 7, label: '7 Sessions (~1.5 weeks)' },
  { value: 14, label: '14 Sessions (~3 weeks)' },
  { value: 28, label: '28 Sessions (~5.5 weeks / 1 month+)' },
  { value: 60, label: '60 Sessions (~3 months / quarterly)' },
  { value: 90, label: '90 Sessions (~4.5 months)' },
  { value: 180, label: '180 Sessions (~9 months / long-term)' },
];

export default function HistoricalForecast({ initialVessel = 'Panamax', onNavigateToRoute }) {
  const [vessel, setVessel] = useState(initialVessel);
  const [originDate, setOriginDate] = useState('2019-06-28');
  const [horizon, setHorizon] = useState(28);
  const [validDates, setValidDates] = useState([]);
  
  const [forecastResult, setForecastResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch valid historical dates
  useEffect(() => {
    fetch('/api/v1/historical/dates')
      .then(res => res.json())
      .then(data => {
        if (data.dates) {
          setValidDates(data.dates);
        }
      })
      .catch(err => console.error('Error fetching valid dates:', err));
  }, []);

  // Update target when vessel changes
  const targetIndex = VESSEL_TO_INDEX[vessel] || 'BPI';

  const handleGenerateForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/historical/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vessel_type: vessel,
          target_index: targetIndex,
          origin_date: originDate,
          horizon_sessions: Number(horizon),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || `HTTP ${res.status}: Inference failed`);
      }

      const data = await res.json();
      setForecastResult(data);
    } catch (err) {
      console.error('Forecast request error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run initial forecast on mount
  useEffect(() => {
    handleGenerateForecast();
  }, [vessel, originDate, horizon]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="glass-card p-6 border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase">
                Probabilistic Backtesting Engine
              </span>
              <ProvenanceBadge type="DERIVED" text="CONFORMAL LIGHTGBM" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Historical Point & Quantile Forecast
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Strictly leakage-free point (P50) and calibrated prediction intervals (P10–P90) generated using
              only historical market observations up to the selected forecast origin date $T$.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-white/5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="text-white font-bold">Zero-Leakage Guarantee</div>
              <div className="text-[11px] text-slate-400">Features built strictly from $t \le T$</div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel: Vessel, Date, Horizon */}
      <div className="glass-card p-6 border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Vessel Selector */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
            Vessel Class
          </label>
          <select
            value={vessel}
            onChange={(e) => setVessel(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
          >
            <option value="Panamax">Panamax (BPI) • 75-82k DWT</option>
            <option value="Capesize">Capesize (BCI) • 180k DWT</option>
            <option value="Supramax">Supramax (BSI) • 58-64k DWT</option>
            <option value="Handysize">Handysize (BHSI) • 38k DWT</option>
          </select>
        </div>

        {/* Index Mapped (Readonly) */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
            Mapped Baltic Index
          </label>
          <div className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-cyan-400 font-mono font-bold flex items-center justify-between">
            <span>{targetIndex}</span>
            <ProvenanceBadge type="OBSERVED" text="EXCHANGE TARGET" />
          </div>
        </div>

        {/* Forecast Origin Date */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
            Forecast Origin ($T$)
          </label>
          <input
            type="date"
            min="2012-08-01"
            max="2019-07-31"
            value={originDate}
            onChange={(e) => setOriginDate(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors font-mono"
          />
        </div>

        {/* Forecast Horizon */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
            Forecast Horizon ($h$)
          </label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="w-full bg-slate-900/90 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
          >
            {HORIZONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Results Container */}
      {loading ? (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-mono text-cyan-300">
            Constructing 39 leakage-safe features & running Quantile LightGBM models...
          </p>
        </div>
      ) : error ? (
        <div className="glass-card p-6 border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-bold">Inference Error</div>
            <div className="text-xs text-rose-300/80">{error}</div>
          </div>
        </div>
      ) : forecastResult ? (
        <div className="space-y-6">
          {/* Top Metric Cards: P10, P50, P90, and Actual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* P10 Card */}
            <div className="glass-card p-5 border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-blue-300 uppercase font-semibold">
                  P10 Lower Bound
                </span>
                <ProvenanceBadge type="DERIVED" text="CONFORMAL" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {Math.round(forecastResult.forecast.p10_calibrated).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Raw P10: {Math.round(forecastResult.forecast.p10_raw).toLocaleString()}
              </div>
            </div>

            {/* P50 Card (Median) */}
            <div className="glass-card p-5 border-cyan-500/40 bg-cyan-500/10 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-cyan-300 uppercase font-bold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  P50 Point Forecast
                </span>
                <ProvenanceBadge type="DERIVED" text="LGBM MEDIAN" />
              </div>
              <div className="text-3xl font-black font-mono text-cyan-300">
                {Math.round(forecastResult.forecast.p50_calibrated).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
              </div>
              <div className="text-[11px] text-cyan-200/70 font-mono mt-1">
                Monotonically rearranged median
              </div>
            </div>

            {/* P90 Card */}
            <div className="glass-card p-5 border-indigo-500/30 bg-indigo-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-indigo-300 uppercase font-semibold">
                  P90 Upper Bound
                </span>
                <ProvenanceBadge type="DERIVED" text="CONFORMAL" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {Math.round(forecastResult.forecast.p90_calibrated).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Raw P90: {Math.round(forecastResult.forecast.p90_raw).toLocaleString()}
              </div>
            </div>

            {/* Actual Future Value Card */}
            <div className={`glass-card p-5 ${
              forecastResult.actual.status === 'AVAILABLE'
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-slate-700 bg-slate-900/40'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-slate-300 uppercase font-semibold">
                  Future Actual $Y(T+h)$
                </span>
                <ProvenanceBadge 
                  type={forecastResult.actual.status === 'AVAILABLE' ? 'OBSERVED' : 'NOT_AVAILABLE'} 
                />
              </div>
              {forecastResult.actual.status === 'AVAILABLE' ? (
                <>
                  <div className="text-3xl font-extrabold font-mono text-emerald-300">
                    {Math.round(forecastResult.actual.actual_value).toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 ml-1">pts</span>
                  </div>
                  <div className="text-[11px] text-emerald-400/80 font-mono mt-1">
                    Observed on {forecastResult.actual.target_date}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold font-mono text-slate-500">
                    NOT_AVAILABLE
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Target date ({forecastResult.actual.target_date}) is post-2019 cutoff. Zero fabrication rule enforced.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Visual Prediction Interval Visualization */}
          <div className="glass-card p-6 border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ChartIcon className="w-5 h-5 text-cyan-400" />
                  Calibrated Prediction Interval Fan
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visual representation of the 80% conformal prediction band vs the observed realization.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-blue-300">
                  <span className="w-3 h-3 rounded bg-blue-500/30 border border-blue-400" />
                  80% Interval (P10–P90)
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
                  P50 Forecast
                </span>
                {forecastResult.actual.status === 'AVAILABLE' && (
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                    Actual Observation
                  </span>
                )}
              </div>
            </div>

            {/* Interval Bar Graphic */}
            <div className="bg-slate-950/80 p-6 rounded-xl border border-white/5">
              {(() => {
                const p10 = forecastResult.forecast.p10_calibrated;
                const p50 = forecastResult.forecast.p50_calibrated;
                const p90 = forecastResult.forecast.p90_calibrated;
                const act = forecastResult.actual.status === 'AVAILABLE' ? forecastResult.actual.actual_value : null;

                const minVal = Math.min(p10, act ? Math.min(p10, act) : p10) * 0.9;
                const maxVal = Math.max(p90, act ? Math.max(p90, act) : p90) * 1.1;
                const range = maxVal - minVal || 1;

                const getPercent = (v) => Math.max(0, Math.min(100, ((v - minVal) / range) * 100));

                const p10Pct = getPercent(p10);
                const p50Pct = getPercent(p50);
                const p90Pct = getPercent(p90);
                const actPct = act ? getPercent(act) : null;

                return (
                  <div className="space-y-6">
                    {/* Gauge track */}
                    <div className="relative h-12 bg-slate-900 rounded-lg border border-white/10 flex items-center px-4">
                      {/* Band P10 to P90 */}
                      <div
                        className="absolute h-8 rounded-md bg-gradient-to-r from-blue-500/30 via-cyan-500/40 to-indigo-500/30 border-y border-cyan-400/50"
                        style={{
                          left: `${p10Pct}%`,
                          width: `${Math.max(2, p90Pct - p10Pct)}%`,
                        }}
                      />

                      {/* P10 Marker */}
                      <div
                        className="absolute top-1 bottom-1 w-0.5 bg-blue-400"
                        style={{ left: `${p10Pct}%` }}
                      >
                        <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-mono text-blue-300">
                          P10
                        </span>
                      </div>

                      {/* P50 Marker */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-cyan-300 z-10"
                        style={{ left: `${p50Pct}%` }}
                      >
                        <div className="w-3.5 h-3.5 bg-cyan-400 rounded-full border-2 border-slate-950 absolute -top-1.5 -left-1.5 shadow-md shadow-cyan-400/50" />
                        <span className="absolute -bottom-5 -translate-x-1/2 text-[10px] font-mono font-bold text-cyan-300">
                          P50 ({Math.round(p50)})
                        </span>
                      </div>

                      {/* P90 Marker */}
                      <div
                        className="absolute top-1 bottom-1 w-0.5 bg-indigo-400"
                        style={{ left: `${p90Pct}%` }}
                      >
                        <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-mono text-indigo-300">
                          P90
                        </span>
                      </div>

                      {/* Actual Realization Marker (if available) */}
                      {actPct !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-emerald-400 z-20"
                          style={{ left: `${actPct}%` }}
                        >
                          <div className="w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-950 absolute -top-2 -left-1.5 shadow-md shadow-emerald-400/70 animate-bounce" />
                          <span className="absolute -top-6 -translate-x-1/2 text-[10px] font-mono font-extrabold text-emerald-400 bg-slate-950 px-1 rounded border border-emerald-500/40">
                            Actual ({Math.round(act)})
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-slate-500 px-1">
                      <span>Low: {Math.round(minVal)} pts</span>
                      <span>High: {Math.round(maxVal)} pts</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Forecast Error & Verification Summary */}
          {forecastResult.evaluation && forecastResult.evaluation.has_actual ? (
            <div className="glass-card p-6 border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  Historical Backtest Verification Metrics
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-slate-400 font-mono">Absolute Point Error</div>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {Math.round(forecastResult.evaluation.absolute_error).toLocaleString()}
                    <span className="text-xs text-slate-400 font-normal ml-1">pts</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    |P50 - Actual|
                  </div>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                  <div className="text-xs text-slate-400 font-mono">Percentage Error (APE)</div>
                  <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
                    {forecastResult.evaluation.percentage_error.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1">
                    Relative deviation to realized price
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  forecastResult.evaluation.inside_interval
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="text-xs font-mono uppercase">
                    Inside Calibrated Interval?
                  </div>
                  <div className="text-2xl font-black font-mono mt-1 flex items-center gap-2">
                    {forecastResult.evaluation.inside_interval ? 'YES' : 'NO (TAIL EVENT)'}
                  </div>
                  <div className="text-[10px] opacity-80 font-mono mt-1">
                    {forecastResult.evaluation.inside_interval
                      ? 'Realized price within 80% coverage band'
                      : 'Outside conformal prediction bounds'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-6 border-amber-500/20 bg-amber-500/5 text-slate-300">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-amber-300">
                    Out-of-Sample Horizon (Post-Cutoff Realization)
                  </div>
                  <p className="text-slate-400">
                    The forecast origin ({forecastResult.forecast.origin_date}) plus {forecastResult.forecast.horizon_sessions} trading sessions targets 
                    <strong className="text-white font-mono"> {forecastResult.forecast.target_date}</strong>, which extends past the verified 2019-07-31 cutoff.
                    In compliance with the Phase 6B Data Integrity Rule, error metrics are marked <code className="text-amber-300 font-mono">NOT_AVAILABLE</code> rather than fabricated.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action to proceed to Route Analysis */}
          <div className="flex justify-end">
            <button
              onClick={() => onNavigateToRoute && onNavigateToRoute(vessel, forecastResult)}
              className="btn-primary"
            >
              <span>Analyze East Coast India Route with this Forecast</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
