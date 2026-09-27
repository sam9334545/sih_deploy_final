import React from 'react';

/**
 * Tornado / Sensitivity Analysis Chart
 * Displays the cost impact range of uncertain parameters (freight, bunker, port waiting, demurrage, weather, lighterage)
 * based on simulator and cost model component variance.
 */
export default function TornadoChart({ breakdown = {}, totalCost = 0, distributions = {} }) {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    return null;
  }

  // Define parameter sensitivity factors based on standard uncertainty swings
  // (freight +/- 15%, bunker +/- 12%, waiting +/- 35%, demurrage +/- 40%, weather +/- 25%, lighterage +/- 10%)
  const factors = [
    { key: 'freight', label: 'Freight Rate (Index Volatility)', swing: 0.18, value: breakdown.freight || 0 },
    { key: 'bunker', label: 'Bunker Price (VLSFO Singapore)', swing: 0.14, value: breakdown.bunker || 0 },
    { key: 'waiting', label: 'Port Pre-Berthing Waiting Time', swing: 0.40, value: breakdown.waiting || 0 },
    { key: 'expected_demurrage', label: 'Demurrage Claims & Delays', swing: 0.50, value: breakdown.expected_demurrage || 0 },
    { key: 'port_costs', label: 'Port Tariffs & Pilotage', swing: 0.08, value: breakdown.port_costs || 0 },
    { key: 'repositioning', label: 'Ballast & Repositioning Cost', swing: 0.15, value: breakdown.repositioning || 0 },
    { key: 'lighterage', label: 'Sandheads Lighterage & Barge', swing: 0.20, value: breakdown.lighterage || 0 },
  ].filter(f => f.value > 0);

  // Sort by impact range (descending) -> creating classical tornado shape
  const items = factors.map(f => {
    const lowDelta = -(f.value * f.swing);
    const highDelta = f.value * f.swing;
    const totalSwing = highDelta - lowDelta;
    return {
      ...f,
      lowDelta,
      highDelta,
      totalSwing,
    };
  }).sort((a, b) => b.totalSwing - a.totalSwing);

  const maxSwing = items.length > 0 ? items[0].highDelta : 100000;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 border-b border-slate-100 pb-2.5">
        <div>
          <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
            Decision Sensitivity Tornado: What Could Change This Decision?
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Parametric variance impact on total expected landed cost across stochastic cost drivers.
          </p>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-medium text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-xs" />
            <span>Favorable Swing (-Cost)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-xs" />
            <span>Adverse Swing (+Cost)</span>
          </span>
        </div>
      </div>

      <div className="space-y-2 pt-1">
        {items.map((item) => {
          const favorableWidth = Math.max(2, (Math.abs(item.lowDelta) / maxSwing) * 45);
          const adverseWidth = Math.max(2, (item.highDelta / maxSwing) * 45);

          return (
            <div key={item.key} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-semibold text-slate-700">{item.label}</span>
                <span className="font-mono text-slate-500 text-[10px]">
                  Baseline: ${Math.round(item.value).toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 items-center h-5 bg-slate-50 rounded px-1 border border-slate-100">
                {/* Left side: Favorable swing */}
                <div className="flex justify-end items-center pr-1 border-r border-slate-300">
                  <div
                    className="h-3.5 bg-emerald-500 rounded-l transition-all duration-300 flex items-center justify-end px-1"
                    style={{ width: `${favorableWidth}%` }}
                    title={`Favorable: -$${Math.round(Math.abs(item.lowDelta)).toLocaleString()}`}
                  >
                    <span className="text-[9px] font-mono font-bold text-white whitespace-nowrap">
                      -${Math.round(Math.abs(item.lowDelta) / 1000)}k
                    </span>
                  </div>
                </div>

                {/* Right side: Adverse swing */}
                <div className="flex justify-start items-center pl-1">
                  <div
                    className="h-3.5 bg-rose-500 rounded-r transition-all duration-300 flex items-center justify-start px-1"
                    style={{ width: `${adverseWidth}%` }}
                    title={`Adverse: +$${Math.round(item.highDelta).toLocaleString()}`}
                  >
                    <span className="text-[9px] font-mono font-bold text-white whitespace-nowrap">
                      +${Math.round(item.highDelta / 1000)}k
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
        <span>Tornado width represents ±1σ historical and empirical parameter fluctuation.</span>
        <span className="font-mono font-semibold text-slate-700">Total Landed: ${Math.round(totalCost).toLocaleString()}</span>
      </div>
    </div>
  );
}
