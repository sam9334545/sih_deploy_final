import React, { useState } from 'react';
import TopUtilityBar from './components/TopUtilityBar';
import MainHeader from './components/MainHeader';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Primary Pages
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import CharterPlanner from './pages/CharterPlanner';
import FreightForecast from './pages/FreightForecast';
import PortIntelligence from './pages/PortIntelligence';
import VesselOptimizer from './pages/VesselOptimizer';
import StrategySimulator from './pages/StrategySimulator';
import RiskAlerts from './pages/RiskAlerts';

// Secondary / Support Pages
import MarketIntelligence from './pages/MarketIntelligence';
import RouteAnalysis from './pages/RouteAnalysis';
import Methodology from './pages/Methodology';
import AboutProject from './pages/AboutProject';

const VALID_TABS = [
  'home', 'dashboard', 'planner', 'forecast', 'ports', 'vessels', 'simulator',
  'risks', 'market', 'routes', 'methodology', 'about'
];

function getInitialTab() {
  if (typeof window !== 'undefined' && window.location.hash) {
    const raw = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (raw === 'optimizer') return 'planner';
    if (VALID_TABS.includes(raw)) return raw;
  }
  return 'home';
}

export default function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab);

  React.useEffect(() => {
    const handleHash = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleNavigate = (tabId) => {
    let target = tabId;
    if (tabId === 'optimizer') target = 'planner';
    setActiveTab(target);
    if (typeof window !== 'undefined') {
      window.location.hash = `#/${target}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-portalBg text-slate-800 font-sans text-xs antialiased">
      {/* 1. Official Government Header Bar */}
      <TopUtilityBar />

      {/* 2. Main Institutional Brand Header */}
      <MainHeader currentTab={activeTab} onNavigate={handleNavigate} />

      {/* 3. Primary Navigation Bar with Home and 7 Operational Pages */}
      <Navbar currentTab={activeTab} onNavigate={handleNavigate} />

      {/* 4. Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-4 space-y-4" id="main-content">
        {activeTab === 'home' && (
          <Home onNavigate={handleNavigate} />
        )}
        {activeTab === 'dashboard' && (
          <Dashboard onNavigate={handleNavigate} />
        )}
        {(activeTab === 'planner' || activeTab === 'optimizer') && (
          <CharterPlanner onNavigate={handleNavigate} />
        )}
        {activeTab === 'forecast' && (
          <FreightForecast onNavigate={handleNavigate} />
        )}
        {activeTab === 'ports' && (
          <PortIntelligence onNavigate={handleNavigate} />
        )}
        {activeTab === 'vessels' && (
          <VesselOptimizer onNavigate={handleNavigate} />
        )}
        {activeTab === 'simulator' && (
          <StrategySimulator onNavigate={handleNavigate} />
        )}
        {activeTab === 'risks' && (
          <RiskAlerts onNavigate={handleNavigate} />
        )}
        {activeTab === 'market' && (
          <MarketIntelligence onNavigate={handleNavigate} />
        )}
        {activeTab === 'routes' && (
          <RouteAnalysis onNavigate={handleNavigate} />
        )}
        {activeTab === 'methodology' && (
          <Methodology onNavigate={handleNavigate} />
        )}
        {activeTab === 'about' && (
          <AboutProject onNavigate={handleNavigate} />
        )}
      </main>

      {/* 5. Institutional Footer */}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
