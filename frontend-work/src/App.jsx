import React, { useState } from 'react';
import TopUtilityBar from './components/TopUtilityBar';
import MainHeader from './components/MainHeader';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Primary 7 Pages
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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleNavigate = (tabId) => {
    // Normalise legacy or alias tab IDs
    if (tabId === 'home') setActiveTab('dashboard');
    else if (tabId === 'optimizer') setActiveTab('planner');
    else setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-portalBg text-slate-800 font-sans text-xs antialiased">
      {/* 1. Official Government Header Bar */}
      <TopUtilityBar />

      {/* 2. Main Institutional Brand Header */}
      <MainHeader currentTab={activeTab} onNavigate={handleNavigate} />

      {/* 3. Primary Navigation Bar with 7 Primary Pages */}
      <Navbar currentTab={activeTab} onNavigate={handleNavigate} />

      {/* 4. Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-4 space-y-4" id="main-content">
        {(activeTab === 'dashboard' || activeTab === 'home') && (
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
