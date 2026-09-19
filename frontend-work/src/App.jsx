import React, { useState } from 'react';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import HistoricalForecast from './pages/HistoricalForecast';
import RouteAnalysis from './pages/RouteAnalysis';
import CharterOptimizer from './pages/CharterOptimizer';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedVessel, setSelectedVessel] = useState('Panamax');
  const [currentForecast, setCurrentForecast] = useState(null);
  const [currentRouteEstimate, setCurrentRouteEstimate] = useState(null);

  const handleSelectForecastFromDashboard = (vesselClass) => {
    setSelectedVessel(vesselClass);
    setActiveTab('forecast');
  };

  const handleNavigateToRouteFromForecast = (vessel, forecast) => {
    setSelectedVessel(vessel);
    setCurrentForecast(forecast);
    setActiveTab('route');
  };

  const handleProceedToOptimizerFromRoute = (estimate) => {
    setCurrentRouteEstimate(estimate);
    setActiveTab('optimizer');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070B14] text-slate-100">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <Dashboard onSelectForecast={handleSelectForecastFromDashboard} />
        )}

        {activeTab === 'forecast' && (
          <HistoricalForecast
            initialVessel={selectedVessel}
            onNavigateToRoute={handleNavigateToRouteFromForecast}
          />
        )}

        {activeTab === 'route' && (
          <RouteAnalysis
            initialVessel={selectedVessel}
            onProceedToOptimizer={handleProceedToOptimizerFromRoute}
          />
        )}

        {activeTab === 'optimizer' && (
          <CharterOptimizer preloadedEstimate={currentRouteEstimate} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950/60 py-6 text-xs text-slate-500 text-center font-mono">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <div>
            SIH26006 • Intelligent Freight Forecasting for Optimized Vessel Chartering & Bulk Procurement
          </div>
          <div>
            Phase 6B Verified Historical Integration • Mendeley Data (2012–2019) • 72 Quantile LightGBM Models
          </div>
        </div>
      </footer>
    </div>
  );
}
