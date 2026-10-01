import React, { useState } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Wind, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Sparkles,
  RefreshCw,
  Video,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { useAlerts } from '../context/AlertContext';
import { useLanguage } from '../context/LanguageContext';
import ProvenanceBadge from './ProvenanceBadge';

export default function ActiveAlertsBanner({ onNavigate, compact = false, showControls = true }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';
  const { 
    selectedScenarioKey, 
    setScenario, 
    alerts, 
    alertCount, 
    dismissAlert, 
    resetAlerts,
    scenarios 
  } = useAlerts();

  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);

  const scenarioList = Object.values(scenarios);

  const getCategoryIcon = (category) => {
    if (!category) return AlertTriangle;
    const cat = category.toLowerCase();
    if (cat.includes('weather') || cat.includes('cyclone') || cat.includes('मौसम')) return Wind;
    if (cat.includes('port') || cat.includes('queue') || cat.includes('congestion') || cat.includes('भीड़भाड़')) return Clock;
    if (cat.includes('market') || cat.includes('volatility') || cat.includes('बाजार')) return TrendingUp;
    return AlertTriangle;
  };

  return (
    <div className="space-y-2.5">
      {/* 1. Video Showcase / Scenario Switcher Bar */}
      {showControls && (
        <div className="bg-gradient-to-r from-slate-900 via-govNavy to-blue-950 text-white rounded-lg p-3 shadow-md border border-blue-900/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center flex-shrink-0">
              <Video className="w-4 h-4 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-white tracking-wide uppercase font-serif">
                  {isHi ? 'वीडियो शोकेस एवं निर्णय चेतावनी सिम्युलेटर' : 'Video Showcase & Maritime Alert Simulator'}
                </span>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-mono font-bold px-1.5 py-0.2 rounded">
                  {isHi ? 'लाइव डेमो मोड' : 'LIVE DEMO MODE'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {isHi 
                  ? 'वीडियो रिकॉर्डिंग हेतु तात्कालिक समुद्री संकट एवं अलर्ट परिदृश्य चुनें:' 
                  : 'Select active maritime crisis scenarios to showcase real-time alerts across the dashboard:'}
              </p>
            </div>
          </div>

          {/* Scenario Selector Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {scenarioList.map((sc) => {
              const isSelected = selectedScenarioKey === sc.id;
              const count = sc.alerts.length;
              return (
                <button
                  key={sc.id}
                  onClick={() => {
                    setScenario(sc.id);
                  }}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition flex items-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-sm'
                      : 'bg-white/10 text-slate-200 border-white/20 hover:bg-white/20 hover:text-white'
                  }`}
                  title={isHi ? sc.hiLabel : sc.label}
                >
                  <span className={`w-2 h-2 rounded-full ${count > 0 ? (isSelected ? 'bg-rose-600' : 'bg-rose-400') : 'bg-emerald-400'}`} />
                  <span>
                    {sc.id === 'normal' 
                      ? (isHi ? 'सामान्य (0)' : 'Normal (0)') 
                      : sc.id === 'cyclone'
                      ? (isHi ? 'चक्रवात (3)' : 'Cyclone (3)')
                      : sc.id === 'congestion'
                      ? (isHi ? 'भीड़भाड़ (3)' : 'Congestion (3)')
                      : sc.id === 'volatility'
                      ? (isHi ? 'बाजार झटका (3)' : 'Market Shock (3)')
                      : (isHi ? 'बहु-संकट (5)' : 'Multi-Crisis (5)')}
                  </span>
                </button>
              );
            })}

            {alerts.length < (scenarios[selectedScenarioKey]?.alerts?.length || 0) && (
              <button
                onClick={resetAlerts}
                className="text-[10px] text-slate-300 hover:text-amber-300 underline ml-1 cursor-pointer flex items-center space-x-1"
                title="Restore dismissed alerts"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{isHi ? 'पुनर्स्थापित करें' : 'Reset'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Active Alert Feed Box */}
      {alertCount > 0 ? (
        <div className="bg-white border-2 border-amber-400/80 rounded-lg p-3.5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-amber-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-govNavy uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>
                  {isHi 
                    ? `सक्रिय समुद्री निर्णय चेतावनियां (${alertCount})` 
                    : `Active Maritime Decision Alerts (${alertCount})`}
                </span>
              </h2>
              <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200 uppercase">
                {isHi ? 'तत्काल कार्रवाई अपेक्षित' : 'Action Required'}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[10px]">
              <ProvenanceBadge type="OBSERVED" text={isHi ? 'स्वचालित चेतावनी नियम' : 'Automated Decision Rules'} />
              {onNavigate && (
                <button
                  onClick={() => onNavigate('risks')}
                  className="text-govBlueAccent hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <span>{isHi ? 'जोखिम रजिस्ट्री देखें' : 'View Risk Registry'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Alert Cards List */}
          <div className="space-y-2">
            {alerts.map((alert) => {
              const isHigh = alert.severity === 'high';
              const isMed = alert.severity === 'medium';
              const isExpanded = expandedAlertId === alert.id;
              const CategoryIcon = getCategoryIcon(alert.category);

              return (
                <div
                  key={alert.id}
                  className={`rounded-lg border transition duration-150 p-3 ${
                    isHigh 
                      ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400' 
                      : isMed 
                      ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400' 
                      : 'bg-blue-50/70 border-blue-300 hover:border-blue-400'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="space-y-1 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Severity Pill */}
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white ${
                          isHigh ? 'bg-rose-600' : isMed ? 'bg-amber-600' : 'bg-blue-600'
                        }`}>
                          {isHi ? (isHigh ? 'गंभीर / उच्च' : isMed ? 'मध्यम' : 'सलाह') : alert.severity}
                        </span>

                        {/* Code */}
                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                          {alert.code}
                        </span>

                        {/* Category */}
                        <span className="text-[10px] text-slate-500 font-medium flex items-center space-x-1">
                          <CategoryIcon className="w-3 h-3 text-slate-600" />
                          <span>{isHi ? alert.hiCategory : alert.category}</span>
                        </span>

                        {/* Target Port / Vessel Class */}
                        <span className="text-[10px] text-slate-500 font-mono">
                          · {isHi ? 'लक्ष्य:' : 'Target:'} <strong>{alert.portId}</strong> / <strong>{alert.vesselClass}</strong>
                        </span>

                        <span className="text-[9px] text-slate-400 font-mono">
                          ({alert.timestamp})
                        </span>
                      </div>

                      {/* Alert Headline & Message */}
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {isHi && alert.hiTitle ? alert.hiTitle : alert.title}
                      </h4>
                      <p className="text-[11px] text-slate-700 leading-relaxed">
                        {isHi && alert.hiMessage ? alert.hiMessage : alert.message}
                      </p>
                    </div>

                    {/* Right: Quick Impact & Action CTA */}
                    <div className="flex items-center space-x-2 self-end md:self-center flex-shrink-0 pt-1 md:pt-0">
                      <button
                        onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded border transition cursor-pointer flex items-center space-x-1 ${
                          isExpanded
                            ? 'bg-govNavy text-white border-govNavy'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{isExpanded ? (isHi ? 'विवरण छुपाएं' : 'Hide Details') : (isHi ? 'उपचार प्रोटोकॉल' : 'Mitigation Action')}</span>
                        <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      <button
                        onClick={() => dismissAlert(alert.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                        title={isHi ? 'चेतावनी खारिज करें' : 'Acknowledge alert'}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Operational Mitigation Panel */}
                  {isExpanded && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white/90 p-2.5 rounded-md text-[11px]">
                      <div className="p-2 rounded bg-rose-50/50 border border-rose-200/60">
                        <span className="font-bold text-rose-950 block text-[10px] uppercase tracking-wider mb-0.5">
                          {isHi ? '💰 वित्तीय एवं परिचालन प्रभाव:' : '💰 Financial & Operational Impact:'}
                        </span>
                        <p className="text-rose-900 font-medium">
                          {isHi && alert.hiImpact ? alert.hiImpact : alert.impact}
                        </p>
                      </div>

                      <div className="p-2 rounded bg-blue-50/50 border border-blue-200/60">
                        <span className="font-bold text-govNavy block text-[10px] uppercase tracking-wider mb-0.5">
                          {isHi ? '🛡️ एआई निर्णय इंजन शमन प्रोटोकॉल:' : '🛡️ AI Decision Engine Mitigation Protocol:'}
                        </span>
                        <p className="text-slate-800 font-medium">
                          {isHi && alert.hiMitigation ? alert.hiMitigation : alert.mitigation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Normal / Zero Alerts State */
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-lg p-3 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                {isHi ? 'सक्रिय समुद्री निर्णय चेतावनियां (0) — सामान्य परिचालन स्थिति' : 'Active Maritime Decision Alerts (0) — Normal Operational Status'}
              </span>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                {isHi 
                  ? 'वर्तमान में सभी 6 पूर्वी तट बंदरगाहों पर मौसम, प्रतीक्षा कतार और भाड़ा बाजार दरें सामान्य सीमा के भीतर हैं।'
                  : 'Zero severe operational disruptions detected. Weather, waiting queues, and freight market volatility are within baseline parameters.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setScenario('cyclone')}
            className="text-[10px] font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 px-2.5 py-1 rounded shadow-xs transition flex items-center space-x-1 cursor-pointer self-end sm:self-center"
          >
            <Sparkles className="w-3 h-3" />
            <span>{isHi ? 'डेमो अलर्ट परिदृश्य सक्रिय करें' : 'Simulate Alerts for Video Demo'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
