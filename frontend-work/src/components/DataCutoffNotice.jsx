import React from 'react';
import ProvenanceBadge from './ProvenanceBadge';

export default function DataCutoffNotice({ className = '', compact = false }) {
  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 py-1.5 px-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 ${className}`}>
        <span className="font-semibold text-govNavy">Forecast Environment:</span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge type="OBSERVED" text="Observed (2012–2019)" />
        </span>
        <span className="text-slate-400">→</span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge type="SYNTHETIC EXTENSION" text="Synthetic Extension (2020–2026)" />
        </span>
        <span className="text-slate-400">→</span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge type="FORECAST" text="ML Forecast (2026+)" />
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-lg p-3 text-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-2 mb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <strong className="text-govNavy font-semibold uppercase tracking-wide text-[10px]">
            Data Integrity &amp; Forecasting Environment Architecture
          </strong>
        </div>
        <div className="flex items-center gap-1.5">
          <ProvenanceBadge type="OBSERVED" text="2012–2019 Verified" />
          <ProvenanceBadge type="SYNTHETIC EXTENSION" text="2020–2026 Synthetic" />
          <ProvenanceBadge type="FORECAST" text="2026+ Horizon" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700">
        <div className="p-2 bg-white/80 rounded border border-emerald-100">
          <div className="font-bold text-emerald-900 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            1. Verified Ground Truth (2012–2019)
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            1,749 verified daily sessions from Mendeley Data (DOI 10.17632/mcm7ycmjtt.1). Models are trained and split-conformal calibrated strictly on verified historical records.
          </p>
        </div>
        <div className="p-2 bg-white/80 rounded border border-purple-100">
          <div className="font-bold text-purple-900 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            2. Synthetic Extension (2020–2026)
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            Ornstein-Uhlenbeck stochastic extension calibrated to Baltic market volatility regimes, supporting multi-voyage simulation experiments leading into the 2026 decision window.
          </p>
        </div>
        <div className="p-2 bg-white/80 rounded border border-blue-100">
          <div className="font-bold text-blue-900 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            3. ML Forecast Horizon (2026+)
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            LightGBM quantile regression ($P10, P50, P90$) with split-conformal coverage calibration across 6 discrete trading horizons (7, 14, 28, 60, 90, 180 days).
          </p>
        </div>
      </div>
    </div>
  );
}
