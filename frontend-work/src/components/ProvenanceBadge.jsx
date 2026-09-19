import React from 'react';

/**
 * Institutional Provenance Badge
 * Complies with Section 24 of SIH26006 Specification:
 * - OBSERVED: Green/emerald badge
 * - MODEL OUTPUT: Blue badge
 * - DERIVED: Neutral blue/slate badge
 * - ASSUMED: Amber badge
 * - UNAVAILABLE: Grey/slate badge
 */
export default function ProvenanceBadge({ type = 'observed', text, className = '' }) {
  const normalized = (type || '').toLowerCase();

  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';
  let defaultText = 'Observed';

  if (normalized.includes('observed') || normalized.includes('measured') || normalized.includes('real')) {
    badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    dotColor = 'bg-emerald-600';
    defaultText = 'Observed';
  } else if (normalized.includes('model') || normalized.includes('forecast') || normalized.includes('quantile')) {
    badgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
    dotColor = 'bg-blue-600';
    defaultText = 'Model Output';
  } else if (normalized.includes('conformal') || normalized.includes('calibrated')) {
    badgeClass = 'bg-sky-50 text-sky-800 border-sky-200';
    dotColor = 'bg-sky-600';
    defaultText = 'Conformal 90%';
  } else if (normalized.includes('derived') || normalized.includes('calculated')) {
    badgeClass = 'bg-slate-100 text-slate-800 border-slate-300';
    dotColor = 'bg-slate-500';
    defaultText = 'Derived';
  } else if (normalized.includes('assumed') || normalized.includes('demo') || normalized.includes('simulated') || normalized.includes('expert')) {
    badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
    dotColor = 'bg-amber-500';
    defaultText = 'Calibrated Demo';
  } else if (normalized.includes('unavailable') || normalized.includes('pending')) {
    badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
    dotColor = 'bg-slate-400';
    defaultText = 'Unavailable';
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeClass} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mr-1 flex-shrink-0`} />
      <span>{text || defaultText}</span>
    </span>
  );
}
