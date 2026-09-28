import React from 'react';
import { 
  Compass, 
  TrendingUp, 
  Anchor, 
  Ship, 
  Layers, 
  ShieldAlert, 
  ArrowRight, 
  BarChart2, 
  Navigation, 
  FileText, 
  Info, 
  Globe, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  MapPin,
  Calendar,
  Activity,
  Cpu
} from 'lucide-react';
import bulkCarrierImg from '../assets/bulk_carrier_hero.jpg';

export default function Home({ onNavigate }) {
  // 6 Authoritative Global Origins supported by SIH26006 registry
  const supportedOrigins = [
    {
      code: 'AUHPT',
      name: 'Hay Point',
      country: 'Australia',
      cargos: 'Coking Coal, Thermal Coal',
      primaryVessels: 'Capesize, Panamax',
      region: 'Oceania',
      notes: 'Deepwater offshore terminal, high loading rates',
    },
    {
      code: 'AUGLT',
      name: 'Gladstone',
      country: 'Australia',
      cargos: 'Coking Coal, Thermal Coal',
      primaryVessels: 'Capesize, Panamax',
      region: 'Oceania',
      notes: 'Multi-berth coal export hub, RG Tanna terminal',
    },
    {
      code: 'IDTBA',
      name: 'Taboneo',
      country: 'Indonesia',
      cargos: 'Thermal Coal Only',
      primaryVessels: 'Supramax, Panamax',
      region: 'Southeast Asia',
      notes: 'Offshore anchorage transshipment with floating cranes',
    },
    {
      code: 'ZARBY',
      name: 'Richards Bay',
      country: 'South Africa',
      cargos: 'Coking Coal, Thermal Coal',
      primaryVessels: 'Capesize, Panamax',
      region: 'Africa',
      notes: 'RBCT terminal, major source for Indian power & steel',
    },
    {
      code: 'USHAM',
      name: 'Hampton Roads',
      country: 'United States',
      cargos: 'Coking Coal Only',
      primaryVessels: 'Panamax, Capesize',
      region: 'North America',
      notes: 'East Coast US coal export piers (Lamberts Point / Pier IX)',
    },
    {
      code: 'MZBEW',
      name: 'Beira',
      country: 'Mozambique',
      cargos: 'Coking Coal',
      primaryVessels: 'Handysize',
      region: 'Africa',
      notes: 'Draft-constrained channel (max ~50k DWT), tidal entry',
    },
  ];

  // Core Decision Support Services
  const coreServices = [
    {
      id: 'forecast',
      title: 'Freight Market Forecast',
      subtitle: 'Probabilistic Baltic dry-bulk freight forecasts with uncertainty intervals.',
      desc: 'Ensemble forecasting (Ridge + Damped Momentum + LightGBM v2) across 7, 14, 28, 60, 90, 180 day horizons for BCI, BPI, BSI, and BHSI with split-conformal 80% calibration intervals.',
      icon: TrendingUp,
      cta: 'Open Forecast →',
      badge: 'ML Engine v2',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'planner',
      title: 'Charter Planner',
      subtitle: 'Translate cargo requirements, port constraints and vessel feasibility into charter options.',
      desc: 'End-to-end procurement orchestrator matching quantity, commodity, origin and laycan with vessel capacity, lighterage constraints, and landed cost optimization.',
      icon: Compass,
      cta: 'Plan a Charter →',
      badge: 'Core Workflow',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'ports',
      title: 'Port Intelligence',
      subtitle: 'Explore destination-port constraints and operational feasibility.',
      desc: 'Authoritative terminal constraint registry for 14 reference ports covering channel depths, draft limits, berth dimensions, mechanical handling rates, and waiting telemetry.',
      icon: Anchor,
      cta: 'Explore Ports →',
      badge: '14 Reference Ports',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    {
      id: 'vessels',
      title: 'Vessel Optimizer',
      subtitle: 'Evaluate vessel-class feasibility against cargo and voyage constraints.',
      desc: 'Standard Baltic vessel class specifications (Handysize, Supramax, Panamax, Capesize) with laden/ballast bunker consumption profiles, deadweight ranges, and parcel sizing.',
      icon: Ship,
      cta: 'Evaluate Vessels →',
      badge: 'Baltic Profiles',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      id: 'simulator',
      title: 'Strategy Simulator',
      subtitle: 'Compare charter strategies using Monte Carlo simulation and risk-adjusted economics.',
      desc: 'Simulate Spot vs. COA vs. Time Charter strategies over 200 to 5,000 stochastic draws, computing CVaR-90, expected landed cost, and deadline breach probability under risk aversion.',
      icon: Layers,
      cta: 'Run Simulation →',
      badge: 'Monte Carlo N=5000',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 'risks',
      title: 'Risk & Alerts',
      subtitle: 'Review operational and market risks relevant to procurement decisions.',
      desc: 'Multivariate operational risk scoring covering monsoon weather stoppage climatology, port congestion detention, bunker volatility, and seasonal cyclone factors.',
      icon: ShieldAlert,
      cta: 'View Risks →',
      badge: 'Explainable Risk',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  ];

  // 7-Step Workflow Pipeline
  const workflowSteps = [
    {
      num: '01',
      title: 'Cargo Requirement',
      detail: 'Tonnage, commodity specification & destination laycan arrival window.',
      tab: 'planner',
    },
    {
      num: '02',
      title: 'Freight Forecast',
      detail: 'Baltic forward index projection with conformalized prediction intervals.',
      tab: 'forecast',
    },
    {
      num: '03',
      title: 'Port & Vessel Constraints',
      detail: 'Berth draft, LOA, beam, tidal allowance & handling rate boundaries.',
      tab: 'ports',
    },
    {
      num: '04',
      title: 'Feasible Charter Options',
      detail: 'Class suitability (Handysize, Supramax, Panamax, Capesize) & parcel split.',
      tab: 'vessels',
    },
    {
      num: '05',
      title: 'Monte Carlo Simulation',
      detail: 'Stochastic draws across freight variance, bunker shift & waiting detention.',
      tab: 'simulator',
    },
    {
      num: '06',
      title: 'Risk-Adjusted Economics',
      detail: 'Expected cost, CVaR-90 tail risk, and penalty for arrival delay.',
      tab: 'simulator',
    },
    {
      num: '07',
      title: 'Decision Support',
      detail: 'Authoritative ranking with full explainability & sensitivity analysis.',
      tab: 'planner',
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION                                                          */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200/90 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle decorative maritime background lines */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-slate-50/30 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: System Identity, Headline, & Primary CTAs */}
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-semibold text-govBlueAccent">
              <span className="w-1.5 h-1.5 rounded-full bg-govBlueAccent animate-pulse" />
              <span>SIH26006 · Ministry of Ports, Shipping &amp; Waterways</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-govNavyDark tracking-tight font-serif leading-tight">
              Smarter Charter Decisions for India's Maritime Trade
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Forecast freight markets, evaluate routes and vessel feasibility, and compare charter strategies under uncertainty.
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate('planner')}
                className="px-5 py-2.5 bg-govNavy hover:bg-govNavyDark text-white text-xs font-semibold rounded shadow-sm hover:shadow transition flex items-center space-x-2 cursor-pointer"
              >
                <span>Start Charter Planning</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('forecast')}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-govNavy border border-slate-300 hover:border-govNavy text-xs font-semibold rounded transition flex items-center space-x-2 cursor-pointer shadow-2xs"
              >
                <TrendingUp className="w-4 h-4 text-govBlueAccent" />
                <span>Explore Freight Forecast</span>
              </button>

              <button
                onClick={() => onNavigate('market')}
                className="px-3.5 py-2.5 text-slate-600 hover:text-govNavy text-xs font-medium hover:underline transition flex items-center space-x-1.5 cursor-pointer"
              >
                <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                <span>View Market Intelligence</span>
              </button>
            </div>

            {/* Feature highlights pill strip */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-y-2 gap-x-4 text-[11px] text-slate-500">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>14 Reference Ports</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>6 Global Corridors</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>LightGBM v2 ML Forecast</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Conformal 80% Bounds</span>
              </div>
            </div>
          </div>

          {/* Right Column: Institutional Maritime Trade Visual Card */}
          <div className="lg:col-span-6">
            <div className="bg-gradient-to-b from-slate-50 to-blue-50/50 rounded-lg border border-slate-200/90 shadow-sm p-4 space-y-3">
              {/* Institutional Card Header */}
              <div className="border-b border-slate-200 pb-2.5 flex items-start justify-between">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Government of India · Ministry of Ports, Shipping &amp; Waterways
                  </div>
                  <div className="text-xs font-bold text-govNavy uppercase tracking-wide flex items-center space-x-1.5 mt-0.5">
                    <Anchor className="w-3.5 h-3.5 text-govBlueAccent" />
                    <span>East Coast Maritime Trade Logistics</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Dry Bulk Shipping Network &amp; Port Connectivity — Bay of Bengal Corridor
                  </div>
                </div>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-blue-100/80 text-govNavy font-mono text-[9px] rounded font-bold uppercase tracking-wider">
                  Operational Hub
                </span>
              </div>

              {/* Visual Split: Bulk Carrier Photography + SVG Maritime Map Overlay */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
                {/* Bulk Carrier Image */}
                <div className="sm:col-span-7 relative rounded border border-slate-200 overflow-hidden shadow-2xs group min-h-[170px]">
                  <img 
                    src={bulkCarrierImg} 
                    alt="Commercial dry bulk carrier ship laden with mineral cargo sailing in ocean waters" 
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 text-white">
                    <span className="px-1.5 py-0.5 bg-blue-600/90 text-[9px] font-semibold uppercase tracking-wider rounded">
                      Commercial Bulk Logistics
                    </span>
                    <p className="text-[10px] font-medium text-slate-100 mt-1 leading-tight">
                      Capesize &amp; Panamax Dry-Bulk Fleet Optimization
                    </p>
                  </div>
                </div>

                {/* East Coast India Bay of Bengal Map Inset */}
                <div className="sm:col-span-5 bg-govNavyDark rounded border border-slate-800 p-2.5 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="flex items-center justify-between text-[10px] border-b border-slate-800 pb-1.5 z-10">
                    <span className="font-semibold text-cyan-300 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>East Coast Nodes</span>
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">86°E · 20°N</span>
                  </div>

                  {/* Stylized SVG Map of East Coast India & Bay of Bengal Sea Lanes */}
                  <div className="relative h-28 w-full my-1">
                    <svg viewBox="0 0 200 130" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      {/* Ocean background */}
                      <rect width="200" height="130" fill="#041226" />
                      
                      {/* Stylized Indian Coastline Path (East Coast) */}
                      <path 
                        d="M 20 0 Q 35 30, 45 60 Q 60 90, 80 130 L 0 130 L 0 0 Z" 
                        fill="#0c2340" 
                        stroke="#1a3a60" 
                        strokeWidth="1"
                      />

                      {/* Shipping Sea Lanes converging into East Coast */}
                      {/* Lane 1: From Australia (Southeast) */}
                      <path 
                        d="M 195 120 Q 140 85, 58 55" 
                        fill="none" 
                        stroke="#06b6d4" 
                        strokeWidth="1.2" 
                        strokeDasharray="3 2"
                        opacity="0.85"
                      />
                      {/* Lane 2: From Indonesia / Malacca Strait (East) */}
                      <path 
                        d="M 195 75 Q 120 60, 52 42" 
                        fill="none" 
                        stroke="#38bdf8" 
                        strokeWidth="1.2" 
                        strokeDasharray="3 2"
                        opacity="0.85"
                      />
                      {/* Lane 3: From South Africa / Mozambique (South) */}
                      <path 
                        d="M 130 130 Q 90 95, 48 70" 
                        fill="none" 
                        stroke="#60a5fa" 
                        strokeWidth="1.2" 
                        strokeDasharray="3 2"
                        opacity="0.85"
                      />

                      {/* Port Terminal Nodes */}
                      {/* Haldia / Sandheads */}
                      <circle cx="58" cy="28" r="2.8" fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />
                      <text x="63" y="30" fill="#fde68a" fontSize="6.5" fontWeight="bold">Haldia</text>

                      {/* Dhamra */}
                      <circle cx="54" cy="42" r="2.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.8" />
                      <text x="60" y="44" fill="#bae6fd" fontSize="6">Dhamra</text>

                      {/* Paradip */}
                      <circle cx="50" cy="55" r="3.5" fill="#22c55e" stroke="#14532d" strokeWidth="1" />
                      <text x="56" y="57" fill="#86efac" fontSize="7" fontWeight="bold">Paradip</text>

                      {/* Gopalpur */}
                      <circle cx="45" cy="70" r="2.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.8" />
                      <text x="51" y="72" fill="#bae6fd" fontSize="6">Gopalpur</text>

                      {/* Visakhapatnam */}
                      <circle cx="40" cy="88" r="3.2" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.8" />
                      <text x="46" y="90" fill="#93c5fd" fontSize="6.5" fontWeight="bold">Vizag</text>

                      {/* Bay of Bengal Label */}
                      <text x="110" y="45" fill="#334e68" fontSize="8" fontStyle="italic" letterSpacing="1">
                        BAY OF BENGAL
                      </text>
                    </svg>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-300">
                    <span className="text-amber-300 font-semibold">Corridor: Bay of Bengal</span>
                    <span className="text-slate-400">Deepwater Discharge</span>
                  </div>
                </div>
              </div>

              {/* Status footer pill */}
              <div className="bg-white rounded border border-slate-200 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-medium text-govNavy">
                  Terminal Constraints Active: <strong>Paradip · Vizag · Dhamra · Haldia · Gopalpur</strong>
                </span>
                <button
                  onClick={() => onNavigate('ports')}
                  className="text-govBlueAccent hover:underline font-semibold text-[10px] flex items-center space-x-1 cursor-pointer"
                >
                  <span>Constraint Radar</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. DATA / PROVENANCE STATUS STRIP                                        */}
      {/* ========================================================================= */}
      <section className="bg-bannerBg border border-bannerBorder rounded-lg p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="p-1 bg-blue-100 rounded text-govNavy mt-0.5 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-govBlueAccent" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-govNavyDark">
                Important Notice: Data Status &amp; Lineage
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-govNavy font-semibold text-[10px] rounded border border-blue-200">
                OBSERVED THROUGH 31 JULY 2019
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-semibold text-[10px] rounded border border-amber-300">
                2020–2026: SYNTHETIC EXTENSION
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-normal">
              Historical market observations are available through <strong>31 July 2019</strong> (1,749 verified Baltic trading sessions under CC-BY 4.0). Post-2019 forecasting uses an explicitly identified synthetic extension until authorized observations are integrated. Pre-berthing waiting queues represent simulated demo telemetry.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('methodology')}
          className="self-end md:self-center px-3 py-1.5 bg-white hover:bg-slate-50 text-govBlueAccent border border-blue-200 hover:border-govNavy text-[11px] font-semibold rounded whitespace-nowrap transition cursor-pointer flex items-center space-x-1 flex-shrink-0"
        >
          <span>View Data Methodology</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* ========================================================================= */}
      {/* 3. PLATFORM INTRODUCTION                                                 */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-7 space-y-4">
        <div className="max-w-3xl space-y-2">
          <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
            Architecture &amp; Methodology
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
            Decision Support for the Complete Chartering Workflow
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            SIH26006 is not a freight price oracle. It is a constrained maritime decision engine designed to support public and private procurement teams chartering dry-bulk carriers into India's East Coast ports. The system treats freight forecasts as an uncertain input, rigorously evaluating physical berth constraints, voyage economics, and tail risk.
          </p>
        </div>

        {/* 3 Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-govNavy flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-govBlueAccent" />
            </div>
            <h3 className="text-xs font-bold text-govNavyDark">1. Uncertainty-Aware Forecasts</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Baltic dry-bulk indices (BCI, BPI, BSI, BHSI) projected across 7 to 180 days with split-conformal 80% prediction intervals, replacing dangerous single-point estimates.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2">
            <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-emerald-700" />
            </div>
            <h3 className="text-xs font-bold text-govNavyDark">2. Physical Terminal Feasibility</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Authoritative port constraints: channel depths, maximum permissible drafts, LOA, beam restrictions, tide allowance, and Sandheads lighterage requirements at Haldia.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2">
            <div className="w-8 h-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-700" />
            </div>
            <h3 className="text-xs font-bold text-govNavyDark">3. Stochastic Tail-Risk Simulation</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Monte Carlo simulation under 200–5,000 draws comparing Spot vs. COA vs. Time Charter strategies, quantifying CVaR-90 extreme exposure and deadline miss penalties.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CORE CAPABILITIES (DECISION SUPPORT SERVICES)                         */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
              Primary Capabilities
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
              Decision Support Services
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select any capability to launch the specialized operational workspace.
            </p>
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-xs font-semibold text-govNavy hover:text-govBlueAccent flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Open Executive Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6 Capabilities Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coreServices.map((card) => {
            const Icon = card.icon;
            return (
              <div 
                key={card.id}
                className="bg-white rounded-lg border border-slate-200/90 shadow-2xs hover:shadow-md transition p-5 flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-md bg-blue-50 text-govNavy flex items-center justify-center group-hover:bg-govNavy group-hover:text-white transition-colors duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-govNavyDark group-hover:text-govBlueAccent transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">
                      {card.subtitle}
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => onNavigate(card.id)}
                    className="text-xs font-semibold text-govNavy group-hover:text-govBlueAccent flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>{card.cta}</span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono">
                    /{card.id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. END-TO-END WORKFLOW SECTION                                           */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-7 space-y-5">
        <div className="max-w-3xl space-y-1">
          <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
            Sequential Decision Pipeline
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
            From Cargo Requirement to Charter Decision
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            The decision engine processes your charter requirement through seven transparent, reproducible stages:
          </p>
        </div>

        {/* 7 Workflow Cards in Horizontal Flex / Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {workflowSteps.map((step, idx) => (
            <div 
              key={step.num}
              onClick={() => onNavigate(step.tab)}
              className="bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded p-3 flex flex-col justify-between space-y-2 transition cursor-pointer group shadow-2xs"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-govBlueAccent">
                  STAGE {step.num}
                </span>
                <h4 className="text-xs font-bold text-govNavyDark mt-1 group-hover:text-govBlueAccent transition-colors">
                  {step.title}
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  {step.detail}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-govNavy font-medium">
                <span>Inspect</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. MARITIME TRADE NETWORK (OVERSEAS ORIGINS -> INDIA EAST COAST)          */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
              International Corridors
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
              Global Bulk-Cargo Origins → East Coast India
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Authoritative loading hubs parameterized in the reference registry feeding Indian industrial steel and thermal power clusters.
            </p>
          </div>
          <button
            onClick={() => onNavigate('routes')}
            className="text-xs font-semibold text-govNavy hover:text-govBlueAccent flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
          >
            <span>Explore All Routes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6 Origins Table / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {supportedOrigins.map((orig) => (
            <div 
              key={orig.code}
              className="bg-slate-50/70 border border-slate-200/90 rounded-md p-3.5 space-y-2 hover:bg-white hover:border-slate-300 transition shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center text-[10px] font-bold font-mono">
                    {orig.code.slice(0, 2)}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-govNavyDark">
                      {orig.name}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {orig.country} ({orig.region})
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-govBlueAccent bg-white px-2 py-0.5 rounded border border-slate-200">
                  {orig.code}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                <div className="flex justify-between">
                  <span className="text-slate-500">Commodity:</span>
                  <span className="font-medium text-slate-800">{orig.cargos}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Typical Vessels:</span>
                  <span className="font-medium text-slate-800">{orig.primaryVessels}</span>
                </div>
                <div className="text-[10px] text-slate-500 italic pt-0.5">
                  {orig.notes}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">Target Discharges:</span>
                <span className="text-[10px] font-semibold text-govNavy">Paradip · Vizag · Dhamra</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. SUPPORTING FEATURES & ANALYTICS                                       */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="border-b border-slate-200 pb-2">
          <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
            Supporting Modules
          </span>
          <h3 className="text-base sm:text-lg font-bold text-govNavyDark font-serif">
            Market Intelligence, Corridors &amp; Transparency
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div 
            onClick={() => onNavigate('market')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <BarChart2 className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              Market Intelligence
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Baltic macro indices, supply-demand regimes, and Indian Ocean ballast vessel positioning.
            </p>
          </div>

          <div 
            onClick={() => onNavigate('routes')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <Navigation className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              Route Voyage Analysis
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Nautical distances, bunker fuel consumption, canal transit fees, and round-voyage economics.
            </p>
          </div>

          <div 
            onClick={() => onNavigate('methodology')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <FileText className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              Data &amp; Methodology
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Complete data provenance, verified data cutoffs, mathematical definitions, and assumption catalog.
            </p>
          </div>

          <div 
            onClick={() => onNavigate('about')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <Info className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              About Project
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              SIH26006 problem statement context, technical specifications, and system architectural principles.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FINAL CALL TO ACTION (CTA)                                            */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-r from-govNavyDark via-govNavy to-govNavyLight text-white rounded-lg p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl text-center md:text-left">
          <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">
            Institutional Decision Engine · SIH26006
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-serif">
            Ready to evaluate a charter?
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            Start with your cargo requirement, then move through freight forecasts, operational constraints and strategy simulation.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 flex-shrink-0">
          <button
            onClick={() => onNavigate('planner')}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded shadow transition flex items-center space-x-2 cursor-pointer"
          >
            <span>Open Charter Planner</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-semibold rounded transition cursor-pointer"
          >
            <span>Executive Dashboard</span>
          </button>
        </div>
      </section>
    </div>
  );
}
