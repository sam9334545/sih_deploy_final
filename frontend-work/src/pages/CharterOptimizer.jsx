import React, { useState, useEffect } from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { optimizeCharter, ApiError } from '../api';

const LOAD_PORTS = [
  { id: 'AUHPT', name: 'Australia (Hay Point)', defaultCommodity: 'coking_coal' },
  { id: 'AUGLT', name: 'Australia (Gladstone)', defaultCommodity: 'coking_coal' },
  { id: 'IDTBA', name: 'Indonesia (Taboneo)', defaultCommodity: 'thermal_coal' },
  { id: 'ZARBY', name: 'South Africa (Richards Bay)', defaultCommodity: 'thermal_coal' },
  { id: 'USHAM', name: 'United States (Hampton Roads)', defaultCommodity: 'coking_coal' },
  { id: 'MZBEW', name: 'Mozambique (Beira)', defaultCommodity: 'coking_coal' },
];

const DISCHARGE_PORTS = [
  { id: 'INPRT', name: 'Paradip Port (INPRT)', state: 'Odisha', maxDraft: 16.0 },
  { id: 'INVTZ', name: 'Visakhapatnam (INVTZ)', state: 'Andhra Pradesh', maxDraft: 18.1 },
  { id: 'INDHA', name: 'Dhamra Port (INDHA)', state: 'Odisha', maxDraft: 18.5 },
  { id: 'INGGV', name: 'Gangavaram (INGGV)', state: 'Andhra Pradesh', maxDraft: 18.5 },
  { id: 'INHAL', name: 'Haldia Dock Complex (INHAL)', state: 'West Bengal', maxDraft: 8.5 },
  { id: 'INGPR', name: 'Gopalpur Port (INGPR)', state: 'Odisha', maxDraft: 13.5 },
];

export default function CharterOptimizer() {
  const [cargoVolume, setCargoVolume] = useState(150000);
  const [commodity, setCommodity] = useState('coking_coal');
  const [originPort, setOriginPort] = useState('AUHPT');
  const [destinationPort, setDestinationPort] = useState('INPRT');
  const [deadlineDays, setDeadlineDays] = useState(45);
  const [riskAversion, setRiskAversion] = useState(0.5); // lambda
  
  // UX states: 'initial' | 'loading' | 'success' | 'error' | 'infeasible'
  const [status, setStatus] = useState('initial');
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infeasibleData, setInfeasibleData] = useState(null);

  // Compute required_by ISO date from as_of (2026-09-15) + deadlineDays
  const asOfDate = '2026-09-15';
  const computeRequiredBy = (days) => {
    const d = new Date(asOfDate);
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    runOptimization();
  }, []);

  async function runOptimization() {
    setStatus('loading');
    setErrorMessage(null);
    setInfeasibleData(null);
    try {
      const requiredBy = computeRequiredBy(deadlineDays);
      const data = await optimizeCharter({
        cargoType: commodity,
        quantityT: Number(cargoVolume),
        originPort,
        destinationPort,
        requiredBy,
        asOf: asOfDate,
        riskAversion: Number(riskAversion),
        deadlinePenaltyUsd: 500000,
        nSimulations: 500,
      });

      setResult(data);
      setStatus('success');
    } catch (err) {
      console.error('[Optimizer Error]:', err);
      if (err instanceof ApiError && err.status === 422 && err.payload?.infeasible) {
        setStatus('infeasible');
        setInfeasibleData(err.payload);
        setErrorMessage(err.message || 'No strategy satisfies the specified delivery deadline.');
      } else {
        setStatus('error');
        setResult(null);
        setErrorMessage(
          err instanceof ApiError 
            ? err.message 
            : 'Unable to optimize charter. Please check selected ports and parameters.'
        );
      }
    }
  }

  const rec = result?.recommendation;
  const costBreakdown = result?.cost_breakdown_usd;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">Bulk Procurement &amp; Charter Strategy Optimizer</h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                Monte Carlo Simulation
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Simulates alternative charter structures (Spot, Consecutive, COA, Split Fleet) under stochastic freight, bunker, and berth congestion.
            </p>
          </div>
          <ProvenanceBadge type="model" text="Risk-Adjusted Decision Model" />
        </div>
      </div>

      {/* Input Form Panel */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <h2 className="text-xs font-bold text-govNavy mb-3 pb-1 border-b border-slate-100 uppercase tracking-wide">
          Procurement Cargo &amp; Laycan Constraints
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Cargo Volume */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Cargo Volume (MT)
            </label>
            <input
              type="number"
              step="5000"
              min="20000"
              max="1000000"
              value={cargoVolume}
              onChange={(e) => setCargoVolume(Number(e.target.value))}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none font-mono"
            />
          </div>

          {/* 2. Commodity Type */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Commodity Type
            </label>
            <select
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
            >
              <option value="coking_coal">Coking Coal</option>
              <option value="thermal_coal">Thermal Coal</option>
              <option value="iron_ore">Iron Ore</option>
            </select>
          </div>

          {/* 3. Load Port */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Load Port (Origin)
            </label>
            <select
              value={originPort}
              onChange={(e) => setOriginPort(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
            >
              {LOAD_PORTS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 4. Discharge Port */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Discharge Port (India)
            </label>
            <select
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
            >
              {DISCHARGE_PORTS.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Draft: {p.maxDraft}m)</option>
              ))}
            </select>
          </div>

          {/* 5. Laycan Window */}
          <div>
            <label className="text-[11px] font-semibold text-slate-700 block mb-1">
              Delivery Deadline
            </label>
            <select
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Number(e.target.value))}
              className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded focus:border-govBlueAccent focus:outline-none cursor-pointer"
            >
              <option value={30}>30 Days (Prompt)</option>
              <option value={45}>45 Days (Standard)</option>
              <option value={60}>60 Days (Extended)</option>
              <option value={90}>90 Days (Quarterly)</option>
            </select>
            <span className="text-[9px] text-slate-400 mt-1 block">
              Req by: {computeRequiredBy(deadlineDays)}
            </span>
          </div>

          {/* 6. Action Button */}
          <div className="flex items-end">
            <button
              onClick={runOptimization}
              disabled={status === 'loading'}
              className={`w-full py-2 px-3 rounded text-xs font-bold transition shadow-xs flex items-center justify-center space-x-1.5 ${
                status === 'loading'
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-govNavy hover:bg-govNavyLight text-white cursor-pointer'
              }`}
            >
              {status === 'loading' ? (
                <span>Simulating...</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                  <span>Run Optimizer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {status === 'loading' && (
        <div className="bg-white border border-lightBorder rounded p-12 text-center space-y-2 shadow-xs">
          <div className="w-8 h-8 border-3 border-govNavy/20 border-t-govNavy rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-govNavy font-semibold">
            Running 500 Monte Carlo iterations across port turnarounds, bunker volatility, and contract structures...
          </p>
        </div>
      )}

      {/* Infeasible Alert State */}
      {status === 'infeasible' && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded p-4 text-xs text-amber-900 shadow-xs">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <strong className="text-sm font-bold block text-amber-950">
                Optimization Infeasible: Deadline or Physical Port Limit Exceeded
              </strong>
              <p className="mt-1 text-amber-800">{errorMessage}</p>
              <p className="text-[10px] text-amber-700 mt-1">
                Suggested action: Relax the delivery deadline to 60+ days, split the cargo into smaller parcels, or choose an alternate deep-draft discharge terminal.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* General Error State */}
      {status === 'error' && (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 text-xs text-rose-800">
          <strong className="font-bold">Optimizer Error: </strong>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Optimization Success Results */}
      {status === 'success' && result && rec && (
        <>
          {/* Top Recommendation Dossier Card */}
          <div className="bg-gradient-to-r from-govNavy to-[#0a3d6f] text-white rounded p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/15 pb-2.5">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                  Recommended Optimal Procurement Strategy
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {rec.vessel_class} • {rec.contract_structure.toUpperCase()} ({rec.execution} voyages)
                </h2>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-slate-300 block">Expected Cost</span>
                <span className="text-2xl font-black text-white">
                  ${rec.expected_usd_per_tonne.toFixed(2)} <span className="text-xs font-normal text-slate-300">/ tonne</span>
                </span>
              </div>
            </div>

            {/* Recommendation details grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
              <div className="bg-white/10 rounded p-2.5">
                <span className="text-slate-300 block text-[10px]">Total Lift Expense (USD)</span>
                <strong className="text-sm font-bold font-mono text-white">
                  ${Math.round(rec.expected_cost_usd).toLocaleString()}
                </strong>
              </div>
              <div className="bg-white/10 rounded p-2.5">
                <span className="text-slate-300 block text-[10px]">Landed Cost in INR (@ {rec.fx_rate})</span>
                <strong className="text-sm font-bold font-mono text-amber-300">
                  ₹{(rec.expected_cost_inr / 10000000).toFixed(2)} Cr
                </strong>
              </div>
              <div className="bg-white/10 rounded p-2.5">
                <span className="text-slate-300 block text-[10px]">Voyages Required</span>
                <strong className="text-sm font-bold font-mono text-white">
                  {rec.voyages} {rec.vessel_class} Lift{rec.voyages > 1 ? 's' : ''}
                </strong>
              </div>
              <div className="bg-white/10 rounded p-2.5">
                <span className="text-slate-300 block text-[10px]">Risk Profile (Deadline Miss)</span>
                <strong className="text-sm font-bold font-mono text-emerald-300">
                  {(rec.p_deadline_miss * 100).toFixed(1)}% probability
                </strong>
              </div>
            </div>

            {/* Explanation rationale bullets */}
            {result.explanation && result.explanation.length > 0 && (
              <div className="pt-2 border-t border-white/15">
                <span className="text-[10px] text-amber-300 font-bold block mb-1 uppercase tracking-wide">
                  Algorithmic Rationale &amp; Optimization Narrative:
                </span>
                <ul className="list-disc list-inside text-xs text-slate-200 space-y-0.5">
                  {result.explanation.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Cost Breakdown & Alternatives Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cost Component Breakdown */}
            {costBreakdown && (
              <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide border-b border-slate-100 pb-2">
                  Estimated Voyage Cost Distribution (USD)
                </h3>
                <div className="space-y-2 text-xs">
                  {Object.entries(costBreakdown).map(([component, amount]) => {
                    const pct = Math.round((amount / rec.expected_cost_usd) * 100);
                    return (
                      <div key={component} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold text-slate-700 capitalize">{component.replace('_', ' ')}</span>
                          <span className="font-mono text-slate-900 font-bold">${Math.round(amount).toLocaleString()} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded h-1.5 overflow-hidden">
                          <div className="bg-govNavy h-1.5 rounded" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Infeasible / Binding Constraints Card */}
            {result.infeasible && result.infeasible.length > 0 && (
              <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide border-b border-slate-100 pb-2">
                  Evaluated Infeasible Alternatives ({result.infeasible.length})
                </h3>
                <div className="space-y-2 text-[11px] max-h-56 overflow-y-auto">
                  {result.infeasible.map((inf, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{inf.label || inf.strategy || inf.vessel_class}</span>
                        <span className="text-rose-700 font-mono text-[10px]">Infeasible</span>
                      </div>
                      <p className="text-slate-600 text-[10px] mt-0.5">
                        {inf.reason || inf.notes?.join('; ') || 'Binding physical port or laycan constraint exceeded.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
