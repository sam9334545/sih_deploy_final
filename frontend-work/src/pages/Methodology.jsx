import React from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';

export default function Methodology() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">Data Provenance, Econometrics &amp; Methodology</h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                Statutory Compliance
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Transparent mathematical formulation, data lineage auditing, and legal redistribution compliance.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <ProvenanceBadge type="observed" text="Category A Verified" />
            <ProvenanceBadge type="conformal" text="Conformal 90%" />
          </div>
        </div>
      </div>

      {/* Notice on Current Data Status (Section 19) */}
      <div className="bg-bannerBg border border-bannerBorder rounded p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="text-govBlueAccent mt-0.5 flex-shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" fillRule="evenodd" />
            </svg>
          </div>
          <div className="text-[11px] leading-relaxed">
            <strong className="text-govNavy font-bold block text-xs">
              Current Market Data Status: Historical Development Mode Active
            </strong>
            <p className="text-slate-700 mt-0.5">
              Current-market forecasting is temporarily disabled because the verified Baltic Exchange historical observation record ends on <strong>31 July 2019</strong>. To preserve total mathematical integrity and prevent fabricated values, live forecasts require authorized post-2019 Baltic Exchange feed credentials. The post-2019 validation and ingestion framework is implemented and standing by in <code className="font-mono bg-white px-1 py-0.5 rounded border border-blue-200">ml-work/pipeline/validate_extended_data.py</code>.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-govBlueAccent bg-white px-2 py-1 rounded border border-blue-200 whitespace-nowrap">
          Readiness Phase 7B Ready
        </span>
      </div>

      {/* Grid: 3 Methodology Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pillar 1: Baltic Market Data */}
        <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h2 className="text-xs font-bold text-govNavy">Baltic Sub-Index Targets</h2>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Dataset Identification</span>
              <strong className="text-slate-800 font-mono">baltic dry index freight rates47</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Primary Investigator / Academic Source</span>
              <span className="text-slate-700">Dr. Bangar Raju (UPES Dehradun, Elsevier Mendeley Data)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Verified Temporal Window</span>
              <span className="font-mono font-bold text-govNavy">2012-08-01 – 2019-07-31</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Audited Coverage</span>
              <span className="text-slate-700">1,749 verified daily trading sessions (0 missing, 0 nulls)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Open License</span>
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                CC BY 4.0 (Creative Commons Attribution)
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 2: FRED Macro Indicators */}
        <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h2 className="text-xs font-bold text-govNavy">Macroeconomic Reanalysis</h2>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Data Provider</span>
              <strong className="text-slate-800">Federal Reserve Bank of St. Louis (FRED) / IMF</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Brent Crude Oil (Daily Bunker Proxy)</span>
              <span className="font-mono text-slate-700">DCOILBRENTEU (1987–2026, 9,563 rows)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">USD / INR Exchange Rate (Daily FX)</span>
              <span className="font-mono text-slate-700">DEXINUS (1973–2026, 14,009 rows)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Global Coal &amp; Iron Ore (IMF Benchmarks)</span>
              <span className="font-mono text-slate-700">PCOALAUUSDM &amp; PIORECRUSDM (1992–2026)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Legal Terms</span>
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                U.S. Government Work / Open IMF Data
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Quantile LightGBM & Conformal Prediction */}
        <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h2 className="text-xs font-bold text-govNavy">Model Architecture &amp; Calibration</h2>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">Core Forecaster</span>
              <strong className="text-govNavy">Quantile Gradient Boosted Trees (LightGBM)</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Quantile Objectives</span>
              <span className="font-mono text-slate-700">Pinball Loss @ α ∈ &#123;0.10, 0.50, 0.90&#125;</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Finite-Sample Coverage Guarantee</span>
              <strong className="text-slate-800">Split Conformal Prediction (Vovk et al.)</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Discrete Forecast Horizons</span>
              <span className="font-mono text-slate-700">h ∈ &#123;7, 14, 28, 60, 90, 180&#125; trading sessions</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Model Artifacts Serialized</span>
              <span className="font-mono text-slate-700">72 joblib models in ml-work/models/saved_models/</span>
            </div>
          </div>
        </div>
      </div>

      {/* Provenance Classification Matrix (Section 18) */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-govNavy border-b border-slate-100 pb-2 uppercase tracking-wide">
          Official Provenance &amp; Reliability Tagging Standard
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse gov-table">
            <thead>
              <tr>
                <th>Classification Tag</th>
                <th>Definition</th>
                <th>Example Use in SIH26006</th>
                <th>Authoritative Verification Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              <tr>
                <td>
                  <ProvenanceBadge type="observed" text="Observed" />
                </td>
                <td className="text-slate-700">Official published historical record with verified data lineage.</td>
                <td className="font-mono text-slate-800">Mendeley Baltic Sub-Indices, FRED Brent Crude</td>
                <td className="text-slate-600">SHA256 checksum audit &amp; .metadata.json sidecars</td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="model" text="Model Output" />
                </td>
                <td className="text-slate-700">Deterministic algorithmic forecast produced by pre-trained ML model.</td>
                <td className="font-mono text-slate-800">Quantile LightGBM P50 freight forecast</td>
                <td className="text-slate-600">Walk-forward cross validation &amp; pinball loss audit</td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="conformal" text="Conformal Calibrated" />
                </td>
                <td className="text-slate-700">Statistically calibrated prediction interval satisfying 90% coverage.</td>
                <td className="font-mono text-slate-800">P10 – P90 prediction interval expansion via Q̂</td>
                <td className="text-slate-600">Split-conformal empirical residual calibration</td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="derived" text="Derived" />
                </td>
                <td className="text-slate-700">Reconstructed value from physical, geographic, or accounting formulas.</td>
                <td className="font-mono text-slate-800">Route freight $/tonne, sea transit days, bunker cost</td>
                <td className="text-slate-600">Admiralty nautical distance × vessel engine consumption</td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="assumed" text="Assumed / Demo" />
                </td>
                <td className="text-slate-700">Calibrated benchmark or expert-curated fixture for software integration.</td>
                <td className="font-mono text-slate-800">Ornstein-Uhlenbeck demo series, private terminal tariffs</td>
                <td className="text-slate-600">Clearly tagged to distinguish from observed market data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
