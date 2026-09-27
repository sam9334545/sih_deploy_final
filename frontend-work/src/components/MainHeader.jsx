import React, { useState } from 'react';

export default function MainHeader({ onNavigate, currentTab }) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    const term = searchTerm.toLowerCase();
    if (term.includes('port') || term.includes('paradip') || term.includes('vizag') || term.includes('haldia')) {
      onNavigate('ports');
    } else if (term.includes('vessel') || term.includes('capesize') || term.includes('panamax') || term.includes('supramax')) {
      onNavigate('vessels');
    } else if (term.includes('simulat') || term.includes('monte') || term.includes('twin')) {
      onNavigate('simulator');
    } else if (term.includes('risk') || term.includes('alert')) {
      onNavigate('risks');
    } else if (term.includes('route') || term.includes('voyage') || term.includes('australia')) {
      onNavigate('routes');
    } else if (term.includes('charter') || term.includes('plan') || term.includes('optimi')) {
      onNavigate('planner');
    } else if (term.includes('forecast') || term.includes('bpi') || term.includes('bci') || term.includes('predict')) {
      onNavigate('forecast');
    } else if (term.includes('market') || term.includes('index') || term.includes('baltic') || term.includes('ballast')) {
      onNavigate('market');
    } else if (term.includes('data') || term.includes('provenance') || term.includes('method')) {
      onNavigate('methodology');
    } else {
      onNavigate('dashboard');
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 py-3 px-4 shadow-sm relative z-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Project Identity */}
        <div 
          onClick={() => onNavigate('dashboard')} 
          className="flex items-center space-x-3.5 cursor-pointer select-none"
        >
          {/* Marine Ship's Wheel Institutional Icon */}
          <div className="w-11 h-11 rounded-full bg-govNavy text-white flex items-center justify-center p-2 shadow-inner ring-2 ring-blue-100 flex-shrink-0">
            <svg className="w-full h-full stroke-current" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3.5" />
              <circle cx="12" cy="12" r="8" />
              <line x1="12" x2="12" y1="1" y2="4" />
              <line x1="12" x2="12" y1="20" y2="23" />
              <line x1="1" x2="4" y1="12" y2="12" />
              <line x1="20" x2="23" y1="12" y2="12" />
              <line x1="4.22" x2="6.34" y1="4.22" y2="6.34" />
              <line x1="17.66" x2="19.78" y1="17.66" y2="19.78" />
              <line x1="4.22" x2="6.34" y1="19.78" y2="17.66" />
              <line x1="17.66" x2="19.78" y1="6.34" y2="4.22" />
            </svg>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base sm:text-lg font-extrabold text-govNavy tracking-tight leading-tight uppercase font-serif">
                Charter Intelligence
              </span>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-1.5 py-0.5 rounded text-[10px] tracking-wide border border-blue-200">
                SIH26006
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-none mt-0.5">
              Freight Forecasting &amp; Procurement Decision Support
            </p>
          </div>
        </div>

        {/* Top Tools & Search */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="relative w-56 sm:w-64">
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-[11px] bg-slate-50 border border-slate-300 rounded-md pl-3 pr-8 py-1.5 focus:bg-white focus:outline-none focus:ring-1 focus:ring-govBlueAccent focus:border-govBlueAccent text-slate-700" 
              placeholder="Search ports, routes, models..." 
              type="text"
            />
            <button 
              aria-label="Search" 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-govNavy" 
              type="submit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </form>

          {/* Data Status Indicator Badge */}
          <div 
            onClick={() => onNavigate('methodology')}
            className="bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 flex items-center space-x-1.5 text-[10px] cursor-pointer hover:bg-emerald-100/60 transition"
            title="Click to view full dataset coverage and data provenance"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="leading-none">
              <span className="text-emerald-950 font-bold block">Data Status</span>
              <span className="text-emerald-700 font-medium">Historical Development</span>
            </div>
          </div>

          {/* Utility Links & User Action */}
          <div className="flex items-center space-x-3 border-l border-slate-200 pl-3">
            <button 
              onClick={() => onNavigate('about')}
              className={`text-[11px] font-medium transition ${currentTab === 'about' ? 'text-govNavy font-bold' : 'text-slate-600 hover:text-govNavy'}`}
            >
              About
            </button>
            <button 
              onClick={() => onNavigate('home')}
              aria-label="User Account" 
              className="w-7 h-7 rounded-full bg-slate-100 text-govNavy hover:bg-blue-100 border border-slate-300 flex items-center justify-center transition" 
              type="button"
              title="Official Portal User"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
