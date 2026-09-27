import React, { useState, useEffect } from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { 
  CANONICAL_ROUTES, 
  VESSEL_INDEX_MAP, 
  VALID_HORIZONS, 
  fetchRouteEstimate,
  ApiError 
} from '../api';

const VESSEL_SPECS = {
  Panamax: { name: 'Panamax', dwt: 82500, maxDraft: 14.5, speedKn: 12.5, index: 'BPI' },
  Capesize: { name: 'Capesize', dwt: 180000, maxDraft: 18.2, speedKn: 13.0, index: 'BCI' },
  Supramax: { name: 'Supramax', dwt: 58000, maxDraft: 12.8, speedKn: 12.5, index: 'BSI' },
  Handysize: { name: 'Handysize', dwt: 38000, maxDraft: 10.5, speedKn: 12.0, index: 'BHSI' },
};

export default function RouteAnalysis() {
  const [routesList, setRoutesList] = useState(CANONICAL_ROUTES);
  const [selectedRouteId, setSelectedRouteId] = useState(CANONICAL_ROUTES[0].id);
  const [vesselClass, setVesselClass] = useState('Panamax');
  const [cargoQty, setCargoQty] = useState(75000);
  const [horizon, setHorizon] = useState(28);
  const [riskAversion, setRiskAversion] = useState(0.5);
  
  // UX states: 'initial' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState('initial');
  const [estimateResult, setEstimateResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    async function loadRoutes() {
      try {
        const routes = await fetchRoutesList();
        if (routes && routes.length > 0) {
          setRoutesList(routes.map(r => ({
            id: r.route_id,
            name: `${r.origin_port_name || r.origin_port} → ${r.destination_port_name || r.destination_port}`,
            originPort: r.origin_port,
            destPort: r.destination_port,
            dist: r.distance_nm,
            cargo: 'coking_coal'
          })));
        }
      } catch (err) {
        console.warn('Backend routes load notice, using canonical routes:', err);
      }
    }
    loadRoutes();
  }, []);

  const selectedRoute = routesList.find(r => r.id === selectedRouteId) || routesList[0] || CANONICAL_ROUTES[0];
  const vesselSpec = VESSEL_SPECS[vesselClass] || VESSEL_SPECS.Panamax;
  const mappedTarget = VESSEL_INDEX_MAP[vesselClass]?.index || 'BPI';

  useEffect(() => {
    runRouteEconomics();
  }, [selectedRouteId, vesselClass, horizon, riskAversion]);

  async function runRouteEconomics() {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const data = await fetchRouteEstimate({
        target: mappedTarget,
        originDate: '2019-07-31',
        horizonSessions: Number(horizon),
        routeId: selectedRouteId,
        cargoType: selectedRoute.cargo,
        desiredCargoTonnes: Number(cargoQty) || null,
        riskAversion: Number(riskAversion),
        bunkerLocation: 'Singapore'
      });

      setEstimateResult(data);
      setStatus('success');
    } catch (err) {
      console.error('[Route Analysis Error]:', err);
      setStatus('error');
      setEstimateResult(null);
      setErrorMessage(
        err instanceof ApiError 
          ? err.message 
          : 'Failed to calculate voyage economics for the selected route corridor.'
      );
    }
  }

  const p50Scenario = estimateResult?.scenario_p50;
  const p10Scenario = estimateResult?.scenario_p10;
  const p90Scenario = estimateResult?.scenario_p90;
  const isFeasible = estimateResult ? estimateResult.status === 'feasible' : true;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">Maritime Route Economics &amp; Voyage Analysis</h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                Admiralty Searoute Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Corridor-specific freight translation, bunker consumption, port turnaround, and draft feasibility for East Coast India.
            </p>
          </div>
          <ProvenanceBadge type="derived" text="Great Circle + Distance Constraints" />
        </div>
      </div>

      {/* Control Panel: Route, Vessel, Cargo, Horizon */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <h2 className="text-xs font-bold text-govNavy mb-3 pb-1 border-b border-slate-100 uppercase tracking-wide">
          Voyage &amp; Route Corridor Parameters
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* 1. Route Selector */}
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Select Maritime Corridor (Origin → Destination)
            </label>
            <select
              value={selectedRouteId}
              onChange={(e) => setSelectedRouteId(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
            >
              {routesList.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} • {r.dist ? r.dist.toLocaleString() : '—'} nm
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Corridor ID: <strong className="font-mono text-govNavy">{selectedRoute.id}</strong> ({selectedRoute.cargo.replace('_', ' ')})
            </span>
          </div>

          {/* 2. Vessel Class */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Vessel Segment
            </label>
            <select
              value={vesselClass}
              onChange={(e) => {
                const newVessel = e.target.value;
                setVesselClass(newVessel);
                if (newVessel === 'Capesize') setCargoQty(165000);
                else if (newVessel === 'Panamax') setCargoQty(75000);
                else if (newVessel === 'Supramax') setCargoQty(54000);
                else setCargoQty(35000);
              }}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
            >
              {Object.keys(VESSEL_SPECS).map(v => (
                <option key={v} value={v}>
                  {v} ({VESSEL_SPECS[v].dwt.toLocaleString()} DWT)
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Max Draft: <strong className="font-mono text-slate-800">{vesselSpec.maxDraft} m</strong>
            </span>
          </div>

          {/* 3. Horizon */}
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
              Target: <strong className="font-mono text-govNavy">{mappedTarget}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Feasibility Alert Banner */}
      {status === 'success' && estimateResult && !isFeasible && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded p-4 text-xs text-rose-900 shadow-xs">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <strong className="text-sm font-bold block text-rose-950">
                Route Infeasible: Physical Port / Navigational Constraint Violated
              </strong>
              <p className="mt-1 text-rose-800">
                {estimateResult.compatibility_reasons && estimateResult.compatibility_reasons.length > 0
                  ? estimateResult.compatibility_reasons.join(' • ')
                  : `Vessel laden draft (${vesselSpec.maxDraft}m) exceeds the permissible draft at the destination port.`}
              </p>
              <p className="text-[10px] text-rose-700 mt-1">
                Zero fake numbers rule: Rates shown below represent mathematical unconstrained shadow costs and must not be chartered without offshore lightering.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {status === 'loading' && (
        <div className="bg-white border border-lightBorder rounded p-12 text-center space-y-2 shadow-xs">
          <div className="w-8 h-8 border-3 border-govNavy/20 border-t-govNavy rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-govNavy font-semibold">
            Computing Admiralty nautical distances, bunker consumption, and P10/P50/P90 voyage economics...
          </p>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 text-xs text-rose-800">
          <strong className="font-bold">Voyage Economics Error: </strong>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Results Dashboard */}
      {status === 'success' && estimateResult && p50Scenario && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Median Freight $/tonne */}
            <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
              <span className="text-[10px] text-slate-500 font-medium block">
                Estimated Freight Rate (P50)
              </span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="text-2xl font-black text-govNavy font-mono">
                  ${p50Scenario.freight_usd_per_tonne.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 font-semibold">/ tonne</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600 font-mono">
                <span>P10–P90 Range:</span>
                <strong>${p10Scenario.freight_usd_per_tonne.toFixed(2)} – ${p90Scenario.freight_usd_per_tonne.toFixed(2)}</strong>
              </div>
              <ProvenanceBadge type="derived" text="Voyage Economics P50" className="mt-2" />
            </div>

            {/* Total Voyage Days */}
            <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
              <span className="text-[10px] text-slate-500 font-medium block">
                Total Voyage Duration
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {p50Scenario.voyage_days.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500 font-semibold ml-1">days</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                <span>Distance:</span>
                <strong className="font-mono text-slate-800">{selectedRoute.dist.toLocaleString()} nm</strong>
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                Speed: {vesselSpec.speedKn} knots laden
              </div>
            </div>

            {/* Total Voyage Cost */}
            <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
              <span className="text-[10px] text-slate-500 font-medium block">
                Total Voyage Cost (P50)
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-xl font-extrabold text-govNavy font-mono">
                  ${Math.round(p50Scenario.total_voyage_cost_usd).toLocaleString()}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                <span>Bunker Fuel Cost:</span>
                <strong className="font-mono text-slate-800">${Math.round(p50Scenario.bunker_cost_usd).toLocaleString()}</strong>
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                Pricing: Singapore VLSFO
              </div>
            </div>

            {/* Equivalent TCE Rate */}
            <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
              <span className="text-[10px] text-slate-500 font-medium block">
                Underlying TCE Benchmark
              </span>
              <div className="flex items-baseline space-x-1 mt-0.5">
                <span className="text-xl font-extrabold text-slate-800 font-mono">
                  ${Math.round(p50Scenario.tce_usd_day).toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-semibold">/ day</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
                <span>Index Level:</span>
                <strong className="font-mono text-govNavy">{Math.round(p50Scenario.index_level).toLocaleString()} pts ({mappedTarget})</strong>
              </div>
              <div className="text-[9px] text-slate-400 mt-1">
                Risk Aversion (&lambda;): {riskAversion}
              </div>
            </div>
          </div>

          {/* Scenario Comparison Table */}
          <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-govNavy uppercase tracking-wide border-b border-slate-100 pb-2">
              Probabilistic Voyage Economics Scenarios (P10 / P50 / P90)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse gov-table text-[11px]">
                <thead>
                  <tr>
                    <th>Market Scenario</th>
                    <th>Index Level ({mappedTarget})</th>
                    <th>TCE ($/day)</th>
                    <th>Voyage Duration</th>
                    <th>Bunker Fuel Cost</th>
                    <th>Total Voyage Expense</th>
                    <th>Freight ($/tonne)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-blue-50/20">
                    <td className="font-bold text-blue-900">P10 (Soft Market / Favorable)</td>
                    <td className="font-mono">{Math.round(p10Scenario.index_level).toLocaleString()} pts</td>
                    <td className="font-mono">${Math.round(p10Scenario.tce_usd_day).toLocaleString()}/day</td>
                    <td className="font-mono">{p10Scenario.voyage_days.toFixed(1)} days</td>
                    <td className="font-mono">${Math.round(p10Scenario.bunker_cost_usd).toLocaleString()}</td>
                    <td className="font-mono font-semibold">${Math.round(p10Scenario.total_voyage_cost_usd).toLocaleString()}</td>
                    <td className="font-mono font-bold text-blue-800">${p10Scenario.freight_usd_per_tonne.toFixed(2)}/t</td>
                  </tr>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="font-bold text-govNavy">P50 (Median Baseline Forecast)</td>
                    <td className="font-mono text-govNavy">{Math.round(p50Scenario.index_level).toLocaleString()} pts</td>
                    <td className="font-mono text-govNavy">${Math.round(p50Scenario.tce_usd_day).toLocaleString()}/day</td>
                    <td className="font-mono">{p50Scenario.voyage_days.toFixed(1)} days</td>
                    <td className="font-mono">${Math.round(p50Scenario.bunker_cost_usd).toLocaleString()}</td>
                    <td className="font-mono font-bold text-govNavy">${Math.round(p50Scenario.total_voyage_cost_usd).toLocaleString()}</td>
                    <td className="font-mono font-extrabold text-govNavy text-xs">${p50Scenario.freight_usd_per_tonne.toFixed(2)}/t</td>
                  </tr>
                  <tr className="bg-amber-50/20">
                    <td className="font-bold text-amber-900">P90 (Tight Market / Volatile Spike)</td>
                    <td className="font-mono">{Math.round(p90Scenario.index_level).toLocaleString()} pts</td>
                    <td className="font-mono">${Math.round(p90Scenario.tce_usd_day).toLocaleString()}/day</td>
                    <td className="font-mono">{p90Scenario.voyage_days.toFixed(1)} days</td>
                    <td className="font-mono">${Math.round(p90Scenario.bunker_cost_usd).toLocaleString()}</td>
                    <td className="font-mono font-semibold">${Math.round(p90Scenario.total_voyage_cost_usd).toLocaleString()}</td>
                    <td className="font-mono font-bold text-amber-800">${p90Scenario.freight_usd_per_tonne.toFixed(2)}/t</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Risk-Adjusted Freight: <strong className="font-mono text-slate-800">${estimateResult.risk_adjusted_freight_usd_t.toFixed(2)} / tonne</strong></span>
              <span>Lighterage Required: <strong className={estimateResult.requires_lighterage ? "text-amber-700 font-semibold" : "text-slate-600"}>{estimateResult.requires_lighterage ? "Yes (e.g. Sandheads for Haldia)" : "No (Direct Discharge)"}</strong></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
