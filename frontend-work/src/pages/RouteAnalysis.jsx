import React, { useState, useEffect } from 'react';
import { 
  Compass, Ship, Anchor, Fuel, DollarSign, Clock, 
  AlertTriangle, CheckCircle, ArrowRight, ShieldCheck, MapPin 
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';

export default function RouteAnalysis({ initialVessel = 'Panamax', onProceedToOptimizer }) {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [vessel, setVessel] = useState(initialVessel);
  const [cargoQty, setCargoQty] = useState(75000);
  const [originDate, setOriginDate] = useState('2019-06-28');
  const [horizon, setHorizon] = useState(28);

  const [estimateResult, setEstimateResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load supported routes from backend
  useEffect(() => {
    fetch('/api/v1/historical/routes')
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0) {
          setRoutes(data.routes);
          setSelectedRouteId(data.routes[0].route_id);
        }
      })
      .catch(err => console.error('Error loading routes:', err));
  }, []);

  // Sync vessel if route changes
  const handleRouteChange = (rId) => {
    setSelectedRouteId(rId);
    const r = routes.find(x => x.route_id === rId);
    if (r) {
      setVessel(r.vessel_class);
      setCargoQty(r.default_cargo_mt);
    }
  };

  const handleCalculateEconomics = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedRoute = routes.find(r => r.route_id === selectedRouteId);
      const res = await fetch('/api/v1/historical/route-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: selectedRouteId,
          origin_port: selectedRoute?.origin || 'Newcastle',
          destination_port: selectedRoute?.destination || 'Haldia',
          vessel_class: vessel,
          cargo_type: selectedRoute?.cargo_type || 'Thermal Coal',
          cargo_quantity_mt: Number(cargoQty),
          origin_date: originDate,
          horizon_sessions: Number(horizon),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || `HTTP ${res.status}: Route estimation failed`);
      }

      const data = await res.json();
      setEstimateResult(data);
    } catch (err) {
      console.error('Route calculation error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRouteId) {
      handleCalculateEconomics();
    }
  }, [selectedRouteId, vessel, cargoQty, originDate, horizon]);

  const activeRoute = routes.find(r => r.route_id === selectedRouteId);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="glass-card p-6 border-white/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase">
                Phase 6A Route-Aware Layer
              </span>
              <ProvenanceBadge type="DERIVED" text="VOYAGE PHYSICS" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Route Analysis & Voyage Economics
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Translating broad Baltic Index market forecasts into voyage-specific freight costs ($/tonne)
              for coal and iron ore trade corridors into East Coast of India discharge ports.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-white/5">
            <Fuel className="w-5 h-5 text-amber-400" />
            <div>
              <div className="text-white font-bold flex items-center gap-1.5">
                Bunker Pricing Feed
                <ProvenanceBadge type="DEMO_ONLY" />
              </div>
              <div className="text-[11px] text-slate-400">Rotterdam/Singapore VLSFO integration test</div>
            </div>
          </div>
        </div>
      </div>

      {/* Corridor & Parameter Selection */}
      <div className="glass-card p-6 border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Route Corridor Dropdown */}
        <div className="lg:col-span-2">
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
            Verified Shipping Corridor
          </label>
          <select
            value={selectedRouteId}
            onChange={(e) => handleRouteChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors"
          >
            {routes.map((r) => (
              <option key={r.route_id} value={r.route_id}>
                {r.name} ({r.distance_nm.toLocaleString()} NM) • {r.cargo_type}
              </option>
            ))}
          </select>
        </div>

        {/* Vessel Class */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
            Vessel Class
          </label>
          <input
            type="text"
            readOnly
            value={vessel}
            className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-cyan-300 font-mono font-bold"
          />
        </div>

        {/* Cargo Quantity */}
        <div>
          <label className="block text-xs font-mono font-semibold text-slate-300 uppercase mb-2">
            Cargo Quantity (MT)
          </label>
          <input
            type="number"
            step="1000"
            value={cargoQty}
            onChange={(e) => setCargoQty(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none transition-colors font-mono"
          />
        </div>
      </div>

      {/* Main Results */}
      {loading ? (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-sm font-mono text-cyan-300">
            Evaluating voyage physics, port constraints, and fuel consumption...
          </p>
        </div>
      ) : error ? (
        <div className="glass-card p-6 border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <div>
            <div className="font-bold">Calculation Error</div>
            <div className="text-xs text-rose-300/80">{error}</div>
          </div>
        </div>
      ) : estimateResult ? (
        <div className="space-y-6">
          {/* Corridor & Port Compatibility Banner */}
          <div className="glass-card p-6 border-white/10 bg-gradient-to-r from-slate-900/80 to-slate-900/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <Anchor className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-white">
                      {estimateResult.origin_port} → {estimateResult.destination_port}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                      {estimateResult.distance_nm.toLocaleString()} Nautical Miles
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Cargo: <strong className="text-slate-200">{estimateResult.cargo_type}</strong> ({Number(cargoQty).toLocaleString()} MT)
                  </div>
                </div>
              </div>

              {/* Port Compatibility Status */}
              <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-white/10">
                <div>
                  <div className="text-[10px] text-slate-400 font-mono uppercase">
                    Port Compatibility Check
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-sm font-bold font-mono ${
                      estimateResult.port_compatibility?.status === 'COMPATIBLE' 
                        ? 'text-emerald-400' 
                        : 'text-amber-400'
                    }`}>
                      {estimateResult.port_compatibility?.status || 'COMPATIBLE'}
                    </span>
                    <ProvenanceBadge type="OBSERVED" text="PHYSICAL LIMITS" />
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Draft & Berth verification for {estimateResult.destination_port}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Freight Cost Scenarios ($/tonne) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* P10 Freight */}
            <div className="glass-card p-5 border-blue-500/30 bg-blue-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-blue-300 uppercase font-semibold">
                  P10 Freight Scenario
                </span>
                <ProvenanceBadge type="DERIVED" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                ${estimateResult.freight_estimates.p10_usd_per_tonne.toFixed(2)}
                <span className="text-xs font-normal text-slate-400 ml-1">/ MT</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Total: ${Math.round(estimateResult.freight_estimates.p10_usd_per_tonne * cargoQty).toLocaleString()}
              </div>
            </div>

            {/* P50 Freight (Median) */}
            <div className="glass-card p-5 border-cyan-500/40 bg-cyan-500/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-cyan-300 uppercase font-bold">
                  P50 Expected Freight
                </span>
                <ProvenanceBadge type="DERIVED" />
              </div>
              <div className="text-3xl font-black font-mono text-cyan-300">
                ${estimateResult.freight_estimates.p50_usd_per_tonne.toFixed(2)}
                <span className="text-xs font-normal text-slate-400 ml-1">/ MT</span>
              </div>
              <div className="text-[11px] text-cyan-200/80 font-mono mt-1">
                Total: ${Math.round(estimateResult.freight_estimates.p50_usd_per_tonne * cargoQty).toLocaleString()}
              </div>
            </div>

            {/* P90 Freight */}
            <div className="glass-card p-5 border-indigo-500/30 bg-indigo-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-indigo-300 uppercase font-semibold">
                  P90 Conservative Scenario
                </span>
                <ProvenanceBadge type="DERIVED" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                ${estimateResult.freight_estimates.p90_usd_per_tonne.toFixed(2)}
                <span className="text-xs font-normal text-slate-400 ml-1">/ MT</span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono mt-1">
                Total: ${Math.round(estimateResult.freight_estimates.p90_usd_per_tonne * cargoQty).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Voyage Economics Breakdown Table */}
          <div className="glass-card p-6 border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Physical Voyage Economics Breakdown
              </h3>
              <ProvenanceBadge type="DERIVED" text="PHASE 6A ENGINE" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <div className="text-xs text-slate-400 font-mono">Sea Steaming Time</div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {estimateResult.voyage_economics.sea_days.toFixed(1)} days
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  At 12.5 knots cruising speed
                </div>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <div className="text-xs text-slate-400 font-mono">Port & Waiting Days</div>
                <div className="text-xl font-bold font-mono text-white mt-1">
                  {estimateResult.voyage_economics.port_days.toFixed(1)} days
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Load, discharge & clearance
                </div>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <div className="text-xs text-slate-400 font-mono">Total Bunker Consumed</div>
                <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                  {Math.round(estimateResult.voyage_economics.fuel_consumed_mt).toLocaleString()} MT
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  VLSFO sea & port consumption
                </div>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5">
                <div className="text-xs text-slate-400 font-mono">Total Bunker Cost</div>
                <div className="text-xl font-bold font-mono text-amber-300 mt-1">
                  ${Math.round(estimateResult.voyage_economics.fuel_cost_usd).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  @ ${estimateResult.voyage_economics.bunker_price_per_mt}/MT
                </div>
              </div>
            </div>

            {/* Critical Methodological Distinction Note */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20 text-xs text-slate-300 space-y-1">
              <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Critical Methodological Distinction (Section 24)
              </div>
              <p className="text-slate-400">
                The Baltic Index forecast is <strong className="text-white">DIRECTLY PREDICTED</strong> by the 72 Quantile LightGBM models.
                The corridor freight rates ($/tonne) are <strong className="text-white">MATHEMATICALLY DERIVED</strong> via Phase 6A Voyage Economics 
                (hire cost + fuel consumption + port tariffs). No arbitrary country multipliers (e.g. "India +20%") are used.
              </p>
            </div>
          </div>

          {/* Action button to send to Charter Optimizer */}
          <div className="flex justify-end">
            <button
              onClick={() => onProceedToOptimizer && onProceedToOptimizer(estimateResult)}
              className="btn-primary"
            >
              <span>Optimize Charter Strategy for this Route</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
