import React from 'react';
import { Ship, ShieldAlert, LineChart, Compass, Award, Activity } from 'lucide-react';

export default function Header({ activeTab, setActiveTab }) {
  return (
    <header className="border-b border-white/10 bg-[#0A0E1A]/80 backdrop-blur-md sticky top-0 z-50">
      {/* Top Banner: Mandatory Data Mode Banner */}
      <div className="bg-gradient-to-r from-amber-500/15 via-cyan-500/10 to-blue-500/15 border-b border-amber-500/30 px-4 py-1.5 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="font-mono font-bold tracking-wider text-amber-300">
            HISTORICAL DEVELOPMENT MODE
          </span>
          <span className="text-amber-200/70 hidden sm:inline">•</span>
          <span className="text-slate-300">
            Data Coverage: <strong className="text-cyan-300 font-mono">2012-08-01</strong> to <strong className="text-cyan-300 font-mono">2019-07-31</strong> (1,749 Verified Baltic Sessions)
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span className="hidden md:inline text-slate-400">Provenance: Mendeley Data DOI:10.17632/m645w433cx.1</span>
          <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-400/30">
            PATH B AUDITED
          </span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-xl">
            ⚓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white font-['Outfit']">
                SIH26006
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                Phase 6B
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Intelligent Freight Forecasting & East Coast India Charter Optimizer
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <Activity className="w-4 h-4" />
            <span className="hidden md:inline">Market Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`nav-tab ${activeTab === 'forecast' ? 'active' : ''}`}
          >
            <LineChart className="w-4 h-4" />
            <span className="hidden md:inline">Historical Forecast</span>
          </button>

          <button
            onClick={() => setActiveTab('route')}
            className={`nav-tab ${activeTab === 'route' ? 'active' : ''}`}
          >
            <Compass className="w-4 h-4" />
            <span className="hidden md:inline">Route Analysis</span>
          </button>

          <button
            onClick={() => setActiveTab('optimizer')}
            className={`nav-tab ${activeTab === 'optimizer' ? 'active' : ''}`}
          >
            <Ship className="w-4 h-4" />
            <span className="hidden md:inline">Charter Optimizer</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
