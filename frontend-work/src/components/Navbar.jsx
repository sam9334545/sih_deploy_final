import React from 'react';

export default function Navbar({ currentTab, onNavigate }) {
  const navItems = [
    { id: 'home', label: 'Home', isHome: true },
    { id: 'market', label: 'Market Intelligence' },
    { id: 'forecast', label: 'Freight Forecast' },
    { id: 'routes', label: 'Route Analysis' },
    { id: 'optimizer', label: 'Charter Optimizer' },
    { id: 'ports', label: 'Port Intelligence' },
    { id: 'methodology', label: 'Data & Methodology' },
    { id: 'about', label: 'About Project' },
  ];

  return (
    <nav aria-label="Primary Navigation" className="bg-govNavy text-white shadow-md relative z-10 select-none">
      <div className="max-w-7xl mx-auto px-4 flex items-center space-x-0.5 overflow-x-auto text-[11px] font-medium custom-scrollbar whitespace-nowrap">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-3.5 py-2.5 transition flex items-center space-x-1 border-b-2 text-left cursor-pointer ${
                isActive
                  ? 'bg-govActiveNav text-white font-semibold border-amber-400'
                  : 'text-slate-200 hover:text-white hover:bg-govNavyLight border-transparent'
              }`}
            >
              {item.isHome && (
                <svg className="w-3.5 h-3.5 mr-1 text-slate-200" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              )}
              <span>{item.label}</span>
              {!item.isHome && item.id !== 'about' && (
                <svg className="w-2.5 h-2.5 text-slate-300 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
