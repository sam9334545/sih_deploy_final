import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Database, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';

const INDEX_METADATA = {
  BCI: {
    fullName: 'Baltic Capesize Index',
    vesselClass: 'Capesize',
    dwt: '180,000 DWT',
    cargoTypes: 'Iron Ore, Coking Coal',
    description: 'Benchmark for large bulkers primarily deployed on long-haul iron ore routes (Australia/Brazil to Asia). Highest volatility.',
    color: 'from-blue-600 to-indigo-700',
    accentBorder: 'border-blue-500/30',
  },
  BPI: {
    fullName: 'Baltic Panamax Index',
    vesselClass: 'Panamax / Kamsarmax',
    dwt: '75,000 – 82,000 DWT',
    cargoTypes: 'Thermal Coal, Grain, Bauxite',
    description: 'Workhorse of global grain and thermal coal trade. Ideal beam/draft fit for East Coast India discharge (e.g. Paradip, Dhamra).',
    color: 'from-cyan-600 to-blue-700',
    accentBorder: 'border-cyan-500/30',
  },
  BSI: {
    fullName: 'Baltic Supramax Index',
    vesselClass: 'Supramax / Ultramax',
    dwt: '58,000 – 64,000 DWT',
    cargoTypes: 'Minor Bulks, Fertilizers, Petcoke, Coal',
    description: 'Geared bulkers with onboard cranes & grabs. Crucial for draft-restricted or non-mechanized Indian berths (e.g. Haldia, Gopalpur).',
    color: 'from-emerald-600 to-teal-700',
    accentBorder: 'border-emerald-500/30',
  },
  BHSI: {
    fullName: 'Baltic Handysize Index',
    vesselClass: 'Handysize',
    dwt: '38,000 DWT',
    cargoTypes: 'Steel, Agricultural Products, Minerals',
    description: 'Flexible small bulkers able to access shallow berths and river ports without lighterage requirements.',
    color: 'from-purple-600 to-indigo-700',
    accentBorder: 'border-purple-500/30',
  },
};

export default function Dashboard({ onSelectForecast }) {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/v1/historical/market-summary')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch market summary`);
        return res.json();
      })
      .then(data => {
        setMarketData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed loading market summary:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner & Context */}
      <div className="glass-card p-6 border-white/10 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase">
                Verified Historical Market State
              </span>
              <ProvenanceBadge type="OBSERVED" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Baltic Dry-Bulk Index Dashboard
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Real daily Baltic Exchange sub-index time series from the verified Mendeley Data publication.
              These 4 core sub-indices form the foundational ground truth for the 72 Quantile LightGBM models.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-900/60 border border-white/5 rounded-xl p-3">
            <Calendar className="w-5 h-5 text-cyan-400" />
            <div>
              <div className="text-[11px] text-slate-400 uppercase font-mono">Dataset Cutoff</div>
              <div className="text-sm font-bold font-mono text-cyan-300">
                {marketData ? marketData.data_cutoff : '2019-07-31'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of 4 Indices */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card p-6 h-64 animate-pulse bg-slate-800/20" />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card p-6 border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-bold">Backend Connection Failed</div>
            <div className="text-xs text-rose-300/80">{error}. Ensure backend FastAPI server is running on :8000.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {marketData && Object.entries(marketData.indices).map(([idxKey, idxData]) => {
            const meta = INDEX_METADATA[idxKey] || {};
            return (
              <div
                key={idxKey}
                className={`glass-card p-6 flex flex-col justify-between relative group border ${meta.accentBorder}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl font-black font-mono tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                      {idxKey}
                    </span>
                    <ProvenanceBadge type={idxData.provenance} />
                  </div>

                  <div className="text-xs font-semibold text-slate-300 mb-1">
                    {meta.fullName}
                  </div>
                  <div className="text-[11px] text-cyan-400/90 font-mono mb-4">
                    {meta.vesselClass} • {meta.dwt}
                  </div>

                  <div className="bg-slate-900/60 rounded-lg p-3 border border-white/5 mb-4">
                    <div className="text-[11px] text-slate-400 font-mono">Latest Observed Index</div>
                    <div className="text-3xl font-extrabold font-mono text-white tracking-tight mt-0.5">
                      {idxData.latest_value ? idxData.latest_value.toLocaleString() : 'N/A'}
                      <span className="text-xs font-normal text-slate-400 ml-1.5">pts</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      As of {idxData.latest_date}
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
                    {meta.description}
                  </p>
                </div>

                <div>
                  <button
                    onClick={() => onSelectForecast && onSelectForecast(meta.vesselClass, idxKey)}
                    className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-300 hover:text-cyan-200 border border-white/10 hover:border-cyan-500/40 transition-all flex items-center justify-center gap-1.5"
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Forecast {meta.vesselClass}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dataset Verification & Provenance Card */}
      <div className="glass-card p-6 border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-bold text-white">
            Data Provenance & Integrity Declaration (Phase 6B)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5 space-y-1.5">
            <div className="font-semibold text-slate-300 font-mono">Dataset Identification</div>
            <div className="text-slate-400">
              Mendeley Data Dry Bulk Dataset (<code className="text-cyan-300">mendeley_baltic_subindices_2012_2019.csv</code>)
            </div>
            <div className="text-slate-500 font-mono text-[10px]">DOI: 10.17632/m645w433cx.1</div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5 space-y-1.5">
            <div className="font-semibold text-slate-300 font-mono">Temporal Boundary</div>
            <div className="text-slate-400">
              Strict historical window: <strong>2012-08-01</strong> to <strong>2019-07-31</strong>.
              1,749 trading days. Zero forward leakage.
            </div>
            <div className="text-emerald-400/90 font-mono text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 inline" /> 100% Verified Baltic Exchange Observations
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-lg border border-white/5 space-y-1.5">
            <div className="font-semibold text-slate-300 font-mono">2020+ Data Policy (PATH B)</div>
            <div className="text-slate-400">
              No legitimate post-2019 sub-index data exists in open access. Data is NEVER fabricated or extrapolated.
            </div>
            <div className="text-amber-400/90 font-mono text-[10px]">
              Ready for immediate retrain when commercial feed is plugged in.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
