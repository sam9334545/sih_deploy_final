import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Compass, 
  TrendingUp, 
  Anchor, 
  Ship, 
  Layers, 
  ShieldAlert, 
  ChevronDown,
  BarChart2,
  Navigation,
  FileText,
  Info
} from 'lucide-react';

export default function Navbar({ currentTab, onNavigate }) {
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const primaryItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'Charter Planner', icon: Compass },
    { id: 'forecast', label: 'Freight Forecast', icon: TrendingUp },
    { id: 'ports', label: 'Port Intelligence', icon: Anchor },
    { id: 'vessels', label: 'Vessel Optimizer', icon: Ship },
    { id: 'simulator', label: 'Strategy Simulator', icon: Layers },
    { id: 'risks', label: 'Risk & Alerts', icon: ShieldAlert },
  ];

  const secondaryItems = [
    { id: 'market', label: 'Market Intelligence & Positioning', icon: BarChart2 },
    { id: 'routes', label: 'Route Voyage Analysis', icon: Navigation },
    { id: 'methodology', label: 'Data Provenance & Methodology', icon: FileText },
    { id: 'about', label: 'About System', icon: Info },
  ];

  const isSecondaryActive = secondaryItems.some(item => item.id === currentTab);

  return (
    <nav aria-label="Primary Navigation" className="bg-govNavy text-white shadow-md relative z-30 select-none">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between overflow-x-auto text-[11px] font-medium custom-scrollbar whitespace-nowrap">
        {/* Primary 7 Operational Pages */}
        <div className="flex items-center space-x-0.5">
          {primaryItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setSecondaryOpen(false);
                  onNavigate(item.id);
                }}
                className={`px-3 py-2.5 transition flex items-center space-x-1.5 border-b-2 text-left cursor-pointer ${
                  isActive
                    ? 'bg-govActiveNav text-white font-semibold border-amber-400 shadow-inner'
                    : 'text-slate-200 hover:text-white hover:bg-govNavyLight border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-slate-300'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Secondary / Supporting Intelligence Dropdown */}
        <div className="relative">
          <button
            onClick={() => setSecondaryOpen(!secondaryOpen)}
            className={`px-3 py-2.5 transition flex items-center space-x-1 border-b-2 text-left cursor-pointer ${
              isSecondaryActive
                ? 'bg-govActiveNav text-white font-semibold border-amber-400'
                : 'text-slate-200 hover:text-white hover:bg-govNavyLight border-transparent'
            }`}
          >
            <span>Analytics &amp; Support</span>
            <ChevronDown className={`w-3 h-3 text-slate-300 transition-transform ${secondaryOpen ? 'rotate-180' : ''}`} />
          </button>

          {secondaryOpen && (
            <div className="absolute right-0 top-full mt-0.5 w-64 bg-white text-slate-800 rounded-b-md shadow-xl border border-slate-200 py-1.5 z-50">
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                Secondary Analytics Surfaces
              </div>
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSecondaryOpen(false);
                      onNavigate(item.id);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center space-x-2 text-xs transition cursor-pointer ${
                      isActive ? 'bg-blue-50 text-govNavy font-bold' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-govBlueAccent" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
