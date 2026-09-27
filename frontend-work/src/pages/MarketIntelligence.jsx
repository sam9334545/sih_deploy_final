import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Compass, 
  Ship, 
  Clock, 
  DollarSign, 
  RefreshCw, 
  Info,
  Calendar,
  Layers,
  ArrowRight,
  Activity,
  CheckCircle2
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { 
  fetchHistoricalSeries, 
  fetchMarketData, 
  fetchLowDemand, 
  fetchBallastMatrix, 
  fetchBackhaul, 
  ApiError 
} from '../api';

const VESSEL_CLASSES = ['Capesize', 'Panamax', 'Supramax', 'Handysize'];
const INDICES = ['BCI', 'BPI', 'BSI', 'BHSI'];

export default function MarketIntelligence() {
  const [activeTab, setActiveTab] = useState('trends'); // 'trends' | 'employment'
  const [selectedIndex, setSelectedIndex] = useState('BPI');
  const [selectedClass, setSelectedClass] = useState('Panamax');
  const [marketData, setMarketData] = useState(null);
  const [seriesData, setSeriesData] = useState([]);
  
  // Employment & Positioning states
  const [lowDemandData, setLowDemandData] = useState(null);
  const [ballastData, setBallastData] = useState(null);
  const [backhaulData, setBackhaulData] = useState(null);
  const [ballastFromPort, setBallastFromPort] = useState('INPRT');

  const [loading, setLoading] = useState(true);
  const [loadingEmployment, setLoadingEmployment] = useState(false);
  const [error, setError] = useState(null);

  const asOfDate = '2026-09-15';

  // Load primary market dashboard & series
  useEffect(() => {
    async function loadTrends() {
      setLoading(true);
      setError(null);
      try {
        const [mRes, sRes] = await Promise.all([
          fetchMarketData(asOfDate).catch(e => {
            console.warn('Market data warning:', e);
            return null;
          }),
          fetchHistoricalSeries({ target: selectedIndex, limit: 120 }).catch(e => {
            console.warn('Series fetch warning:', e);
            return { observations: [] };
          })
        ]);

        setMarketData(mRes);
        setSeriesData(sRes.observations || []);
      } catch (err) {
        console.error('Failed to load market trends:', err);
        setError('Failed to retrieve market telemetry from backend.');
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, [selectedIndex]);

  // Load employment & positioning data when tab is active or class changes
  useEffect(() => {
    if (activeTab !== 'employment') return;

    async function loadPositioning() {
      setLoadingEmployment(true);
      try {
        const [ldRes, bMatRes, bhRes] = await Promise.all([
          fetchLowDemand(selectedClass, 6, asOfDate).catch(e => {
            console.warn('Low demand notice:', e);
            return null;
          }),
          fetchBallastMatrix(selectedClass, ballastFromPort, asOfDate).catch(e => {
            console.warn('Ballast matrix notice:', e);
            return null;
          }),
          fetchBackhaul('AUHPT', 'INPRT', selectedClass, asOfDate).catch(e => {
            console.warn('Backhaul notice:', e);
            return null;
          })
        ]);

        setLowDemandData(ldRes);
        setBallastData(bMatRes);
        setBackhaulData(bhRes);
      } catch (err) {
        console.error('Failed to load employment data:', err);
      } finally {
        setLoadingEmployment(false);
      }
    }
    loadPositioning();
  }, [activeTab, selectedClass, ballastFromPort]);

  const values = seriesData.map(d => Number(d.value) || 0).filter(v => v > 0);
  const latest = values.length > 0 ? values[values.length - 1] : null;
  const meanVal = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  const minVal = values.length > 0 ? Math.min(...values) : null;
  const maxVal = values.length > 0 ? Math.max(...values) : null;

  return (
    <div className="space-y-4">
      {/* Top Header Banner & Tab Navigation */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-govNavy" />
            <h1 className="text-base font-bold text-govNavy font-serif">
              Maritime Market Intelligence &amp; Fleet Employment
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              Commercial Analytics
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Exploratory dry bulk index dynamics, macro commodities, ballast repositioning costs, and charterer demand-regime windows.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition cursor-pointer ${
              activeTab === 'trends'
                ? 'bg-govNavy text-white border-govNavy shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            Market Indicators &amp; Trends
          </button>
          <button
            onClick={() => setActiveTab('employment')}
            className={`px-3 py-1.5 rounded text-xs font-bold border transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'employment'
                ? 'bg-govNavy text-white border-govNavy shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            <Ship className="w-3.5 h-3.5 mr-1" />
            <span>Employment &amp; Positioning (Idle/Ballast)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Tab 1: Market Trends & Indicators */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {/* Index Selector Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-govNavy uppercase tracking-wide text-[10px]">
                Active Baltic Sub-Index:
              </span>
              <div className="flex space-x-1">
                {INDICES.map(idx => (
                  <button
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`px-3 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                      selectedIndex === idx
                        ? 'bg-govNavy text-white border-govNavy'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
                    }`}
                  >
                    {idx}
                  </button>
                ))}
              </div>
            </div>
            <ProvenanceBadge type="OBSERVED" text="Verified Time Series" />
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block font-sans">Latest Observation</span>
              <strong className="text-lg font-extrabold text-govNavy block mt-0.5">
                {latest ? `${Math.round(latest).toLocaleString()} pts` : '—'}
              </strong>
              <span className="text-[9px] text-slate-400 font-sans">As-Of: {asOfDate}</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block font-sans">Window Average</span>
              <strong className="text-lg font-extrabold text-slate-800 block mt-0.5">
                {meanVal ? `${meanVal.toLocaleString()} pts` : '—'}
              </strong>
              <span className="text-[9px] text-slate-400 font-sans">120-session mean</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block font-sans">Historical Low</span>
              <strong className="text-lg font-extrabold text-emerald-700 block mt-0.5">
                {minVal ? `${Math.round(minVal).toLocaleString()} pts` : '—'}
              </strong>
              <span className="text-[9px] text-slate-400 font-sans">Window Min</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
              <span className="text-[10px] text-slate-500 block font-sans">Historical High</span>
              <strong className="text-lg font-extrabold text-rose-700 block mt-0.5">
                {maxVal ? `${Math.round(maxVal).toLocaleString()} pts` : '—'}
              </strong>
              <span className="text-[9px] text-slate-400 font-sans">Window Max</span>
            </div>
          </div>

          {/* Historical Series Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                Recent Daily Baltic Session Log ({selectedIndex})
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {seriesData.length} recorded daily sessions
              </span>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs text-left gov-table border-collapse">
                <thead>
                  <tr>
                    <th>Observation Date</th>
                    <th>Sub-Index</th>
                    <th className="text-right">Index Value</th>
                    <th className="text-right">Daily Change</th>
                    <th className="text-right">Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {seriesData.slice(-15).reverse().map((row, idx, arr) => {
                    const prev = arr[idx + 1];
                    const change = prev ? row.value - prev.value : 0;
                    return (
                      <tr key={idx}>
                        <td className="font-semibold text-slate-800">{row.obs_date || row.date}</td>
                        <td className="font-sans text-slate-600">{row.target || selectedIndex}</td>
                        <td className="text-right font-bold text-govNavy">{Number(row.value).toLocaleString()}</td>
                        <td className={`text-right ${change >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(1)}` : '—'}
                        </td>
                        <td className="text-right font-sans">
                          <ProvenanceBadge type="OBSERVED" text="Observed" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Employment & Positioning (Section 23 - Idle, Backhaul, Ballast) */}
      {activeTab === 'employment' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Controls Bar for Class & Ballast Port */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center space-x-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Vessel Class</label>
                <div className="flex space-x-1">
                  {VESSEL_CLASSES.map(cls => (
                    <button
                      key={cls}
                      onClick={() => setSelectedClass(cls)}
                      className={`px-2.5 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                        selectedClass === cls
                          ? 'bg-govNavy text-white border-govNavy'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">Ballast Origin Port</label>
                <select
                  value={ballastFromPort}
                  onChange={(e) => setBallastFromPort(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded p-1 font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="INPRT">Paradip (INPRT)</option>
                  <option value="INVTZ">Visakhapatnam (INVTZ)</option>
                  <option value="INDHA">Dhamra (INDHA)</option>
                  <option value="INHAL">Haldia (INHAL)</option>
                  <option value="AUHPT">Hay Point (AUHPT)</option>
                </select>
              </div>
            </div>

            <ProvenanceBadge type="DERIVED" text="Ballast Model" />
          </div>

          {loadingEmployment ? (
            <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-400">
              Loading employment, low-demand regimes, and ballast matrices from backend...
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. Low-Demand Regimes Strip (Blueprint §26) */}
              {lowDemandData && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                    <div>
                      <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                        Six-Month Demand-Regime Strip: {selectedClass} Fleet
                      </h3>
                      <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                        {lowDemandData.headline}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Method: 5-Year Percentiles (p30/p70)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                    {lowDemandData.strip?.map((s) => {
                      const isLow = s.regime === 'LOW';
                      const isHigh = s.regime === 'HIGH';

                      return (
                        <div
                          key={s.month}
                          className={`p-3 rounded-lg border space-y-1.5 ${
                            isLow
                              ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                              : isHigh
                              ? 'bg-rose-50/50 border-rose-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-govNavy text-xs font-mono">{s.month}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                              isLow
                                ? 'bg-emerald-200 text-emerald-900'
                                : isHigh
                                ? 'bg-rose-200 text-rose-900'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {s.regime} Demand
                            </span>
                          </div>

                          <div className="text-xs font-mono">
                            <span className="text-[10px] text-slate-500 block font-sans">Forecast Point:</span>
                            <strong className="text-govNavy">{Math.round(s.forecast_point).toLocaleString()} pts</strong>
                          </div>

                          <p className="text-[10px] text-slate-600 leading-snug pt-1 border-t border-slate-200/50">
                            {s.charterer_reading}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Backhaul Insight & Ballast Economics */}
              {backhaulData && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <Ship className="w-4 h-4 text-govNavy" />
                      <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                        Backhaul Opportunity &amp; Ballast Premium Analysis
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Route: AUHPT → INPRT</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 md:col-span-2 space-y-1">
                      <strong className="text-govNavy block text-xs">Actionable Charterer Insight:</strong>
                      <p className="text-slate-700 leading-relaxed text-xs">{backhaulData.message}</p>
                      <span className="text-[10px] text-slate-500 block pt-1 font-mono">
                        Estimated Ballast Premium: <strong>${Math.round(backhaulData.ballast_premium_usd).toLocaleString()}</strong>
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                      <strong className="text-slate-800 block text-xs">Backhaul Availability Index:</strong>
                      <div className="text-xl font-mono font-extrabold text-govNavy">
                        {(backhaulData.backhaul_index * 100).toFixed(0)}%
                      </div>
                      <p className="text-[10px] text-slate-500">
                        100% = full paying backhaul (zero ballast priced in).
                      </p>
                    </div>
                  </div>

                  {/* Better Backhaul Alternatives */}
                  {backhaulData.better_backhaul_origins && backhaulData.better_backhaul_origins.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide block">
                        Alternative Corridors with Higher Backhaul Utilization:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {backhaulData.better_backhaul_origins.map((alt, i) => (
                          <div key={i} className="p-2 bg-slate-50 rounded border border-slate-200 text-xs font-mono">
                            <span className="font-sans font-bold text-slate-800 block">{alt.port_name}</span>
                            <span className="text-[10px] text-slate-500">
                              Backhaul: <strong>{(alt.backhaul_index * 100).toFixed(0)}%</strong> · {alt.distance_nm} nm
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Ballast Matrix Table */}
              {ballastData?.rows && (
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <div>
                      <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                        Ballast Repositioning Matrix from {ballastFromPort} ({selectedClass})
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Distance, sailing transit days, and ballast premium owners price into voyage rates.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Bunker VLSFO: ${ballastData.bunker_usd_mt}/mt
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs text-left gov-table border-collapse">
                      <thead>
                        <tr>
                          <th>From Port</th>
                          <th>To Destination</th>
                          <th className="text-right">Distance</th>
                          <th className="text-right">Ballast Days</th>
                          <th className="text-right">Full Ballast Cost</th>
                          <th className="text-right">Backhaul Index</th>
                          <th className="text-right">Priced Into Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {ballastData.rows.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td className="font-semibold text-slate-800 font-sans">{r.from_port}</td>
                            <td className="font-semibold text-slate-800 font-sans">{r.to_port}</td>
                            <td className="text-right">{r.distance_nm.toLocaleString()} nm</td>
                            <td className="text-right">{r.ballast_days} d</td>
                            <td className="text-right">${Math.round(r.ballast_cost_usd).toLocaleString()}</td>
                            <td className="text-right">{(r.backhaul_index * 100).toFixed(0)}%</td>
                            <td className="text-right font-extrabold text-govNavy">
                              ${Math.round(r.priced_into_rate_usd).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
