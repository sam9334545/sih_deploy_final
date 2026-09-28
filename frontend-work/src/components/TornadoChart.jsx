import React from 'react';
import ProvenanceBadge from './ProvenanceBadge';

/**
 * Tornado / Sensitivity Analysis Chart
 * Displays the backend-authoritative cost impact range of parameter shocks
 * (Freight ±20%, Bunker ±15%, Waiting ±30%, Demurrage ±30%, Port Costs ±10%, Repositioning ±15%, Lighterage ±20%)
 * calculated via the Monte Carlo digital twin simulator.
 */
export default function TornadoChart({
  sensitivity = [],
  breakdown = {},
  totalCost = 0,
}) {
  const items = Array.isArray(sensitivity) && sensitivity.length > 0
    ? sensitivity
        .filter((item) => {
          const swing = typeof item.swing_usd === 'number' ? item.swing_usd : 0;
          const compBase = typeof item.component_baseline === 'number' ? item.component_baseline : 0;
          return swing > 0 || compBase > 0;
        })
        .map((item) => {
          const lowDelta = typeof item.low_delta === 'number' ? item.low_delta : 0;
          const highDelta = typeof item.high_delta === 'number' ? item.high_delta : 0;
          const swing = typeof item.swing_usd === 'number' ? item.swing_usd : Math.abs(highDelta - lowDelta);
          const baseline = typeof item.baseline_cost === 'number' ? item.baseline_cost : totalCost;
          const compVal = typeof item.component_baseline === 'number' ? item.component_baseline : 0;

          return {
            key: item.factor,
            label: item.name || item.label || item.factor,
            value: compVal > 0 ? compVal : baseline,
            baselineCost: baseline,
            lowCost: item.low_cost,
            highCost: item.high_cost,
            lowDelta,
            highDelta,
            totalSwing: swing,
            shockLow: item.shock_low,
            shockHigh: item.shock_high,
          };
        })
        .sort((a, b) => b.totalSwing - a.totalSwing)
    : [];

  const maxSwing = items.length > 0
    ? Math.max(...items.map((i) => Math.max(Math.abs(i.lowDelta), Math.abs(i.highDelta)))) || 100000
    : 100000;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 border-b border-slate-100 pb-2.5">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              Decision Sensitivity Tornado: What Could Change This Decision?
            </h3>
            <ProvenanceBadge type="DERIVED" text="Backend Simulation" />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Parametric variance impact on landed cost calculated by stochastic backend simulation under calibrated factor shocks.
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

      {items.length === 0 ? (
        <div className="py-6 px-4 text-center text-xs text-slate-500 bg-slate-50 rounded border border-dashed border-slate-200">
          <p className="font-semibold text-slate-700">Sensitivity Analysis Standby</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Execute Monte Carlo simulation above to compute backend-authoritative scenario shocks.
          </p>
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          {items.map((item) => {
            const favorableWidth = Math.max(2, (Math.abs(item.lowDelta) / maxSwing) * 45);
            const adverseWidth = Math.max(2, (Math.abs(item.highDelta) / maxSwing) * 45);

            return (
              <div key={item.key} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">
                    {item.label}
                    {item.shockLow && item.shockHigh && (
                      <span className="text-[10px] text-slate-400 font-mono ml-1 font-normal">
                        ({item.shockLow > 0 ? `+${(item.shockLow * 100).toFixed(0)}%` : `${(item.shockLow * 100).toFixed(0)}%`} /{' '}
                        {item.shockHigh > 0 ? `+${(item.shockHigh * 100).toFixed(0)}%` : `${(item.shockHigh * 100).toFixed(0)}%`})
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-slate-500 text-[10px]">
                    Component: ${Math.round(item.value).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 items-center h-5 bg-slate-50 rounded px-1 border border-slate-100">
                  {/* Left side: Favorable swing */}
                  <div className="flex justify-end items-center pr-1 border-r border-slate-300">
                    <div
                      className="h-3.5 bg-emerald-500 rounded-l transition-all duration-300 flex items-center justify-end px-1"
                      style={{ width: `${favorableWidth}%` }}
                      title={`Favorable: -$${Math.round(Math.abs(item.lowDelta)).toLocaleString()} (Total: $${Math.round(item.lowCost || 0).toLocaleString()})`}
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
                      title={`Adverse: +${Math.round(Math.abs(item.highDelta)).toLocaleString()} (Total: $${Math.round(item.highCost || 0).toLocaleString()})`}
                    >
                      <span className="text-[9px] font-mono font-bold text-white whitespace-nowrap">
                        +${Math.round(Math.abs(item.highDelta) / 1000)}k
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex flex-col sm:flex-row justify-between gap-1">
        <span>Authoritative scenario shocks evaluated across complete Monte Carlo digital twin.</span>
        <span className="font-mono font-semibold text-slate-700">
          Baseline Mean: ${Math.round(totalCost || (items[0]?.baselineCost || 0)).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
