import React from 'react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Visualizes the cost distribution of simulated strategies:
 * P10 (optimistic lower bound), P50 (median), Mean, P90 (upper bound), and CVaR-90 (tail risk).
 */
export default function CostDistributionChart({ results = [], winnerId = null }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';

  if (!results || results.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded border border-dashed border-slate-200">
        {isHi 
          ? 'कोई सिमुलेशन वितरण डेटा उपलब्ध नहीं है। लागत वितरण देखने के लिए सिमुलेशन चलाएं।' 
          : 'No simulation distribution data available. Run simulation to view cost distributions.'}
      </div>
    );
  }

  // Calculate global min and max cost across all strategies
  let globalMin = Infinity;
  let globalMax = -Infinity;

  results.forEach(r => {
    const c = r.cost || {};
    const lo = typeof c.p10 === 'number' ? c.p10 : (typeof c.mean === 'number' ? c.mean : 0);
    const hi = Math.max(
      typeof c.p90 === 'number' ? c.p90 : (typeof c.mean === 'number' ? c.mean : 0),
      typeof c.cvar_90 === 'number' ? c.cvar_90 : (typeof c.mean === 'number' ? c.mean : 0),
      typeof r.risk_adjusted_cost === 'number' ? r.risk_adjusted_cost : (typeof c.mean === 'number' ? c.mean : 0)
    );
    if (lo < globalMin && lo > 0) globalMin = lo;
    if (hi > globalMax) globalMax = hi;
  });

  // Add 5% padding
  const padding = (globalMax - globalMin) * 0.05 || 100000;
  const minVal = Math.max(0, globalMin - padding);
  const maxVal = globalMax + padding;
  const range = maxVal - minVal || 1;

  const toPercent = (val) => Math.min(100, Math.max(0, ((val - minVal) / range) * 100));

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
            {isHi ? 'सिम्युलेटेड लैंडेड लागत वितरण तुलना' : 'Simulated Landed Cost Distribution Comparison'}
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isHi 
              ? 'मोंटे कार्लो वितरण जो P10 (आशावादी), माध्यिका (P50), अपेक्षित (माध्य), P90 (निराशावादी) और टेल जोखिम (CVaR-90) प्रदर्शित करते हैं।'
              : 'Monte Carlo distributions showing P10 (optimistic), Median (P50), Expected (Mean), P90 (pessimistic), and Tail Risk (CVaR-90).'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-600 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 bg-blue-100 border border-blue-400 rounded-xs" />
            <span>{isHi ? '80% विश्वास अंतराल (P10–P90)' : '80% Confidence Band (P10–P90)'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-blue-700 rounded-full" />
            <span>{isHi ? 'माध्यिका (P50)' : 'Median (P50)'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-emerald-600 rotate-45 transform" />
            <span>{isHi ? 'माध्य लागत' : 'Mean Cost'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-rose-600 rounded-xs" />
            <span>{isHi ? 'CVaR-90 टेल' : 'CVaR-90 Tail'}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
            <span>{isHi ? 'जोखिम-समायोजित' : 'Risk-Adjusted'}</span>
          </span>
        </div>
      </div>

      {/* Axis Scale Markers */}
      <div className="relative pt-2 pb-1 text-[10px] font-mono text-slate-400 flex justify-between border-b border-slate-100">
        <span>${(minVal / 1e6).toFixed(2)}M</span>
        <span>${((minVal + range * 0.25) / 1e6).toFixed(2)}M</span>
        <span>${((minVal + range * 0.5) / 1e6).toFixed(2)}M</span>
        <span>${((minVal + range * 0.75) / 1e6).toFixed(2)}M</span>
        <span>${(maxVal / 1e6).toFixed(2)}M</span>
      </div>

      {/* Strategy Bars */}
      <div className="space-y-4 pt-1">
        {results.map((r) => {
          const isWinner = r.id === winnerId;
          const c = r.cost || {};
          const p10 = c.p10 || c.mean;
          const p50 = c.p50 || c.mean;
          const p90 = c.p90 || c.mean;
          const mean = c.mean || p50;
          const cvar90 = c.cvar_90 || p90;
          const riskAdj = r.risk_adjusted_cost || mean;

          const leftPct = toPercent(p10);
          const rightPct = toPercent(p90);
          const widthPct = Math.max(1, rightPct - leftPct);
          const p50Pct = toPercent(p50);
          const meanPct = toPercent(mean);
          const cvarPct = toPercent(cvar90);
          const riskAdjPct = toPercent(riskAdj);

          return (
            <div
              key={r.id}
              className={`p-3 rounded-lg border transition ${
                isWinner
                  ? 'bg-blue-50/50 border-blue-300 ring-1 ring-blue-300'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                    isWinner ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {r.id}
                  </span>
                  <span className="font-bold text-slate-800">{r.label}</span>
                  {isWinner && (
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider">
                      {isHi ? 'सर्वश्रेष्ठ अनुशंसित' : 'Recommended'}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-[11px] text-slate-600 font-mono mt-1 sm:mt-0">
                  <span>{isHi ? 'माध्य:' : 'Mean:'} <strong>${Math.round(mean).toLocaleString()}</strong></span>
                  <span>{isHi ? 'जोखिम-समायोजित:' : 'Risk-Adj:'} <strong className="text-govNavy">${Math.round(riskAdj).toLocaleString()}</strong></span>
                  <span className="text-[10px] text-slate-500">(${r.usd_per_tonne ? r.usd_per_tonne.toFixed(2) : '—'}/{isHi ? 'टन' : 't'})</span>
                </div>
              </div>

              {/* Distribution Range Bar */}
              <div className="relative h-6 bg-slate-200/70 rounded-full overflow-hidden flex items-center">
                {/* 80% Confidence Band (P10 to P90) */}
                <div
                  className="absolute top-1 bottom-1 bg-blue-200/90 rounded border-l-2 border-r-2 border-blue-500"
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${isHi ? '80% अंतराल' : '80% Band'}: $${Math.round(p10).toLocaleString()} – $${Math.round(p90).toLocaleString()}`}
                />

                {/* Median P50 Marker */}
                <div
                  className="absolute w-2 h-4 bg-blue-700 rounded-sm -translate-x-1/2 z-10"
                  style={{ left: `${p50Pct}%` }}
                  title={`P50 ${isHi ? 'माध्यिका' : 'Median'}: $${Math.round(p50).toLocaleString()}`}
                />

                {/* Mean Marker */}
                <div
                  className="absolute w-2.5 h-2.5 bg-emerald-600 rotate-45 -translate-x-1/2 z-10 shadow-xs"
                  style={{ left: `${meanPct}%` }}
                  title={`${isHi ? 'माध्य' : 'Mean'}: $${Math.round(mean).toLocaleString()}`}
                />

                {/* CVaR 90 Marker */}
                <div
                  className="absolute w-2 h-4 bg-rose-600 rounded-xs -translate-x-1/2 z-10"
                  style={{ left: `${cvarPct}%` }}
                  title={`CVaR 90: $${Math.round(cvar90).toLocaleString()}`}
                />

                {/* Risk-Adjusted Marker */}
                <div
                  className="absolute w-3 h-3 bg-amber-500 border border-white rounded-full -translate-x-1/2 z-20 shadow-xs"
                  style={{ left: `${riskAdjPct}%` }}
                  title={`${isHi ? 'जोखिम-समायोजित लागत' : 'Risk-Adjusted Cost'}: $${Math.round(riskAdj).toLocaleString()}`}
                />
              </div>

              {/* Detailed Numbers Row */}
              <div className="flex flex-wrap justify-between text-[10px] font-mono text-slate-500 mt-1.5 pt-1 border-t border-slate-200/50">
                <span>P10: ${Math.round(p10).toLocaleString()}</span>
                <span>P50: ${Math.round(p50).toLocaleString()}</span>
                <span>P90: ${Math.round(p90).toLocaleString()}</span>
                <span className="text-rose-700">CVaR-90: ${Math.round(cvar90).toLocaleString()}</span>
                <span>{isHi ? 'समय-सीमा चूक जोखिम:' : 'Late Risk:'} {(r.p_deadline_miss * 100).toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
