import React, { useState } from 'react';
import TopUtilityBar from './components/TopUtilityBar';
import MainHeader from './components/MainHeader';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

import HomePortal from './pages/HomePortal';
import MarketIntelligence from './pages/MarketIntelligence';
import FreightForecast from './pages/FreightForecast';
import RouteAnalysis from './pages/RouteAnalysis';
import CharterOptimizer from './pages/CharterOptimizer';
import PortIntelligence from './pages/PortIntelligence';
import Methodology from './pages/Methodology';
import AboutProject from './pages/AboutProject';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="min-h-screen flex flex-col bg-portalBg text-slate-800 font-sans text-xs antialiased">
      {/* 1. Official Government Top Bar */}
      <TopUtilityBar />

      {/* 2. Main Institutional Brand Header */}
      <MainHeader currentTab={activeTab} onNavigate={setActiveTab} />

      {/* 3. Primary Navigation Bar */}
      <Navbar currentTab={activeTab} onNavigate={setActiveTab} />

      {/* 4. Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-4 space-y-4" id="main-content">
        {activeTab === 'home' && <HomePortal onNavigate={setActiveTab} />}
        {activeTab === 'market' && <MarketIntelligence />}
        {activeTab === 'forecast' && <FreightForecast />}
        {activeTab === 'routes' && <RouteAnalysis />}
        {activeTab === 'optimizer' && <CharterOptimizer />}
        {activeTab === 'ports' && <PortIntelligence />}
        {activeTab === 'methodology' && <Methodology />}
        {activeTab === 'about' && <AboutProject onNavigate={setActiveTab} />}
      </main>

      {/* 5. Institutional Footer */}
      <Footer onNavigate={setActiveTab} />
    </div>
  );
}
