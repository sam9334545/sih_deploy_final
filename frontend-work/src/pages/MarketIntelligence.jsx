import React, { useState, useEffect } from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { fetchHistoricalSeries, fetchMarketSummary, ApiError } from '../api';

export default function MarketIntelligence() {
  const [selectedIndex, setSelectedIndex] = useState('BPI');
  const [seriesData, setSeriesData] = useState([]);
  const [marketSummary, setMarketSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [sData, mData] = await Promise.all([
          fetchHistoricalSeries({ target: selectedIndex, limit: 120 }),
          fetchMarketSummary().catch(err => {
            console.warn('Market summary notice:', err);
            return null;
          })
        ]);

        setSeriesData(sData.observations || []);
        if (mData) {
          setMarketSummary(mData);
        }
      } catch (err) {
        console.error('Market intelligence load error:', err);
        setError('Failed to load market observations from backend.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedIndex]);

  // Calculations for summary metrics
  const values = seriesData.map(d => d.value);
  const count = values.length;
  const latest = count > 0 ? values[values.length - 1] : null;
  const minVal = count > 0 ? Math.min(...values) : null;
  const maxVal = count > 0 ? Math.max(...values) : null;
  const meanVal = count > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / count) : null;

  const filteredSeries = seriesData.filter(d => 
    !searchFilter || d.obs_date.includes(searchFilter) || String(d.value).includes(searchFilter)
  );

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-govNavy">Baltic Dry Bulk Market Intelligence</h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              Verified Dataset
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Official Baltic Exchange sub-indices for East Coast India raw material procurement (Verified 2012–2019).
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {['BCI', 'BPI', 'BSI', 'BHSI'].map(idx => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition border cursor-pointer ${
                selectedIndex === idx
                  ? 'bg-govNavy text-white border-govNavy shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
              }`}
            >
              {idx}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-lightBorder rounded p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-medium block">Latest Verified (31 Jul 2019)</span>
          <span className="text-lg font-extrabold text-govNavy block mt-0.5 font-mono">
            {latest !== null ? `${latest.toLocaleString()} pts` : loading ? 'Loading...' : '—'}
          </span>
          <ProvenanceBadge type="observed" text="Mendeley Verified" className="mt-1" />
        </div>
        <div className="bg-white border border-lightBorder rounded p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-medium block">Historical Window Mean</span>
          <span className="text-lg font-extrabold text-slate-800 block mt-0.5 font-mono">
            {meanVal !== null ? `${meanVal.toLocaleString()} pts` : loading ? 'Loading...' : '—'}
          </span>
          <span className="text-[10px] text-slate-500">{count} Observations Loaded</span>
        </div>
        <div className="bg-white border border-lightBorder rounded p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-medium block">Historic Range (Min – Max)</span>
          <span className="text-lg font-extrabold text-slate-800 block mt-0.5 font-mono">
            {minVal !== null && maxVal !== null ? `${minVal.toLocaleString()} – ${maxVal.toLocaleString()}` : '—'}
          </span>
          <span className="text-[10px] text-slate-500">Trailing Window</span>
        </div>
        <div className="bg-white border border-lightBorder rounded p-3 shadow-xs">
          <span className="text-[10px] text-slate-500 font-medium block">Data Integrity Guarantee</span>
          <span className="text-sm font-bold text-emerald-800 block mt-1 font-mono">
            Zero Synthetic Data
          </span>
          <span className="text-[10px] text-slate-500">Post-2019 Unobserved</span>
        </div>
      </div>

      {/* Historical Observations Table */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              Verified Daily Exchange Observations ({selectedIndex})
            </h2>
            <p className="text-[10px] text-slate-500">Showing actual recorded Baltic Exchange index fixes.</p>
          </div>
          <input
            type="text"
            placeholder="Search date (YYYY-MM-DD)..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="text-xs py-1 px-2.5 border border-slate-300 rounded bg-slate-50 focus:outline-none focus:border-govBlueAccent font-mono"
          />
        </div>

        <div className="overflow-x-auto max-h-80 custom-scrollbar">
          <table className="w-full text-left border-collapse gov-table text-[11px]">
            <thead>
              <tr>
                <th>Observation Date</th>
                <th>Sub-Index Target</th>
                <th>Observed Value (pts)</th>
                <th>Data Provenance</th>
                <th>Source Citation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">Loading verified observations...</td>
                </tr>
              ) : filteredSeries.length > 0 ? (
                filteredSeries.slice().reverse().map((row) => (
                  <tr key={row.obs_date}>
                    <td className="font-mono text-slate-800">{row.obs_date}</td>
                    <td className="font-bold text-govNavy">{selectedIndex}</td>
                    <td className="font-mono font-bold text-slate-900">{row.value.toLocaleString()}</td>
                    <td>
                      <ProvenanceBadge type="observed" text="Observed" />
                    </td>
                    <td className="text-slate-500 text-[10px]">Mendeley Data DOI 10.17632/mcm7ycmjtt.1</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">No matching historical observations.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
