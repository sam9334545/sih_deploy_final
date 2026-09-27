import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Activity, 
  TrendingUp, 
  Wind, 
  Clock, 
  Compass, 
  Ship, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import { fetchRisks, ApiError } from '../api';

const DISCHARGE_PORTS = [
  { id: 'INPRT', name: 'Paradip Port (INPRT)' },
  { id: 'INVTZ', name: 'Visakhapatnam (INVTZ)' },
  { id: 'INDHA', name: 'Dhamra Port (INDHA)' },
  { id: 'INGGV', name: 'Gangavaram (INGGV)' },
  { id: 'INHAL', name: 'Haldia Dock Complex (INHAL)' },
  { id: 'INGPR', name: 'Gopalpur Port (INGPR)' },
];

const VESSEL_CLASSES = ['Capesize', 'Panamax', 'Supramax', 'Handysize'];

const COMPONENT_ICONS = {
  market: TrendingUp,
  congestion: Clock,
  weather: Wind,
  vessel_availability: Ship,
  route: Compass,
  demand: Activity,
};

export default function RiskAlerts({ onNavigate }) {
  const [selectedPortId, setSelectedPortId] = useState('INPRT');
  const [selectedClass, setSelectedClass] = useState('Panamax');
  const [selectedMonth, setSelectedMonth] = useState(10); // October (cyclone season)
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const asOfDate = '2026-09-15';

  useEffect(() => {
    loadRisks();
  }, [selectedPortId, selectedClass, selectedMonth]);

  async function loadRisks() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRisks({
        portId: selectedPortId,
        vesselClass: selectedClass,
        month: Number(selectedMonth),
        asOf: asOfDate,
      });
      setRiskData(data);
    } catch (err) {
      console.error('[Risks Error]:', err);
      setError('Failed to fetch risk assessment from backend.');
    } finally {
      setLoading(false);
    }
  }

  const components = riskData?.components || [];
  const alerts = riskData?.alerts || [];
  const overall = riskData?.overall || 'MEDIUM';

  return (
    <div className="space-y-4">
      {/* 1. Decision Workflow Banner */}
      <DecisionWorkflowBanner currentStep="risk" onNavigate={onNavigate} />

      {/* 2. Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-govNavy" />
            <h1 className="text-base font-bold text-govNavy font-serif">
              Operational Risk Engine &amp; Maritime Alert Registry
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              Explainable Risk Model
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Component-level risk attributions derived from ±1σ sensitivity perturbation of the simulator. Zero hand-tuned arbitrary weights.
          </p>
        </div>
        <ProvenanceBadge type="DERIVED" text="Perturbation Sensitivity Weights" />
      </div>

      {/* 3. Parameter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2.5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-govNavy uppercase tracking-wide">
            Target Port &amp; Fleet Segment Scope
          </span>
          <button
            onClick={() => loadRisks()}
            className="text-[10px] text-govBlueAccent hover:underline flex items-center space-x-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-evaluate</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">Discharge Port</label>
            <select
              value={selectedPortId}
              onChange={(e) => setSelectedPortId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {DISCHARGE_PORTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">Vessel Segment</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {VESSEL_CLASSES.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">Operating Calendar Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              <option value="1">January (Northeast Monsoon - Calm)</option>
              <option value="4">April (Pre-Monsoon Thermal)</option>
              <option value="7">July (Southwest Monsoon Peak - High Swell)</option>
              <option value="10">October (Post-Monsoon Cyclone Transition)</option>
              <option value="11">November (Bay of Bengal Cyclone Peak)</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* 4. Overall Risk Assessment Gauge & Primary Driver */}
      {riskData && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Overall Risk Card (Col 4) */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Composite Risk Score
                  </span>
                  <h3 className="text-base font-bold text-govNavy font-serif">Overall Exposure</h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  overall === 'HIGH' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                  overall === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {overall} Risk
                </span>
              </div>

              <div className="my-4 flex items-center space-x-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-extrabold font-mono text-xl ${
                  overall === 'HIGH' ? 'bg-rose-50 text-rose-700 border-2 border-rose-400' :
                  overall === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-2 border-amber-400' :
                  'bg-emerald-50 text-emerald-700 border-2 border-emerald-400'
                }`}>
                  {riskData.overall_raw ? riskData.overall_raw.toFixed(2) : '1.00'}
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-800">{overall} Composite Level</div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Derived from 6 orthogonal risk vectors weighted by marginal cost sensitivities.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500">
              Evaluated As Of: {asOfDate}
            </div>
          </div>

          {/* Primary Driver & What Would Change Card (Col 8) */}
          <div className="md:col-span-8 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                Primary Decision Driver
              </span>
              <p className="text-xs text-slate-800 font-semibold mt-0.5 leading-relaxed">
                {riskData.main_driver || 'Market rate volatility contributes the largest share to total voyage cost risk.'}
              </p>
            </div>

            {/* What Would Change This Decision? */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-govNavy uppercase tracking-wide block">
                What Conditions Would Change This Risk Verdict?
              </span>
              {riskData.what_would_change && riskData.what_would_change.length > 0 ? (
                <div className="space-y-1">
                  {riskData.what_would_change.map((cond, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                      <span>{cond}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Standard operational conditions.</p>
              )}
            </div>

            <div className="text-[9px] text-slate-400 font-mono pt-1">
              Methodology: {riskData.weights_method || 'Partial derivatives of risk-adjusted cost with respect to each risk factor.'}
            </div>
          </div>
        </div>
      )}

      {/* 5. Six Risk Components Breakdown Table & Contribution Bars */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              Component Risk Decomposition &amp; Perturbation Contribution
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Orthogonal risk dimensions evaluated from market volatility, berth wait times, and climatological cyclone records.
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{components.length} Monitored Components</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {components.map((comp) => {
            const Icon = COMPONENT_ICONS[comp.name] || Activity;
            const isHigh = comp.level === 'HIGH';
            const isMed = comp.level === 'MEDIUM';

            return (
              <div
                key={comp.name}
                className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-2 hover:bg-slate-100/70 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-1.5">
                    <Icon className="w-4 h-4 text-govNavy" />
                    <span className="font-bold text-slate-800 text-xs capitalize">
                      {comp.name.replace(/_/g, ' ')} Risk
                    </span>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                    isHigh ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    isMed ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {comp.level}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                  {comp.detail}
                </p>

                {/* Contribution bar */}
                <div className="space-y-1 pt-1 border-t border-slate-200/60">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Contribution Share:</span>
                    <strong className="text-govNavy">{comp.contribution_pct ? `${comp.contribution_pct.toFixed(1)}%` : '—'}</strong>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, comp.contribution_pct || 15)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-0.5">
                    <span>Weight: {(comp.weight * 100).toFixed(0)}%</span>
                    <span>Signal z: {comp.signal_z ? comp.signal_z.toFixed(2) : '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Active Live Alert Feed */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              Active Maritime Decision Alerts ({alerts.length})
            </h3>
          </div>
          <ProvenanceBadge type="OBSERVED" text="System Alert Rules" />
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert, idx) => {
              const isHigh = alert.severity === 'high';
              const isMed = alert.severity === 'medium';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                    isHigh
                      ? 'bg-rose-50/70 border-rose-300'
                      : isMed
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-blue-50/70 border-blue-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isHigh ? 'bg-rose-600 text-white' : isMed ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 font-bold">{alert.code}</span>
                      <span className="text-[10px] text-slate-400">· Target: {selectedPortId} / {selectedClass}</span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">{alert.message}</p>
                  </div>

                  <span className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
                    As-Of: {asOfDate}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">
            No active high-severity alerts detected for this configuration.
          </div>
        )}
      </div>
    </div>
  );
}
