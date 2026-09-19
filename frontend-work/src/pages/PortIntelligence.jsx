import React, { useState, useEffect } from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';

const EAST_COAST_PORTS = [
  {
    id: 'INPRT',
    name: 'Paradip Port Authority (PPA)',
    state: 'Odisha',
    maxDraft: 16.0,
    maxLOA: 260,
    maxBeam: 45.0,
    handlingRate: '25,000 MT/day',
    averageWaitDays: 3.2,
    tidalRestriction: 'None (Deep draft lagoon harbor)',
    source: 'PPA Official Berthing Guidelines & Daily Traffic Bulletin',
    verifiedDate: '15 Sep 2026',
    compatibility: {
      'Capesize': 'Infeasible (Draft limit 16.0m exceeded at full load)',
      'Panamax': 'Fully Compatible (Standard coal berth)',
      'Supramax': 'Fully Compatible',
      'Handysize': 'Fully Compatible'
    },
    berths: [
      { name: 'Central Quay 1 (CQ1)', draft: 14.5, cargo: 'Thermal Coal', maxLOA: 240 },
      { name: 'Mechanised Coal Berth (MCB)', draft: 16.0, cargo: 'Coking / Thermal Coal', maxLOA: 260 },
      { name: 'Iron Ore Berth (IOB)', draft: 15.0, cargo: 'Iron Ore Pellets', maxLOA: 250 },
    ]
  },
  {
    id: 'INVTZ',
    name: 'Visakhapatnam Port Authority (VPA)',
    state: 'Andhra Pradesh',
    maxDraft: 18.1,
    maxLOA: 300,
    maxBeam: 50.0,
    handlingRate: '35,000 MT/day',
    averageWaitDays: 2.1,
    tidalRestriction: 'None (Outer Harbor deep water)',
    source: 'VPA Marine Department Harbour Regulations 2026',
    verifiedDate: '10 Sep 2026',
    compatibility: {
      'Capesize': 'Fully Compatible (Outer Harbor Capesize Berth)',
      'Panamax': 'Fully Compatible',
      'Supramax': 'Fully Compatible',
      'Handysize': 'Fully Compatible'
    },
    berths: [
      { name: 'General Cargo Berth (GCB)', draft: 18.1, cargo: 'Coking Coal / Iron Ore', maxLOA: 300 },
      { name: 'Outer Harbour East Quay (EQ1)', draft: 16.5, cargo: 'Dry Bulk', maxLOA: 270 },
      { name: 'Inner Harbour Berths', draft: 11.5, cargo: 'Handymax / Supramax', maxLOA: 200 },
    ]
  },
  {
    id: 'INDHM',
    name: 'Dhamra Port (DPCL / Adani)',
    state: 'Odisha',
    maxDraft: 18.5,
    maxLOA: 320,
    maxBeam: 55.0,
    handlingRate: '40,000 MT/day',
    averageWaitDays: 1.8,
    tidalRestriction: 'Fairway deep water channel (min 19.5m)',
    source: 'Dhamra Port Tariff Authority & Marine Manual',
    verifiedDate: '01 Sep 2026',
    compatibility: {
      'Capesize': 'Fully Compatible (Deep-water Capesize Terminal)',
      'Panamax': 'Fully Compatible',
      'Supramax': 'Fully Compatible',
      'Handysize': 'Fully Compatible'
    },
    berths: [
      { name: 'Berth 1 (Bulk Import)', draft: 18.5, cargo: 'Coking Coal', maxLOA: 320 },
      { name: 'Berth 2 (Mechanized)', draft: 18.0, cargo: 'Thermal Coal', maxLOA: 300 },
    ]
  },
  {
    id: 'INGPL',
    name: 'Gangavaram Port (GPL / Adani)',
    state: 'Andhra Pradesh',
    maxDraft: 18.5,
    maxLOA: 310,
    maxBeam: 52.0,
    handlingRate: '35,000 MT/day',
    averageWaitDays: 2.0,
    tidalRestriction: 'All-weather, all-tide deep water port',
    source: 'GPL Port Operations Circular 2026',
    verifiedDate: '05 Sep 2026',
    compatibility: {
      'Capesize': 'Fully Compatible (Capesize Iron/Coal Berth)',
      'Panamax': 'Fully Compatible',
      'Supramax': 'Fully Compatible',
      'Handysize': 'Fully Compatible'
    },
    berths: [
      { name: 'Deep Water Berth 1', draft: 18.5, cargo: 'Coking Coal / Raw Material', maxLOA: 310 },
      { name: 'Coal Berth 2', draft: 17.0, cargo: 'Thermal Coal', maxLOA: 280 },
    ]
  },
  {
    id: 'INHAL',
    name: 'Haldia Dock Complex (HDCD / SMP Kolkata)',
    state: 'West Bengal',
    maxDraft: 8.5,
    maxLOA: 190,
    maxBeam: 29.5,
    handlingRate: '12,000 MT/day',
    averageWaitDays: 4.5,
    tidalRestriction: 'Strict riverine Hooghly draft restriction; lighterage at Sandheads required',
    source: 'Syama Prasad Mookerjee Port Kolkata Dredging & Draft Schedule',
    verifiedDate: '12 Sep 2026',
    compatibility: {
      'Capesize': 'Infeasible (Severe draft restriction 8.5m)',
      'Panamax': 'Infeasible without offshore lighterage',
      'Supramax': 'Part-load only or Sandheads lighterage',
      'Handysize': 'Compatible with tidal navigation'
    },
    berths: [
      { name: 'Berth 4A (Coal)', draft: 8.5, cargo: 'Thermal / Coking Coal', maxLOA: 190 },
      { name: 'Berth 8 (Iron Ore)', draft: 8.2, cargo: 'Ore / Minerals', maxLOA: 185 },
    ]
  },
  {
    id: 'INGPR',
    name: 'Gopalpur Port Limited',
    state: 'Odisha',
    maxDraft: 13.5,
    maxLOA: 225,
    maxBeam: 33.0,
    handlingRate: '18,000 MT/day',
    averageWaitDays: 2.8,
    tidalRestriction: 'Tidal entrance navigation channel',
    source: 'Gopalpur Port Gazette Notification',
    verifiedDate: '20 Aug 2026',
    compatibility: {
      'Capesize': 'Infeasible',
      'Panamax': 'Part-load restricted',
      'Supramax': 'Fully Compatible',
      'Handysize': 'Fully Compatible'
    },
    berths: [
      { name: 'Berth 1 (Multi-Purpose)', draft: 13.5, cargo: 'Coal / Sand Minerals', maxLOA: 225 },
    ]
  }
];

export default function PortIntelligence() {
  const [selectedPort, setSelectedPort] = useState(EAST_COAST_PORTS[0]);

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
              Verified draft, beam, LOA, and handling rate constraints for major bulk-handling terminals into India.
            </p>
          </div>
          <ProvenanceBadge type="observed" text="Major Port Authorities Data" />
        </div>
      </div>

      {/* Port Selection Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {EAST_COAST_PORTS.map(port => (
          <button
            key={port.id}
            onClick={() => setSelectedPort(port)}
            className={`p-2 rounded text-left border transition cursor-pointer ${
              selectedPort.id === port.id
                ? 'bg-govNavy text-white border-govNavy shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-[10px] font-mono block opacity-80">{port.id}</span>
            <span className="text-xs font-bold block leading-tight truncate">{port.name.split(' ')[0]}</span>
            <span className="text-[9px] block opacity-75 mt-0.5">Draft: {port.maxDraft}m</span>
          </button>
        ))}
      </div>

      {/* Selected Port Detailed Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Port Specifications (Col 7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
            <div className="flex justify-between items-start border-b border-slate-100 pb-2.5">
              <div>
                <h2 className="text-sm font-bold text-govNavy">{selectedPort.name}</h2>
                <span className="text-[10px] text-slate-500">{selectedPort.state}, India · UN/LOCODE: {selectedPort.id}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-slate-400 block">Verified On</span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  {selectedPort.verifiedDate}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-[10px] text-slate-500 block">Max Permissible Draft</span>
                <strong className="text-base text-govNavy font-mono block">{selectedPort.maxDraft} m</strong>
                <span className="text-[9px] text-slate-400">Salt Water (SW)</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-[10px] text-slate-500 block">Max Length Overall</span>
                <strong className="text-base text-slate-800 font-mono block">{selectedPort.maxLOA} m</strong>
                <span className="text-[9px] text-slate-400">LOA Envelope</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-[10px] text-slate-500 block">Max Beam</span>
                <strong className="text-base text-slate-800 font-mono block">{selectedPort.maxBeam} m</strong>
                <span className="text-[9px] text-slate-400">Fairway Breadth</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <span className="text-[10px] text-slate-500 block">Handling Rate</span>
                <strong className="text-xs text-slate-800 font-bold block mt-1">{selectedPort.handlingRate}</strong>
                <span className="text-[9px] text-slate-400">Dry Bulk Discharging</span>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded p-2.5 text-[11px] space-y-1">
              <span className="font-bold text-govNavy block text-[10px] uppercase tracking-wide">
                Navigational &amp; Tidal Conditions
              </span>
              <p className="text-slate-700 leading-snug">{selectedPort.tidalRestriction}</p>
              <div className="text-[10px] text-slate-500 pt-1">
                <strong>Statutory Source: </strong>{selectedPort.source}
              </div>
            </div>
          </div>

          {/* Berths Breakdown */}
          <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold text-govNavy border-b border-slate-100 pb-1.5 uppercase tracking-wide">
              Dedicated Bulk Berths &amp; Quays
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse gov-table">
                <thead>
                  <tr>
                    <th>Berth Name</th>
                    <th>Permissible Draft</th>
                    <th>Max LOA</th>
                    <th>Primary Commodity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedPort.berths.map((b, i) => (
                    <tr key={i}>
                      <td className="font-bold text-govNavy">{b.name}</td>
                      <td className="font-mono font-semibold text-slate-800">{b.draft} m</td>
                      <td className="font-mono text-slate-700">{b.maxLOA} m</td>
                      <td className="text-slate-600">{b.cargo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Vessel Class Compatibility Matrix (Col 5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-govNavy border-b border-slate-100 pb-1.5 uppercase tracking-wide">
              Vessel Compatibility Matrix
            </h3>

            <div className="space-y-2 text-[11px]">
              {Object.entries(selectedPort.compatibility).map(([cls, desc]) => {
                const isFeasible = desc.toLowerCase().includes('compatible');
                return (
                  <div 
                    key={cls} 
                    className={`p-2.5 rounded border ${
                      isFeasible ? 'bg-emerald-50/40 border-emerald-200' : 'bg-red-50/40 border-red-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <strong className="text-govNavy font-bold">{cls}</strong>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        isFeasible ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {isFeasible ? 'Compatible' : 'Restricted'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600">{desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500">
              <p>
                Rule of Thumb: Capesize vessels require &gt;18.0m draft; Panamax requires &gt;14.0m draft at laden capacity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
