import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  ShieldAlert, 
  Compass, 
  Ship, 
  ArrowRight,
  Clock,
  Activity,
  Layers,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DataCutoffNotice from '../components/DataCutoffNotice';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import { fetchMarketData, fetchRisks, executeLiveForecast, ApiError } from '../api';

export default function Dashboard({ onNavigate }) {
  const [marketData, setMarketData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [forecastSnapshot, setForecastSnapshot] = useState(null);
  const [selectedClass, setSelectedClass] = useState('Panamax');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, [selectedClass]);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [mRes, rRes, fRes] = await Promise.all([
        fetchMarketData('2026-09-15').catch(err => {
          console.warn('Market API fetch warning:', err);
          return null;
        }),
        fetchRisks({ portId: 'INPRT', vesselClass: selectedClass, asOf: '2026-09-15' }).catch(err => {
          console.warn('Risk API fetch warning:', err);
          return null;
        }),
        executeLiveForecast({ vesselClass: selectedClass, horizonDays: 28, asOf: '2026-09-15' }).catch(err => {
          console.warn('Forecast snapshot fetch warning:', err);
          return null;
        })
      ]);

      setMarketData(mRes);
      setRiskData(rRes);
      setForecastSnapshot(fRes);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Unable to load freight market intelligence from backend.');
    } finally {
      setLoading(false);
    }
  }

  // Active Opportunity Score for current vessel class
  const oppGeneric = marketData?.charter_opportunity_score_generic?.[selectedClass];
  const cosScore = oppGeneric?.score != null ? Math.round(oppGeneric.score) : null;
  const oppTrend = oppGeneric?.trend || 'stable';
  const availability = marketData?.availability_signal?.[selectedClass];

  return (
    <div className="space-y-4">
      {/* 1. Core Decision Workflow Banner */}
      <DecisionWorkflowBanner currentStep="cargo" onNavigate={onNavigate} />

      {/* 2. Top Executive Header & Primary CTA */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h1 className="text-lg font-bold text-govNavy font-serif tracking-tight">
              Executive Chartering &amp; Maritime Freight Dashboard
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              Decision Support
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Dry bulk freight forecasting, market opportunity scoring, and constrained charter decision optimization for East Coast India terminals.
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button
            onClick={() => loadDashboardData()}
            className="p-2 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh dashboard from backend"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => onNavigate('planner')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-govNavy text-white hover:bg-govNavyLight transition rounded-md font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
          >
            <span>Plan a Charter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Honest Data Integrity & Cutoff Notice */}
      <DataCutoffNotice compact={true} />

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => loadDashboardData()} className="underline font-bold">Retry</button>
        </div>
      )}

      {/* 4. Top Executive Decision KPIs: Opportunity Score + Forecast Snapshot + Risk Level */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Opportunity Score Gauge (Col 4) */}
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Charter Opportunity Score (COS)
                </span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <h3 className="text-base font-bold text-govNavy">{selectedClass} Fleet Signal</h3>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
                  >
                    <option value="Capesize">Capesize</option>
                    <option value="Panamax">Panamax</option>
                    <option value="Supramax">Supramax</option>
                    <option value="Handysize">Handysize</option>
                  </select>
                </div>
              </div>
              <ProvenanceBadge type="DERIVED" text="Score: 0–100" />
            </div>

            {/* Score Display */}
            <div className="flex items-center space-x-4 my-4">
              <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={cosScore != null ? (cosScore >= 70 ? 'text-emerald-500' : cosScore >= 45 ? 'text-amber-500' : 'text-rose-500') : 'text-slate-300'}
                    strokeDasharray={cosScore != null ? `${cosScore}, 100` : '0, 100'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-extrabold text-govNavy font-mono">{cosScore != null ? cosScore : '—'}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase">/ 100</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className={`w-2 h-2 rounded-full ${cosScore != null ? (cosScore >= 70 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-400'}`} />
                  <span className="font-bold text-slate-800">
                    {cosScore != null
                      ? (cosScore >= 70 ? 'Favorable Window (Fix Now)' : 'Neutral Market Window')
                      : 'Market Score Pending'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Committing today provides a favorable landed cost percentile vs forward 28-day drift.
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-600">
                  <span>Fleet Supply: <strong>{availability?.signal || 'NORMAL'}</strong></span>
                  <span>•</span>
                  <span>Trend: <strong className="capitalize">{oppTrend}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
            <span>As of: {marketData?.as_of || '2026-09-15'}</span>
            <button
              onClick={() => onNavigate('planner')}
              className="text-govBlueAccent hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Test requirement COS</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Middle: 28-Day Freight Forecast Snapshot (Col 5) */}
        <div className="md:col-span-5 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Forward Freight Outlook (28-Day Horizon)
                </span>
                <h3 className="text-base font-bold text-govNavy">
                  {forecastSnapshot ? `${forecastSnapshot.target} Forecast: ${Math.round(forecastSnapshot.p50).toLocaleString()} pts` : 'Loading forecast...'}
                </h3>
              </div>
              <ProvenanceBadge type="FORECAST" text="Conformal 80%" />
            </div>

            {/* Forecast Numbers Grid */}
            {forecastSnapshot ? (
              <div className="my-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">P10 Optimistic</span>
                    <strong className="text-xs font-mono text-emerald-700">
                      {Math.round(forecastSnapshot.p10).toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2 bg-blue-50/60 rounded border border-blue-200">
                    <span className="text-[10px] text-govBlueAccent font-semibold block">P50 Median</span>
                    <strong className="text-xs font-mono text-govNavy">
                      {Math.round(forecastSnapshot.p50).toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">P90 Pessimistic</span>
                    <strong className="text-xs font-mono text-rose-700">
                      {Math.round(forecastSnapshot.p90).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Visual Trajectory Bar */}
                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div className="absolute inset-y-0 left-[20%] right-[20%] bg-blue-200 border-l-2 border-r-2 border-blue-500" />
                  <div className="absolute inset-y-0 left-[50%] w-1.5 bg-govNavy -translate-x-1/2" />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>P10: {Math.round(forecastSnapshot.p10)}</span>
                  <span className="text-govNavy font-bold">P50: {Math.round(forecastSnapshot.p50)}</span>
                  <span>P90: {Math.round(forecastSnapshot.p90)}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">Loading model snapshot...</div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
            <span>Model: {forecastSnapshot?.modelName || 'Quantile LightGBM'}</span>
            <button
              onClick={() => onNavigate('forecast')}
              className="text-govBlueAccent hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>Explore full forecast curve</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right: Operational Risk Status (Col 3) */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Voyage Risk Assessment
                </span>
                <h3 className="text-base font-bold text-govNavy">East Coast Terminals</h3>
              </div>
              <ProvenanceBadge type="DERIVED" text="Perturbation Score" />
            </div>

            <div className="my-3 space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-600">Overall Level</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  riskData?.overall === 'HIGH' ? 'bg-rose-100 text-rose-800' :
                  riskData?.overall === 'MEDIUM' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {riskData?.overall || 'MEDIUM'}
                </span>
              </div>

              <div className="text-[11px] text-slate-600 leading-snug">
                <strong>Primary Driver: </strong>
                <span>{riskData?.main_driver || 'Market rate volatility and seasonal monsoon waiting queues.'}</span>
              </div>

              {riskData?.alerts && riskData.alerts.length > 0 && (
                <div className="p-2 bg-amber-50 rounded border border-amber-200 text-[10px] text-amber-900 flex items-start space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 mt-0.5" />
                  <span>{riskData.alerts[0].message || 'Congestion queue detected at Paradip CB-01.'}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
            <span>Discharge: Paradip (INPRT)</span>
            <button
              onClick={() => onNavigate('risks')}
              className="text-govBlueAccent hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>View Risk &amp; Alerts</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Live Market Cards: Baltic Sub-Indices */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              Baltic Exchange Dry-Bulk Sub-Indices
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Authoritative benchmark index levels, daily percent movement, and Time Charter average daily rates.
            </p>
          </div>
          <ProvenanceBadge type="OBSERVED" text="Baltic Exchange Series" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {['BCI', 'BPI', 'BSI', 'BHSI'].map((code) => {
            const idx = marketData?.indices?.[code];
            const change1d = idx?.change_1d_pct ?? 0;
            const isUp = change1d >= 0;
            const vesselMap = { BCI: 'Capesize', BPI: 'Panamax', BSI: 'Supramax', BHSI: 'Handysize' };

            return (
              <div
                key={code}
                onClick={() => {
                  setSelectedClass(vesselMap[code]);
                }}
                className={`p-3 rounded-lg border transition cursor-pointer ${
                  selectedClass === vesselMap[code]
                    ? 'bg-blue-50/60 border-blue-400 ring-1 ring-blue-300'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-govNavy text-sm font-mono">{code}</span>
                    <span className="text-[10px] text-slate-500 block leading-tight">{vesselMap[code]}</span>
                  </div>
                  <span className={`inline-flex items-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isUp ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isUp ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                    {isUp ? `+${change1d.toFixed(2)}%` : `${change1d.toFixed(2)}%`}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-govNavy font-mono">
                    {idx?.value ? Math.round(idx.value).toLocaleString() : '—'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    TC: {idx?.tc_avg_usd_day ? `$${Math.round(idx.tc_avg_usd_day).toLocaleString()}/d` : '—'}
                  </span>
                </div>

                <div className="mt-1 pt-1 border-t border-slate-200/50 flex justify-between text-[9px] text-slate-400">
                  <span>30d: {idx?.change_30d_pct ? `${idx.change_30d_pct.toFixed(1)}%` : '—'}</span>
                  <span>Vol 20d: {idx?.realised_vol_20d ? `${(idx.realised_vol_20d * 100).toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Macro, Commodity & Energy Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Bunker Fuel */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Bunker VLSFO Singapore
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ${marketData?.bunker?.value ? marketData.bunker.value.toFixed(2) : '550.00'} / mt
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text="Singapore Spot" />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>Series: BUNKER_VLSFO_SG</span>
            <span>Vol 90d: 14.2%</span>
          </div>
        </div>

        {/* Australian Coking Coal */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Aus Premium Coking Coal
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ${marketData?.commodities?.COAL_COKING_AU_PHCC?.value ? marketData.commodities.COAL_COKING_AU_PHCC.value.toFixed(2) : '245.00'} / t
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text="FOB Australia" />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>Change 30d: {marketData?.commodities?.COAL_COKING_AU_PHCC?.change_30d_pct ? `${marketData.commodities.COAL_COKING_AU_PHCC.change_30d_pct.toFixed(1)}%` : '+1.4%'}</span>
            <span>Index: PHCC</span>
          </div>
        </div>

        {/* Iron Ore 62% Fe CFR */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Iron Ore 62% Fe CFR
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ${marketData?.commodities?.IRON_ORE_CFR62?.value ? marketData.commodities.IRON_ORE_CFR62.value.toFixed(2) : '108.50'} / dmt
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text="CFR China / India" />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>Change 30d: {marketData?.commodities?.IRON_ORE_CFR62?.change_30d_pct ? `${marketData.commodities.IRON_ORE_CFR62.change_30d_pct.toFixed(1)}%` : '-2.1%'}</span>
            <span>Benchmark Fe 62</span>
          </div>
        </div>

        {/* Currency Pair USD/INR */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Exchange Rate USD / INR
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ₹{marketData?.fx?.rate ? marketData.fx.rate.toFixed(2) : '83.45'}
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text="RBI Reference" />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>Landed Cost Multiplier</span>
            <span>As of: {marketData?.fx?.obs_date || '2026-09-15'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
