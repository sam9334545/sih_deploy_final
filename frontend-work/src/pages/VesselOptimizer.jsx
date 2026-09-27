import React, { useState, useEffect } from 'react';
import { 
  Ship, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowRight, 
  Sliders, 
  Info, 
  Scale, 
  Navigation, 
  Clock, 
  DollarSign,
  Fuel,
  Maximize2
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import { fetchVesselClasses, recommendVessel, ApiError } from '../api';

const LOAD_PORTS = [
  { id: 'AUHPT', name: 'Hay Point (Australia)', cargo: 'coking_coal' },
  { id: 'AUGLT', name: 'Gladstone (Australia)', cargo: 'coking_coal' },
  { id: 'IDTBA', name: 'Taboneo (Indonesia)', cargo: 'thermal_coal' },
  { id: 'ZARBY', name: 'Richards Bay (South Africa)', cargo: 'thermal_coal' },
  { id: 'USHAM', name: 'Hampton Roads (USA)', cargo: 'coking_coal' },
  { id: 'MZBEW', name: 'Beira (Mozambique)', cargo: 'coking_coal' },
];

const DISCHARGE_PORTS = [
  { id: 'INPRT', name: 'Paradip Port (INPRT)', draft: 16.0 },
  { id: 'INVTZ', name: 'Visakhapatnam (INVTZ)', draft: 18.1 },
  { id: 'INDHA', name: 'Dhamra Port (INDHA)', draft: 18.5 },
  { id: 'INGGV', name: 'Gangavaram (INGGV)', draft: 18.5 },
  { id: 'INHAL', name: 'Haldia Dock Complex (INHAL)', draft: 8.5 },
  { id: 'INGPR', name: 'Gopalpur Port (INGPR)', draft: 13.5 },
];

const VESSEL_CLASSES = ['Capesize', 'Panamax', 'Supramax', 'Handysize'];

export default function VesselOptimizer({ onNavigate }) {
  // Input parameters
  const [cargoType, setCargoType] = useState('coking_coal');
  const [quantityT, setQuantityT] = useState(120000);
  const [originPort, setOriginPort] = useState('AUHPT');
  const [destinationPort, setDestinationPort] = useState('INPRT');
  const [deadlineDays, setDeadlineDays] = useState(60);

  // Data state
  const [vesselProfiles, setVesselProfiles] = useState([]);
  const [recommendationData, setRecommendationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedInspectClass, setSelectedInspectClass] = useState('Panamax');

  const asOfDate = '2026-09-15';

  const computeRequiredBy = (days) => {
    const d = new Date(asOfDate);
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().split('T')[0];
  };

  useEffect(() => {
    loadVesselData();
  }, [cargoType, quantityT, originPort, destinationPort, deadlineDays]);

  async function loadVesselData() {
    setLoading(true);
    setError(null);
    try {
      const requiredBy = computeRequiredBy(deadlineDays);
      const [profiles, recRes] = await Promise.all([
        fetchVesselClasses().catch(err => {
          console.warn('Vessel profiles fetch warning:', err);
          return [];
        }),
        recommendVessel({
          cargoType,
          quantityT: Number(quantityT),
          originPort,
          destinationPort,
          requiredBy,
          asOf: asOfDate,
        }).catch(err => {
          console.warn('Recommend vessel fetch notice:', err);
          if (err instanceof ApiError && err.status === 422 && err.payload) {
            return { rejected: err.payload.rejected || [], recommended: null, alternatives: [] };
          }
          return null;
        })
      ]);

      if (profiles && profiles.length > 0) {
        setVesselProfiles(profiles);
      }
      setRecommendationData(recRes);
    } catch (err) {
      console.error('Failed to load vessel optimization:', err);
      setError('Unable to evaluate vessel feasibility. Please check selected parameters.');
    } finally {
      setLoading(false);
    }
  }

  // Combine static profiles and dynamic recommendation data per class
  const classMap = {};
  VESSEL_CLASSES.forEach(cls => {
    const profile = vesselProfiles.find(p => p.vessel_class.toLowerCase() === cls.toLowerCase()) || {};
    
    // Check if class is recommended or alternative
    let optionData = null;
    let isFeasible = true;
    let rejectionDetail = null;

    if (recommendationData) {
      if (recommendationData.recommended?.vessel_class.toLowerCase() === cls.toLowerCase()) {
        optionData = recommendationData.recommended;
      } else if (recommendationData.alternatives) {
        optionData = recommendationData.alternatives.find(
          a => a.vessel_class.toLowerCase() === cls.toLowerCase()
        );
      }

      // Check if rejected
      if (recommendationData.rejected) {
        const rej = recommendationData.rejected.find(
          r => r.vessel_class.toLowerCase() === cls.toLowerCase()
        );
        if (rej) {
          isFeasible = false;
          rejectionDetail = rej.detail || rej.reason;
        }
      }
    }

    classMap[cls] = {
      profile,
      option: optionData,
      isFeasible: optionData ? optionData.deadline_feasible !== false && isFeasible : isFeasible,
      rejectionDetail,
      isRecommended: recommendationData?.recommended?.vessel_class.toLowerCase() === cls.toLowerCase(),
    };
  });

  const inspectProfile = vesselProfiles.find(
    p => p.vessel_class.toLowerCase() === selectedInspectClass.toLowerCase()
  ) || vesselProfiles[0];

  return (
    <div className="space-y-4">
      {/* 1. Core Workflow Pipeline */}
      <DecisionWorkflowBanner currentStep="vessels" onNavigate={onNavigate} />

      {/* 2. Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Ship className="w-4 h-4 text-govNavy" />
            <h1 className="text-base font-bold text-govNavy font-serif">
              Standard Bulk Carrier Fleet Optimizer &amp; Feasibility Matrix
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              Authoritative Backend Engine
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Physical draft, beam, and LOA constraint evaluation across Capesize, Panamax, Supramax, and Handysize standard classes.
          </p>
        </div>
        <ProvenanceBadge type="OBSERVED" text="Baltic Standard Vessel Profiles" />
      </div>

      {/* 3. Parameter Inputs Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2.5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <Sliders className="w-3.5 h-3.5 text-govBlueAccent" />
            <span className="text-xs font-bold text-govNavy uppercase tracking-wide">
              Voyage Requirement Parameters
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {loading ? 'Evaluating constraints...' : 'Status: Ready'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">Cargo Commodity</label>
            <select
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              <option value="coking_coal">Coking Coal (AUHPT)</option>
              <option value="thermal_coal">Thermal Coal (IDTBA)</option>
              <option value="iron_ore">Iron Ore (Lump / Fines)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">Procurement Tonnage</label>
            <input
              type="number"
              value={quantityT}
              step="5000"
              onChange={(e) => setQuantityT(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono text-slate-800 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">Loading Port</label>
            <select
              value={originPort}
              onChange={(e) => setOriginPort(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {LOAD_PORTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">Discharge Port</label>
            <select
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {DISCHARGE_PORTS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.draft}m)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              Laycan Deadline: <strong className="font-mono text-govNavy">{deadlineDays} days</strong>
            </label>
            <input
              type="range"
              min="20"
              max="150"
              step="5"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Number(e.target.value))}
              className="w-full accent-govNavy cursor-pointer mt-1"
            />
            <span className="text-[9px] font-mono text-slate-400 block text-right mt-0.5">
              By: {computeRequiredBy(deadlineDays)}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* 4. Core Four-Class Side-by-Side Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              Authoritative Vessel Class Feasibility &amp; Economics Comparison
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Comparison across standard Baltic bulker classes for the active voyage corridor ({originPort} → {destinationPort}).
            </p>
          </div>
          <div className="flex items-center space-x-2 text-[10px]">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Feasible</span>
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-600" />
              <span>Infeasible</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left gov-table border-collapse">
            <thead>
              <tr>
                <th className="w-44">Parameter / Metric</th>
                {VESSEL_CLASSES.map((cls) => {
                  const item = classMap[cls];
                  return (
                    <th key={cls} className={`text-center ${item.isRecommended ? 'bg-govNavyLight ring-2 ring-amber-400' : ''}`}>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold">{cls}</span>
                        {item.isRecommended && (
                          <span className="bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.2 rounded text-[8px] uppercase tracking-wider mt-0.5">
                            Recommended
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {/* Feasibility Status */}
              <tr className="bg-slate-50/70 font-sans">
                <td className="font-bold text-slate-800">Feasibility Status</td>
                {VESSEL_CLASSES.map((cls) => {
                  const item = classMap[cls];
                  const opt = item.option;
                  const reqLight = opt?.requires_lighterage;
                  return (
                    <td key={cls} className="text-center p-2.5">
                      {item.isFeasible ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Feasible
                          </span>
                          {reqLight && (
                            <span className="text-[9px] text-amber-700 font-semibold mt-0.5">
                              (Sandheads Lighterage)
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex flex-col items-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-3 h-3 mr-1" />
                            Infeasible
                          </span>
                          <span className="text-[9px] text-rose-700 mt-0.5 max-w-[130px] truncate" title={item.rejectionDetail || 'Constraint limit'}>
                            {item.rejectionDetail || 'Draft restriction'}
                          </span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Reference Deadweight */}
              <tr>
                <td className="font-semibold text-slate-800 font-sans">Reference DWT</td>
                {VESSEL_CLASSES.map(cls => (
                  <td key={cls} className="text-center">
                    {classMap[cls].profile.ref_dwt ? `${classMap[cls].profile.ref_dwt.toLocaleString()} t` : '—'}
                  </td>
                ))}
              </tr>

              {/* Scantling Draft */}
              <tr>
                <td className="font-semibold text-slate-800 font-sans">Design Draft</td>
                {VESSEL_CLASSES.map(cls => (
                  <td key={cls} className="text-center">
                    {classMap[cls].profile.ref_draft_m ? `${classMap[cls].profile.ref_draft_m} m` : '—'}
                  </td>
                ))}
              </tr>

              {/* Dimensions (LOA × Beam) */}
              <tr>
                <td className="font-semibold text-slate-800 font-sans">Dimensions (LOA × Beam)</td>
                {VESSEL_CLASSES.map(cls => (
                  <td key={cls} className="text-center text-[11px]">
                    {classMap[cls].profile.ref_loa_m ? `${classMap[cls].profile.ref_loa_m}m × ${classMap[cls].profile.ref_beam_m}m` : '—'}
                  </td>
                ))}
              </tr>

              {/* Laden Speed & Fuel Consumption */}
              <tr>
                <td className="font-semibold text-slate-800 font-sans">Laden Speed &amp; Bunker Burn</td>
                {VESSEL_CLASSES.map(cls => (
                  <td key={cls} className="text-center text-[11px]">
                    {classMap[cls].profile.speed_laden_kn ? `${classMap[cls].profile.speed_laden_kn} kn · ${classMap[cls].profile.cons_laden_mt_day} t/d` : '—'}
                  </td>
                ))}
              </tr>

              {/* Cargo Capacity / Intake */}
              <tr className="bg-slate-50/50">
                <td className="font-semibold text-slate-800 font-sans">Effective Cargo Intake</td>
                {VESSEL_CLASSES.map((cls) => {
                  const opt = classMap[cls].option;
                  return (
                    <td key={cls} className="text-center font-bold text-govNavy">
                      {opt?.parcel_t ? `${Math.round(opt.parcel_t).toLocaleString()} t` : classMap[cls].profile.ref_dwt ? `~${Math.round(classMap[cls].profile.ref_dwt * 0.95).toLocaleString()} t` : '—'}
                    </td>
                  );
                })}
              </tr>

              {/* Voyages Required */}
              <tr>
                <td className="font-semibold text-slate-800 font-sans">Voyages Required</td>
                {VESSEL_CLASSES.map((cls) => {
                  const opt = classMap[cls].option;
                  return (
                    <td key={cls} className="text-center font-bold">
                      {opt?.voyages ? `${opt.voyages} voyage${opt.voyages > 1 ? 's' : ''}` : '—'}
                    </td>
                  );
                })}
              </tr>

              {/* Estimated Voyage Duration */}
              <tr>
                <td className="font-semibold text-slate-800 font-sans">Round-Trip Duration</td>
                {VESSEL_CLASSES.map((cls) => {
                  const opt = classMap[cls].option;
                  return (
                    <td key={cls} className="text-center">
                      {opt?.estimated_days_per_voyage ? `${opt.estimated_days_per_voyage} days` : '—'}
                    </td>
                  );
                })}
              </tr>

              {/* Expected Landed Cost */}
              <tr className="bg-blue-50/40">
                <td className="font-bold text-govNavy font-sans">Expected Cost (USD)</td>
                {VESSEL_CLASSES.map((cls) => {
                  const opt = classMap[cls].option;
                  return (
                    <td key={cls} className="text-center font-extrabold text-govNavy text-sm">
                      {opt?.expected_cost_usd ? `$${Math.round(opt.expected_cost_usd).toLocaleString()}` : '—'}
                    </td>
                  );
                })}
              </tr>

              {/* Rejection / Infeasibility Reason */}
              <tr className="font-sans text-[11px]">
                <td className="font-semibold text-slate-800">Binding Constraint / Note</td>
                {VESSEL_CLASSES.map((cls) => {
                  const item = classMap[cls];
                  const opt = item.option;
                  return (
                    <td key={cls} className="text-center p-2 text-[10px] text-slate-600">
                      {item.rejectionDetail ? (
                        <span className="text-rose-700 font-medium block">{item.rejectionDetail}</span>
                      ) : opt?.note ? (
                        <span className="text-amber-800 font-medium block">{opt.note}</span>
                      ) : opt?.binding_constraint ? (
                        <span>Binding: {opt.binding_constraint} ({opt.binding_port})</span>
                      ) : (
                        <span>Standard permissible</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. In-Depth Vessel Technical Specification Inspector */}
      {inspectProfile && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <Scale className="w-4 h-4 text-govBlueAccent" />
              <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                Detailed Technical Profile: {inspectProfile.vessel_class} Standard Bulker
              </h3>
            </div>
            <div className="flex items-center space-x-1.5">
              {VESSEL_CLASSES.map((cls) => (
                <button
                  key={cls}
                  onClick={() => setSelectedInspectClass(cls)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer border ${
                    selectedInspectClass === cls
                      ? 'bg-govNavy text-white border-govNavy'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Benchmark Index</span>
              <strong className="text-govNavy font-mono">{inspectProfile.index_code}</strong>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="text-[10px] text-slate-500 block">TPC Immersion</span>
              <strong className="text-slate-800 font-mono">{inspectProfile.tpc} t/cm</strong>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Standard Demurrage</span>
              <strong className="text-slate-800 font-mono">${inspectProfile.demurrage_usd_day ? inspectProfile.demurrage_usd_day.toLocaleString() : '14,000'}/d</strong>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Vessel Constants</span>
              <strong className="text-slate-800 font-mono">{inspectProfile.constants_t ? `${inspectProfile.constants_t} t` : '2,400 t'}</strong>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Cargo Gear</span>
              <strong className="text-slate-800">{inspectProfile.geared ? 'Geared (Cranes/Grabs)' : 'Gearless (Capesize/Panamax)'}</strong>
            </div>

            <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
              <span className="text-[10px] text-slate-500 block">Gross Tonnage (GRT)</span>
              <strong className="text-slate-800 font-mono">{inspectProfile.grt ? inspectProfile.grt.toLocaleString() : '—'}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 6. Action Transfer Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <span className="text-slate-600">
          Ready to simulate multi-voyage contracts and stochastic cost distributions for these vessels?
        </span>
        <button
          onClick={() => onNavigate('simulator')}
          className="px-4 py-2 bg-govNavy text-white rounded font-semibold hover:bg-govNavyLight transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
        >
          <span>Open Strategy Simulator</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
