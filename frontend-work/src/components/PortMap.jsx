import React from 'react';

// Authoritative coordinates for Indian East Coast discharge ports & major load hubs
const PORT_COORDINATES = {
  // Indian East Coast Discharge Ports
  INPRT: { name: 'Paradip Port', lat: 20.2654, lon: 86.6763, x: 535, y: 220, role: 'discharge', state: 'Odisha' },
  INVTZ: { name: 'Visakhapatnam Port', lat: 17.6868, lon: 83.2185, x: 475, y: 310, role: 'discharge', state: 'Andhra Pradesh' },
  INDHA: { name: 'Dhamra Port', lat: 20.8033, lon: 86.9733, x: 550, y: 195, role: 'discharge', state: 'Odisha' },
  INGGV: { name: 'Gangavaram Port', lat: 17.6186, lon: 83.2389, x: 475, y: 325, role: 'discharge', state: 'Andhra Pradesh' },
  INHAL: { name: 'Haldia Dock Complex', lat: 22.0667, lon: 88.0833, x: 585, y: 145, role: 'discharge', state: 'West Bengal' },
  INGPR: { name: 'Gopalpur Port', lat: 19.3083, lon: 84.9667, x: 505, y: 260, role: 'discharge', state: 'Odisha' },

  // Overseas Origin Loading Ports (Projected into navigational locator inset)
  AUHPT: { name: 'Hay Point (Australia)', lat: -21.28, lon: 149.30, x: 670, y: 380, role: 'load', country: 'Australia' },
  AUGLT: { name: 'Gladstone (Australia)', lat: -23.85, lon: 151.27, x: 685, y: 350, role: 'load', country: 'Australia' },
  IDTBA: { name: 'Taboneo (Indonesia)', lat: -3.55, lon: 114.45, x: 630, y: 310, role: 'load', country: 'Indonesia' },
  ZARBY: { name: 'Richards Bay (South Africa)', lat: -28.80, lon: 32.08, x: 120, y: 380, role: 'load', country: 'South Africa' },
  USHAM: { name: 'Hampton Roads (USA)', lat: 36.95, lon: -76.33, x: 90, y: 90, role: 'load', country: 'USA' },
  MZBEW: { name: 'Beira (Mozambique)', lat: -19.83, lon: 34.84, x: 150, y: 330, role: 'load', country: 'Mozambique' },
};

export default function PortMap({
  ports = [],
  selectedPortId = 'INPRT',
  onSelectPort,
  originPortId = 'AUHPT',
  onSelectOrigin,
}) {
  const currentDischarge = PORT_COORDINATES[selectedPortId] || PORT_COORDINATES.INPRT;
  const currentOrigin = PORT_COORDINATES[originPortId] || PORT_COORDINATES.AUHPT;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-white space-y-2 relative overflow-hidden shadow-xs">
      <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <h4 className="font-bold text-slate-100 tracking-wide">
            East Coast India Maritime Terminal Radar &amp; Navigational Corridors
          </h4>
        </div>
        <span className="text-[10px] font-mono text-cyan-300">
          Selected: {currentDischarge.name} ({selectedPortId})
        </span>
      </div>

      {/* SVG Map Canvas */}
      <div className="relative w-full h-[280px] bg-slate-950 rounded border border-slate-800/80 overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 720 420"
          className="w-full h-full select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Sea water pattern */}
            <linearGradient id="seaGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#051329" />
              <stop offset="100%" stopColor="#0a2540" />
            </linearGradient>

            {/* Glowing route line */}
            <linearGradient id="corridorGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Background Ocean */}
          <rect width="720" height="420" fill="url(#seaGrad)" />

          {/* Simplified Coastline Representation of Bay of Bengal / India East Coast */}
          <path
            d="M 280,30 Q 340,90 380,120 T 430,170 T 470,230 T 450,290 T 410,360 L 320,420 L 0,420 L 0,0 L 280,0 Z"
            fill="#0f172a"
            stroke="#1e293b"
            strokeWidth="1.5"
          />

          {/* Grid Latitude / Longitude lines */}
          <line x1="0" y1="140" x2="720" y2="140" stroke="#1e293b" strokeDasharray="3 4" strokeWidth="0.8" />
          <line x1="0" y1="260" x2="720" y2="260" stroke="#1e293b" strokeDasharray="3 4" strokeWidth="0.8" />
          <line x1="450" y1="0" x2="450" y2="420" stroke="#1e293b" strokeDasharray="3 4" strokeWidth="0.8" />
          <line x1="600" y1="0" x2="600" y2="420" stroke="#1e293b" strokeDasharray="3 4" strokeWidth="0.8" />

          {/* Coordinate labels */}
          <text x="15" y="135" fill="#475569" fontSize="9" fontFamily="monospace">22° N (Tropic of Cancer)</text>
          <text x="15" y="255" fill="#475569" fontSize="9" fontFamily="monospace">18° N (Bay of Bengal)</text>
          <text x="455" y="15" fill="#475569" fontSize="9" fontFamily="monospace">84° E</text>
          <text x="590" y="15" fill="#475569" fontSize="9" fontFamily="monospace">88° E</text>

          {/* Active Route Arc between Origin and Selected Discharge Port */}
          {currentOrigin && currentDischarge && (
            <g>
              <path
                d={`M ${currentOrigin.x} ${currentOrigin.y} Q ${(currentOrigin.x + currentDischarge.x) / 2 + 30} ${(currentOrigin.y + currentDischarge.y) / 2 + 40} ${currentDischarge.x} ${currentDischarge.y}`}
                fill="none"
                stroke="url(#corridorGrad)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="100"
                  to="0"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          )}

          {/* Overseas Loading Port Pins */}
          {Object.entries(PORT_COORDINATES).filter(([_, p]) => p.role === 'load').map(([id, p]) => {
            const isSelectedOrigin = id === originPortId;
            return (
              <g
                key={id}
                onClick={() => onSelectOrigin && onSelectOrigin(id)}
                className="cursor-pointer transition-transform duration-200"
              >
                {isSelectedOrigin && (
                  <circle cx={p.x} cy={p.y} r="12" fill="#38bdf8" opacity="0.25">
                    <animate attributeName="r" values="6;16;6" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0.1;0.5" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelectedOrigin ? '6' : '4.5'}
                  fill={isSelectedOrigin ? '#38bdf8' : '#0284c7'}
                  stroke="#ffffff"
                  strokeWidth={isSelectedOrigin ? '2' : '1.2'}
                />
                <text
                  x={p.x < 300 ? p.x + 8 : p.x - 10}
                  y={p.y + (p.y > 300 ? 14 : -8)}
                  textAnchor={p.x < 300 ? 'start' : 'end'}
                  fill={isSelectedOrigin ? '#38bdf8' : '#94a3b8'}
                  fontSize={isSelectedOrigin ? '9.5' : '8.5'}
                  fontWeight={isSelectedOrigin ? 'bold' : 'normal'}
                >
                  {p.name.replace(' (', ' · ').replace(')', '')}
                </text>
              </g>
            );
          })}

          {/* East Coast Discharge Ports Pins */}
          {Object.entries(PORT_COORDINATES).filter(([_, p]) => p.role === 'discharge').map(([id, p]) => {
            const isSelected = id === selectedPortId;
            return (
              <g
                key={id}
                onClick={() => onSelectPort && onSelectPort(id)}
                className="cursor-pointer transition-transform duration-200"
              >
                {/* Radar pulse for selected port */}
                {isSelected && (
                  <circle cx={p.x} cy={p.y} r="14" fill="#38bdf8" opacity="0.3">
                    <animate attributeName="r" values="8;20;8" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Outer anchor circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? '7' : '5'}
                  fill={isSelected ? '#0284c7' : '#1e3a8a'}
                  stroke={isSelected ? '#38bdf8' : '#93c5fd'}
                  strokeWidth="1.8"
                />

                {/* Inner center dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isSelected ? '3' : '2'}
                  fill={isSelected ? '#ffffff' : '#60a5fa'}
                />

                {/* Port label */}
                <text
                  x={p.x + 10}
                  y={p.y + 4}
                  fill={isSelected ? '#38bdf8' : '#cbd5e1'}
                  fontSize={isSelected ? '10' : '9'}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {p.name.replace(' Port', '')}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend Overlay */}
        <div className="absolute bottom-2 left-2 bg-slate-900/90 border border-slate-700/80 rounded px-2 py-1.5 text-[9px] text-slate-300 space-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 border border-cyan-300" />
            <span>Active Discharge Port</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-900 border border-blue-400" />
            <span>East Coast Bulk Terminals</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-sky-400" />
            <span>Active Maritime Charter Corridor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
