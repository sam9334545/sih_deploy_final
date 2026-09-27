import React, { useState, useEffect } from 'react';
import { 
  Anchor, 
  MapPin, 
  Clock, 
  Wind, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ExternalLink,
  Layers,
  Ship,
  Info
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import PortMap from '../components/PortMap';
import { fetchPortsList, fetchPortDetail, ApiError } from '../api';

const VESSEL_CLASSES = ['Capesize', 'Panamax', 'Supramax', 'Handysize'];

const OVERSEAS_HUBS = [
  { id: 'AUHPT', name: 'Hay Point (Australia)', cargo: 'coking_coal' },
  { id: 'AUGLT', name: 'Gladstone (Australia)', cargo: 'coking_coal' },
  { id: 'IDTBA', name: 'Taboneo (Indonesia)', cargo: 'thermal_coal' },
  { id: 'ZARBY', name: 'Richards Bay (South Africa)', cargo: 'thermal_coal' },
  { id: 'USHAM', name: 'Hampton Roads (USA)', cargo: 'coking_coal' },
  { id: 'MZBEW', name: 'Beira (Mozambique)', cargo: 'coking_coal' },
];

export default function PortIntelligence({ onNavigate }) {
  const [ports, setPorts] = useState([]);
  const [selectedPortId, setSelectedPortId] = useState('INPRT');
  const [originPortId, setOriginPortId] = useState('AUHPT');
  const [selectedCargoType, setSelectedCargoType] = useState('coking_coal');
  const [selectedCompatClass, setSelectedCompatClass] = useState('Panamax');
  const [portDetail, setPortDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch Indian registered ports
  useEffect(() => {
    async function loadPorts() {
      setLoadingList(true);
      setError(null);
      try {
        const list = await fetchPortsList({ country: 'IN' });
        if (list && list.length > 0) {
          setPorts(list);
          setSelectedPortId(list[0].port_id);
        }
      } catch (err) {
        console.error('Failed to load ports list:', err);
        setError('Failed to retrieve registered ports from backend.');
      } finally {
        setLoadingList(false);
      }
    }
    loadPorts();
  }, []);

  // 2. Fetch selected port dossier
  useEffect(() => {
    if (!selectedPortId) return;

    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const detail = await fetchPortDetail(selectedPortId, { cargoType: selectedCargoType });
        setPortDetail(detail);
      } catch (err) {
        console.error(`Failed to load details for port ${selectedPortId}:`, err);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [selectedPortId, selectedCargoType]);

  // Compatibility result for user-selected vessel class
  const classCompat = portDetail?.vessel_compatibility?.find(
    c => c.vessel_class.toLowerCase() === selectedCompatClass.toLowerCase()
  );

  return (
    <div className="space-y-4">
      {/* 1. Decision Workflow Banner */}
      <DecisionWorkflowBanner currentStep="constraints" onNavigate={onNavigate} />

      {/* 2. Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Anchor className="w-4 h-4 text-govNavy" />
            <h1 className="text-base font-bold text-govNavy font-serif">
              East Coast India Port Constraints &amp; Berth Intelligence Dossier
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              Navigational Authority Records
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Verified permissible drafts, LOA, beam restrictions, cargo handling rates, seasonal weather stoppages, and Sandheads lighterage rules.
          </p>
        </div>
        <ProvenanceBadge type="OBSERVED" text="Official Port Gazette" />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* 3. Interactive Port Map & Spatial Radar */}
      <PortMap
        ports={ports}
        selectedPortId={selectedPortId}
        onSelectPort={setSelectedPortId}
        originPortId={originPortId}
        onSelectOrigin={setOriginPortId}
      />

      {/* 4. Overseas Origin Loading Hubs Selector Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-govNavy uppercase tracking-wide text-[10px]">
            Active Overseas Loading Port / Procurement Origin:
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {OVERSEAS_HUBS.length} International Corridors
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {OVERSEAS_HUBS.map((hub) => {
            const isSelected = originPortId === hub.id;
            return (
              <button
                key={hub.id}
                onClick={() => setOriginPortId(hub.id)}
                className={`p-2 rounded text-left border transition cursor-pointer ${
                  isSelected
                    ? 'bg-sky-900 text-white border-sky-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-mono font-bold opacity-90">{hub.id}</span>
                  <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                    isSelected ? 'bg-sky-700 text-sky-100' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {hub.cargo === 'coking_coal' ? 'Coking' : 'Thermal'}
                  </span>
                </div>
                <div className="text-[11px] font-semibold mt-1 truncate">
                  {hub.name.split(' (')[0]}
                </div>
                <div className="text-[9px] opacity-75 truncate">
                  {hub.name.includes('(') ? hub.name.split('(')[1].replace(')', '') : ''}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Port Selector Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-govNavy uppercase tracking-wide text-[10px]">
            Select East Coast Discharge Terminal:
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {ports.length} Registered Terminals
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {ports.map((port) => {
            const isSelected = selectedPortId === port.port_id;
            return (
              <button
                key={port.port_id}
                onClick={() => setSelectedPortId(port.port_id)}
                className={`p-2.5 rounded text-left border transition cursor-pointer ${
                  isSelected
                    ? 'bg-govNavy text-white border-govNavy shadow-xs'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center text-[10px]">
                  <span className="font-mono font-bold opacity-80">{port.port_id}</span>
                  <span className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                    isSelected ? 'bg-amber-400 text-slate-900' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {port.max_draft_m ? `${port.max_draft_m}m` : 'Deep'}
                  </span>
                </div>
                <span className="text-xs font-bold block leading-tight truncate mt-1">{port.name}</span>
                <span className="text-[9px] block opacity-75 mt-0.5">
                  {port.berth_count} Berths · {port.authority_type || 'Major Port'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Detailed Port Dossier */}
      {loadingDetail ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-xs text-slate-400">
          Loading port constraints dossier for {selectedPortId}...
        </div>
      ) : portDetail ? (
        <div className="space-y-4">
          {/* Top Specifications Grid */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-govNavy font-serif">{portDetail.name}</h2>
                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-mono border border-slate-200">
                    {portDetail.port_id}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {portDetail.authority || 'Port Authority'} · {portDetail.country} · Coordinates: {portDetail.lat?.toFixed(2)}°N, {portDetail.lon?.toFixed(2)}°E
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-400">Gazette Status:</span>
                <ProvenanceBadge type="OBSERVED" text={portDetail.verification || 'Verified Gazette'} />
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">Approach Channel</span>
                <strong className="text-govNavy">{portDetail.approach_channel_depth_m ? `${portDetail.approach_channel_depth_m} m` : 'Unrestricted'}</strong>
              </div>

              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">Tidal Range</span>
                <strong className="text-slate-800">{portDetail.tidal_range_m ? `${portDetail.tidal_range_m} m` : 'Negligible'}</strong>
              </div>

              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">Registered Berths</span>
                <strong className="text-govNavy">{portDetail.berths?.length || 0} Berths</strong>
              </div>

              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">Median Queue (P50)</span>
                <strong className="text-amber-800">{portDetail.congestion?.expected_wait_hours_p50 ? `${(portDetail.congestion.expected_wait_hours_p50 / 24).toFixed(1)} days` : '—'}</strong>
              </div>

              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">Wait Pool P90</span>
                <strong className="text-slate-800">{portDetail.congestion?.p90 ? `${(portDetail.congestion.p90 / 24).toFixed(1)} days` : '—'}</strong>
              </div>

              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">Cyclone Frequency</span>
                <strong className="text-slate-800 font-sans">
                  {portDetail.weather?.[0]?.cyclone_freq_per_decade ? `${portDetail.weather[0].cyclone_freq_per_decade} / decade` : 'Low'}
                </strong>
              </div>
            </div>

            {/* Congestion Notice Banner */}
            <div className="p-2 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
                <span>
                  <strong>Congestion Wait Times: </strong>
                  Stratified by port + month ({portDetail.congestion?.sample_size || 365} calls sampled).
                </span>
              </div>
              <ProvenanceBadge type="SIMULATED_DEMO" text="Simulation / Demo Data" />
            </div>

            {portDetail.seasonal_notes && (
              <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200 text-xs text-govNavy">
                <strong>Operational Navigation Note: </strong>
                <span>{portDetail.seasonal_notes}</span>
              </div>
            )}
          </div>

          {/* Section: Berths Table & Vessel Compatibility */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Berths Table (Col 7) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                  Berth &amp; Handling Specifications
                </h3>
                <span className="text-[10px] text-slate-400 font-mono">
                  {portDetail.berths?.length || 0} active berths
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left gov-table border-collapse">
                  <thead>
                    <tr>
                      <th>Berth Name</th>
                      <th>Max Draft</th>
                      <th>Max LOA</th>
                      <th>Max Beam</th>
                      <th>Handling Rate</th>
                      <th>Cargo Support</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {portDetail.berths && portDetail.berths.length > 0 ? (
                      portDetail.berths.map((b) => (
                        <tr key={b.berth_id}>
                          <td className="font-sans font-semibold text-slate-800">
                            {b.berth_name}
                            <span className="text-[9px] text-slate-400 block font-mono">({b.berth_id})</span>
                          </td>
                          <td className="font-bold text-govNavy">{b.max_draft_m ? `${b.max_draft_m} m` : '—'}</td>
                          <td>{b.max_loa_m ? `${b.max_loa_m} m` : '—'}</td>
                          <td>{b.max_beam_m ? `${b.max_beam_m} m` : '—'}</td>
                          <td>{b.handling_rate_tpd ? `${b.handling_rate_tpd.toLocaleString()} t/d` : 'Conventional'}</td>
                          <td className="font-sans text-[10px]">
                            {b.mechanised ? (
                              <span className="bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">
                                Mechanized
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded">
                                Geared
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-slate-400 font-sans">
                          No berth constraints records registered.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Interactive Vessel Compatibility Evaluator (Col 5) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                  Vessel Class Compatibility Evaluator
                </h3>
                <div className="flex items-center space-x-1">
                  {VESSEL_CLASSES.map(cls => (
                    <button
                      key={cls}
                      onClick={() => setSelectedCompatClass(cls)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        selectedCompatClass === cls
                          ? 'bg-govNavy text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              {classCompat ? (
                <div className={`p-3 rounded-lg border space-y-2 ${
                  classCompat.feasible
                    ? 'bg-emerald-50/50 border-emerald-300'
                    : 'bg-rose-50/50 border-rose-300'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-xs">
                      {classCompat.vessel_class} Compatibility at {portDetail.name}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      classCompat.feasible
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {classCompat.feasible ? 'Permissible' : 'Infeasible'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {classCompat.infeasible_detail || classCompat.detail || (
                      classCompat.feasible
                        ? `${classCompat.vessel_class} can berth directly within permissible draft limits.`
                        : 'Exceeds permissible berth depth.'
                    )}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[9px] text-slate-500 block font-sans">Max Intake Capacity</span>
                      <strong className="text-govNavy">{classCompat.max_intake_t ? `${Math.round(classCompat.max_intake_t).toLocaleString()} t` : '—'}</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                      <span className="text-[9px] text-slate-500 block font-sans">Compatibility Score</span>
                      <strong className="text-slate-800">{classCompat.compat_score ? `${classCompat.compat_score.toFixed(1)} / 100` : '—'}</strong>
                    </div>
                  </div>

                  {classCompat.requires_lighterage && (
                    <div className="p-2 bg-amber-50 rounded border border-amber-300 text-[11px] text-amber-900 flex items-center space-x-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-700" />
                      <span>Requires deep-water lightening at Sandheads before proceeding upriver.</span>
                    </div>
                  )}

                  {classCompat.best_berth_name && (
                    <span className="text-[10px] text-slate-500 block">
                      Best Allocated Berth: <strong>{classCompat.best_berth_name}</strong>
                    </span>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Select a vessel class to inspect compatibility constraints.
                </div>
              )}

              {/* All Classes Summary Grid */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Class Overview at {selectedPortId}:
                </span>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {portDetail.vessel_compatibility?.map((vc) => (
                    <div
                      key={vc.vessel_class}
                      onClick={() => setSelectedCompatClass(vc.vessel_class)}
                      className={`p-2 rounded border flex items-center justify-between cursor-pointer transition ${
                        selectedCompatClass === vc.vessel_class
                          ? 'border-govNavy bg-slate-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-semibold text-slate-800">{vc.vessel_class}</span>
                      {vc.feasible ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
