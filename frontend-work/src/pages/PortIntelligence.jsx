import React, { useState, useEffect } from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { fetchPortsList, fetchPortDetail, ApiError } from '../api';

export default function PortIntelligence() {
  const [ports, setPorts] = useState([]);
  const [selectedPortId, setSelectedPortId] = useState('INPRT');
  const [portDetail, setPortDetail] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch all registered Indian ports on mount
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
        setError('Failed to retrieve registered ports list from backend.');
      } finally {
        setLoadingList(false);
      }
    }
    loadPorts();
  }, []);

  // 2. Fetch selected port detailed dossier
  useEffect(() => {
    if (!selectedPortId) return;

    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const detail = await fetchPortDetail(selectedPortId, { cargoType: 'coking_coal' });
        setPortDetail(detail);
      } catch (err) {
        console.error(`Failed to load details for port ${selectedPortId}:`, err);
      } finally {
        setLoadingDetail(false);
      }
    }
    loadDetail();
  }, [selectedPortId]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">East Coast India Port Intelligence Registry</h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                Official Navigational Constraints
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Verified draft, beam, LOA, berth facilities, and vessel compatibility constraints for major Indian bulk discharge terminals.
            </p>
          </div>
          <ProvenanceBadge type="observed" text="Major Port Authorities Data" />
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Port Selection Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {loadingList ? (
          <div className="col-span-full py-4 text-center text-xs text-slate-500">
            Loading registered ports from database...
          </div>
        ) : (
          ports.map((port) => (
            <button
              key={port.port_id}
              onClick={() => setSelectedPortId(port.port_id)}
              className={`p-2 rounded text-left border transition cursor-pointer ${
                selectedPortId === port.port_id
                  ? 'bg-govNavy text-white border-govNavy shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <span className="text-[10px] font-mono block opacity-80">{port.port_id}</span>
              <span className="text-xs font-bold block leading-tight truncate">{port.name}</span>
              <span className="text-[9px] block opacity-75 mt-0.5">
                Max Draft: {port.max_draft_m ? `${port.max_draft_m}m` : 'Unspecified'}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Selected Port Detailed Dossier */}
      {loadingDetail ? (
        <div className="bg-white border border-lightBorder rounded p-12 text-center text-xs text-slate-500">
          Loading port constraints dossier for {selectedPortId}...
        </div>
      ) : portDetail ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Port Specifications & Berths (Col 7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
                <div>
                  <h2 className="text-sm font-bold text-govNavy">{portDetail.name}</h2>
                  <span className="text-[10px] text-slate-500">
                    {portDetail.authority || 'Port Authority'} · UN/LOCODE: {portDetail.port_id}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block">Verification</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    {portDetail.verification || 'Official Record'}
                  </span>
                </div>
              </div>

              {/* Quick Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Approach Channel</span>
                  <strong className="text-govNavy font-mono">
                    {portDetail.approach_channel_depth_m ? `${portDetail.approach_channel_depth_m} m` : 'Unrestricted'}
                  </strong>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Tidal Range</span>
                  <strong className="text-govNavy font-mono">
                    {portDetail.tidal_range_m ? `${portDetail.tidal_range_m} m` : 'Negligible'}
                  </strong>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Active Berths</span>
                  <strong className="text-govNavy font-mono">{portDetail.berths?.length || 0} Berths</strong>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Median Congestion Wait</span>
                  <strong className="text-amber-800 font-mono">
                    {portDetail.congestion?.expected_wait_hours_p50 ? `${(portDetail.congestion.expected_wait_hours_p50 / 24).toFixed(1)} days` : 'N/A'}
                  </strong>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Wait Pool P90</span>
                  <strong className="text-slate-800 font-mono">
                    {portDetail.congestion?.p90 ? `${(portDetail.congestion.p90 / 24).toFixed(1)} days` : 'N/A'}
                  </strong>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">Coordinates</span>
                  <strong className="text-slate-800 font-mono text-[10px]">
                    {portDetail.lat ? `${portDetail.lat.toFixed(2)}°N, ${portDetail.lon.toFixed(2)}°E` : 'N/A'}
                  </strong>
                </div>
              </div>

              {portDetail.seasonal_notes && (
                <div className="p-2.5 bg-blue-50/50 rounded border border-blue-200 text-[11px] text-govNavy">
                  <strong className="block text-[10px] uppercase font-bold text-govBlueAccent">Operational &amp; Seasonal Notes:</strong>
                  <p className="mt-0.5">{portDetail.seasonal_notes}</p>
                </div>
              )}
            </div>

            {/* Berths Table */}
            <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-2.5">
              <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                Terminal Berths &amp; Handling Specifications
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse gov-table text-[11px]">
                  <thead>
                    <tr>
                      <th>Berth Name / ID</th>
                      <th>Max Draft</th>
                      <th>Max LOA</th>
                      <th>Handling Rate</th>
                      <th>Mechanization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {portDetail.berths && portDetail.berths.length > 0 ? (
                      portDetail.berths.map((b) => (
                        <tr key={b.berth_id}>
                          <td className="font-semibold text-slate-800">{b.berth_name} ({b.berth_id})</td>
                          <td className="font-mono">{b.max_draft_m ? `${b.max_draft_m} m` : '—'}</td>
                          <td className="font-mono">{b.max_loa_m ? `${b.max_loa_m} m` : '—'}</td>
                          <td className="font-mono">
                            {b.handling_rate_tpd ? `${b.handling_rate_tpd.toLocaleString()} T/day` : 'Conventional'}
                          </td>
                          <td>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              b.mechanised ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {b.mechanised ? 'Mechanized' : 'Geared'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-3 text-slate-400">No berths registered.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right: Vessel Class Compatibility Matrix (Col 5) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide border-b border-slate-100 pb-2">
                Standard Bulk Bulker Class Feasibility
              </h3>

              <div className="space-y-2 text-xs">
                {(() => {
                  if (!portDetail.vessel_compatibility) {
                    return (
                      <div className="text-center text-slate-400 py-4 text-xs">
                        No class compatibility evaluation available.
                      </div>
                    );
                  }
                  const list = Array.isArray(portDetail.vessel_compatibility)
                    ? portDetail.vessel_compatibility
                    : Object.entries(portDetail.vessel_compatibility).map(([cls, fit]) => ({ vessel_class: cls, ...fit }));

                  return list.map((item) => {
                    const cls = item.vessel_class;
                    const feasible = item.feasible;
                    return (
                      <div
                        key={cls}
                        className={`p-3 rounded border ${
                          feasible
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <strong className="text-slate-800 font-semibold">{cls}</strong>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              feasible
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {feasible ? 'Feasible' : 'Infeasible'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          {item.infeasible_detail || item.detail || (feasible ? 'Berth and draft compatible.' : 'Exceeds port permissible draft.')}
                        </p>
                        {item.best_berth_name && (
                          <span className="text-[10px] text-slate-500 block mt-1">
                            Best Berth: {item.best_berth_name}
                          </span>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
