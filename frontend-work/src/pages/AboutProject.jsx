import React from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';

export default function AboutProject({ onNavigate }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">SIH26006 — Problem Statement &amp; System Architecture</h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                National Logistics Initiative
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Intelligent Freight Forecasting &amp; Bulk Cargo Procurement Decision Support for India's East Coast maritime corridors.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <ProvenanceBadge type="observed" text="MoPSW Aligned" />
            <ProvenanceBadge type="conformal" text="NLP Compliant" />
          </div>
        </div>
      </div>

      {/* Institutional Mission & Problem Statement */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-govNavy border-b border-slate-100 pb-2 uppercase tracking-wide">
          Sovereign Context &amp; Operational Objective
        </h2>

        <p className="text-xs text-slate-700 leading-relaxed">
          India's steel, thermal power, and manufacturing sectors rely heavily on seaborne imports of critical bulk commodities—predominantly coking coal from Australia and Mozambique, thermal coal from Indonesia and South Africa, and iron ore. These cargoes arrive at major East Coast ports including <strong>Paradip, Visakhapatnam, Dhamra, Haldia, Gangavaram, and Gopalpur</strong>.
        </p>

        <p className="text-xs text-slate-700 leading-relaxed">
          Sovereign and enterprise charterers face extreme market volatility in Baltic dry-bulk freight rates alongside severe physical port constraints (such as Hooghly river draft limits at Haldia or tidal restrictions). Conventional freight price oracles fail because they treat market price as a point prediction rather than an uncertain distribution, and neglect physical berth feasibility.
        </p>

        <div className="bg-blue-50/60 border border-blue-200 rounded p-3 text-xs text-govNavy font-medium">
          <strong>The SIH26006 Mandate: </strong>
          "Forecast the market &rarr; Understand port &amp; vessel constraints &rarr; Simulate chartering strategies &rarr; Deliver an explainable procurement recommendation with transparent data provenance."
        </div>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs space-y-2">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
            <div className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              M
            </div>
            <h3 className="text-xs font-bold text-govNavy">Machine Learning Tier</h3>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Quantile LightGBM models trained on verified Baltic Exchange sub-indices (1,749 sessions, Mendeley CC BY 4.0). Calibrated via Split-Conformal prediction to provide finite-sample valid 90% prediction intervals across 6 discrete horizons (7 to 180 sessions).
          </p>
          <span className="text-[10px] text-govBlueAccent font-mono block">ml-work/models/saved_models/</span>
        </div>

        <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs space-y-2">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
            <div className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              B
            </div>
            <h3 className="text-xs font-bold text-govNavy">Decision Engine Tier</h3>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            FastAPI decision service modeling Admiralty nautical distances, bunker fuel consumption curves, port authority tariffs, and Monte Carlo strategy simulation (Spot vs Consecutive vs Split Fleet vs COA) with explicit risk preferences (&lambda;).
          </p>
          <span className="text-[10px] text-govBlueAccent font-mono block">backend-work/app/routers/</span>
        </div>

        <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs space-y-2">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
            <div className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              U
            </div>
            <h3 className="text-xs font-bold text-govNavy">Government UI Tier</h3>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Institutional government decision-support dashboard styled in accordance with Ministry of Ports, Shipping &amp; Waterways design standards. Built with React 18, Vite, and high-contrast accessible layouts with zero synthetic market claims.
          </p>
          <span className="text-[10px] text-govBlueAccent font-mono block">frontend-work/src/</span>
        </div>
      </div>

      {/* Repository Quick Links */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <h2 className="text-xs font-bold text-govNavy mb-2">Authoritative Specifications &amp; API Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="p-3 border border-slate-200 rounded hover:border-govBlueAccent hover:bg-slate-50 transition flex items-center justify-between"
          >
            <div>
              <strong className="text-govNavy block">Interactive API Docs</strong>
              <span className="text-[10px] text-slate-500">FastAPI Swagger / OpenAPI Spec</span>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <button
            onClick={() => onNavigate('methodology')}
            className="p-3 border border-slate-200 rounded hover:border-govBlueAccent hover:bg-slate-50 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <strong className="text-govNavy block">Legal Provenance Registry</strong>
              <span className="text-[10px] text-slate-500">Mendeley CC BY 4.0 &amp; FRED Series</span>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => onNavigate('ports')}
            className="p-3 border border-slate-200 rounded hover:border-govBlueAccent hover:bg-slate-50 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <strong className="text-govNavy block">Port Constraint Directory</strong>
              <span className="text-[10px] text-slate-500">Major Port Authorities Act 2021</span>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
