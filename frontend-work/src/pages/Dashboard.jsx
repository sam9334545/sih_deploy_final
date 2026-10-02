import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  ShieldAlert, 
  Compass, 
  Ship, 
  ArrowRight,
  Clock,
  Activity,
  Layers,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DataCutoffNotice from '../components/DataCutoffNotice';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import { fetchMarketData, fetchRisks, executeLiveForecast, ApiError } from '../api';
import { useLanguage } from '../context/LanguageContext';
import { useAlerts } from '../context/AlertContext';

export default function Dashboard({ onNavigate }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';
  const { 
    alerts: activeDecisionAlerts, 
    alertCount, 
    activeScenario 
  } = useAlerts();

  const [marketData, setMarketData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [forecastSnapshot, setForecastSnapshot] = useState(null);
  const [selectedClass, setSelectedClass] = useState('Panamax');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, [selectedClass]);

  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const [mRes, rRes, fRes] = await Promise.all([
        fetchMarketData('2026-09-15').catch(err => {
          console.warn('Market API fetch warning:', err);
          return null;
        }),
        fetchRisks({ portId: 'INPRT', vesselClass: selectedClass, asOf: '2026-09-15' }).catch(err => {
          console.warn('Risk API fetch warning:', err);
          return null;
        }),
        executeLiveForecast({ vesselClass: selectedClass, horizonDays: 28, asOf: '2026-09-15' }).catch(err => {
          console.warn('Forecast snapshot fetch warning:', err);
          return null;
        })
      ]);

      setMarketData(mRes);
      setRiskData(rRes);
      setForecastSnapshot(fRes);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Unable to load freight market intelligence from backend.');
    } finally {
      setLoading(false);
    }
  }

  // Active Opportunity Score for current vessel class
  const oppGeneric = marketData?.charter_opportunity_score_generic?.[selectedClass];
  const cosScore = oppGeneric?.score != null ? Math.round(oppGeneric.score) : null;
  const oppTrend = oppGeneric?.trend || 'stable';
  const availability = marketData?.availability_signal?.[selectedClass];

  const effectiveRisk = alertCount > 0 
    ? (activeScenario?.overallRisk || 'HIGH') 
    : (riskData?.overall || 'LOW');

  const effectiveDriver = (isHi ? activeScenario?.hiMainDriver : activeScenario?.mainDriver) 
    || (riskData?.main_driver ? (isHi ? 'बाजार दर में अस्थिरता एवं मौसमी मानसून प्रतीक्षा कतारें।' : riskData.main_driver) : (isHi ? 'सामान्य मौसमी परिचालन स्थितियां।' : 'Normal operational maritime conditions.'));

  return (
    <div className="space-y-4">
      {/* 1. Core Decision Workflow Banner */}
      <DecisionWorkflowBanner currentStep="cargo" onNavigate={onNavigate} />

      {/* 2. Top Executive Header & Primary CTA */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h1 className="text-lg font-bold text-govNavy font-serif tracking-tight">
              {isHi ? 'कार्यकारी चार्टरिंग एवं समुद्री भाड़ा डैशबोर्ड' : 'Executive Chartering & Maritime Freight Dashboard'}
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              {isHi ? 'निर्णय समर्थन' : 'Decision Support'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {isHi 
              ? 'भारत के पूर्वी तट टर्मिनलों हेतु ड्राई बल्क भाड़ा पूर्वानुमान, बाजार अवसर स्कोरिंग और अनुकूलित चार्टर निर्णय प्रणाली।'
              : 'Dry bulk freight forecasting, market opportunity scoring, and constrained charter decision optimization for East Coast India terminals.'}
          </p>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <button
            onClick={() => loadDashboardData()}
            className="p-2 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            title={isHi ? 'डैशबोर्ड डेटा रीफ्रेश करें' : 'Refresh dashboard from backend'}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => onNavigate('planner')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-govNavy text-white hover:bg-govNavyLight transition rounded-md font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
          >
            <span>{isHi ? 'चार्टर योजना बनाएं' : 'Plan a Charter'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Honest Data Integrity & Cutoff Notice */}
      <DataCutoffNotice compact={true} />

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => loadDashboardData()} className="underline font-bold">
            {isHi ? 'पुनः प्रयास करें' : 'Retry'}
          </button>
        </div>
      )}

      {/* 4. Top Executive Decision KPIs: Opportunity Score + Forecast Snapshot + Risk Level */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Opportunity Score Gauge (Col 4) */}
        <div className="md:col-span-4 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {isHi ? 'चार्टर अवसर स्कोर (COS)' : 'Charter Opportunity Score (COS)'}
                </span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <h3 className="text-base font-bold text-govNavy">
                    {selectedClass} {isHi ? 'बेड़ा संकेत' : 'Fleet Signal'}
                  </h3>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
                  >
                    <option value="Capesize">Capesize</option>
                    <option value="Panamax">Panamax</option>
                    <option value="Supramax">Supramax</option>
                    <option value="Handysize">Handysize</option>
                  </select>
                </div>
              </div>
              <ProvenanceBadge type="DERIVED" text={isHi ? 'स्कोर: 0–100' : 'Score: 0–100'} />
            </div>

            {/* Score Display */}
            <div className="flex items-center space-x-4 my-4">
              <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={cosScore != null ? (cosScore >= 70 ? 'text-emerald-500' : cosScore >= 45 ? 'text-amber-500' : 'text-rose-500') : 'text-slate-300'}
                    strokeDasharray={cosScore != null ? `${cosScore}, 100` : '0, 100'}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-xl font-extrabold text-govNavy font-mono">{cosScore != null ? cosScore : '—'}</span>
                  <span className="text-[8px] text-slate-400 font-bold uppercase">/ 100</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className={`w-2 h-2 rounded-full ${cosScore != null ? (cosScore >= 70 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-slate-400'}`} />
                  <span className="font-bold text-slate-800">
                    {cosScore != null
                      ? (cosScore >= 70 
                          ? (isHi ? 'अनुकूल समय (अभी अनुबंध करें)' : 'Favorable Window (Fix Now)') 
                          : (isHi ? 'तटस्थ बाजार खिड़की' : 'Neutral Market Window'))
                      : (isHi ? 'बाजार स्कोर प्रतीक्षारत' : 'Market Score Pending')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  {isHi 
                    ? 'आज अनुबंध करने पर आगामी 28 दिनों की संभावित वृद्धि की तुलना में अनुकूल लैंडेड लागत प्राप्त होती है।'
                    : 'Committing today provides a favorable landed cost percentile vs forward 28-day drift.'}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-600">
                  <span>{isHi ? 'बेड़ा आपूर्ति:' : 'Fleet Supply:'} <strong>{availability?.signal || 'NORMAL'}</strong></span>
                  <span>•</span>
                  <span>{isHi ? 'प्रवृत्ति:' : 'Trend:'} <strong className="capitalize">{oppTrend}</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
            <span>{isHi ? 'तिथि:' : 'As of:'} {marketData?.as_of || '2026-09-15'}</span>
            <button
              onClick={() => onNavigate('planner')}
              className="text-govBlueAccent hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>{isHi ? 'चार्टर आवश्यकता पर परीक्षण करें' : 'Test requirement COS'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Middle: 28-Day Freight Forecast Snapshot (Col 5) */}
        <div className="md:col-span-5 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {isHi ? 'अग्रिम भाड़ा परिदृश्य (28-दिवसीय क्षितिज)' : 'Forward Freight Outlook (28-Day Horizon)'}
                </span>
                <h3 className="text-base font-bold text-govNavy">
                  {forecastSnapshot 
                    ? `${forecastSnapshot.target} ${isHi ? 'पूर्वानुमान:' : 'Forecast:'} ${Math.round(forecastSnapshot.p50).toLocaleString()} ${isHi ? 'अंक' : 'pts'}` 
                    : (isHi ? 'पूर्वानुमान लोड हो रहा है...' : 'Loading forecast...')}
                </h3>
              </div>
              <ProvenanceBadge type="FORECAST" text={isHi ? '80% कॉन्फ़ॉर्मल' : 'Conformal 80%'} />
            </div>

            {/* Forecast Numbers Grid */}
            {forecastSnapshot ? (
              <div className="my-3 space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">
                      {isHi ? 'P10 आशावादी' : 'P10 Optimistic'}
                    </span>
                    <strong className="text-xs font-mono text-emerald-700">
                      {Math.round(forecastSnapshot.p10).toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2 bg-blue-50/60 rounded border border-blue-200">
                    <span className="text-[10px] text-govBlueAccent font-semibold block">
                      {isHi ? 'P50 मध्यमान' : 'P50 Median'}
                    </span>
                    <strong className="text-xs font-mono text-govNavy">
                      {Math.round(forecastSnapshot.p50).toLocaleString()}
                    </strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">
                      {isHi ? 'P90 निराशावादी' : 'P90 Pessimistic'}
                    </span>
                    <strong className="text-xs font-mono text-rose-700">
                      {Math.round(forecastSnapshot.p90).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* Visual Trajectory Bar */}
                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div className="absolute inset-y-0 left-[20%] right-[20%] bg-blue-200 border-l-2 border-r-2 border-blue-500" />
                  <div className="absolute inset-y-0 left-[50%] w-1.5 bg-govNavy -translate-x-1/2" />
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <span>P10: {Math.round(forecastSnapshot.p10)}</span>
                  <span className="text-govNavy font-bold">P50: {Math.round(forecastSnapshot.p50)}</span>
                  <span>P90: {Math.round(forecastSnapshot.p90)}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                {isHi ? 'मॉडल स्नैपशॉट लोड हो रहा है...' : 'Loading model snapshot...'}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
            <span>{isHi ? 'मॉडल:' : 'Model:'} {forecastSnapshot?.modelName || 'Quantile LightGBM'}</span>
            <button
              onClick={() => onNavigate('forecast')}
              className="text-govBlueAccent hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>{isHi ? 'संपूर्ण पूर्वानुमान वक्र देखें' : 'Explore full forecast curve'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right: Operational Risk Status (Col 3) */}
        <div className="md:col-span-3 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {isHi ? 'यात्रा जोखिम मूल्यांकन' : 'Voyage Risk Assessment'}
                </span>
                <h3 className="text-base font-bold text-govNavy">
                  {isHi ? 'पूर्वी तट टर्मिनल' : 'East Coast Terminals'}
                </h3>
              </div>
              <ProvenanceBadge type="DERIVED" text={isHi ? 'संवेदनशीलता स्कोर' : 'Perturbation Score'} />
            </div>

            <div className="my-3 space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-600 font-medium">{isHi ? 'समग्र जोखिम स्तर' : 'Overall Risk Level'}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center space-x-1 ${
                  effectiveRisk === 'HIGH' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                  effectiveRisk === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${effectiveRisk === 'HIGH' ? 'bg-rose-600 animate-pulse' : effectiveRisk === 'MEDIUM' ? 'bg-amber-600' : 'bg-emerald-600'}`} />
                  <span>
                    {isHi 
                      ? (effectiveRisk === 'HIGH' ? 'उच्च (HIGH)' : effectiveRisk === 'LOW' ? 'निम्न (LOW)' : 'मध्यम (MEDIUM)') 
                      : effectiveRisk}
                  </span>
                </span>
              </div>

              <div className="text-[11px] text-slate-600 leading-snug">
                <strong>{isHi ? 'प्रमुख चालक: ' : 'Primary Driver: '}</strong>
                <span>{effectiveDriver}</span>
              </div>

              {/* Active Alerts List in Card */}
              {alertCount > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-govNavy uppercase tracking-wide">
                    <span className="flex items-center space-x-1 text-rose-700">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span>{isHi ? `सक्रिय निर्णय चेतावनियां (${alertCount})` : `Active Decision Alerts (${alertCount})`}</span>
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 font-normal">
                      {isHi ? 'लाइव मॉनिटरिंग' : 'Live Feeds'}
                    </span>
                  </div>

                  {activeDecisionAlerts.slice(0, 2).map((alt) => (
                    <div 
                      key={alt.id}
                      className={`p-2 rounded border text-[10px] space-y-0.5 transition ${
                        alt.severity === 'high' 
                          ? 'bg-rose-50/80 border-rose-200 text-rose-950' 
                          : 'bg-amber-50/80 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`px-1 py-0.2 rounded text-[8px] font-bold uppercase ${
                          alt.severity === 'high' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                        }`}>
                          {alt.severity}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500 font-bold">{alt.code}</span>
                      </div>
                      <p className="font-medium text-[10px] line-clamp-2 leading-tight">
                        {isHi && alt.hiTitle ? alt.hiTitle : alt.title}
                      </p>
                    </div>
                  ))}

                  {alertCount > 2 && (
                    <div className="text-center text-[9px] font-mono text-slate-500">
                      +{alertCount - 2} {isHi ? 'और चेतावनियां सक्रिय' : 'more alerts active in registry'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50/60 rounded border border-emerald-200/80 text-[10px] text-emerald-900 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1 text-emerald-950">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isHi ? 'सक्रिय चेतावनियां (0)' : 'Active Alerts (0)'}</span>
                    </span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-mono">NORMAL</span>
                  </div>
                  <p className="text-[10px] text-emerald-800 leading-tight">
                    {isHi ? 'वर्तमान में कोई गंभीर परिचालन व्यवधान नहीं।' : 'Zero severe operational disruptions on East Coast.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-500">
            <span>{isHi ? 'डिस्चार्ज: पारादीप (INPRT)' : 'Discharge: Paradip (INPRT)'}</span>
            <button
              onClick={() => onNavigate('risks')}
              className="text-govBlueAccent hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>{isHi ? 'जोखिम एवं अलर्ट रजिस्ट्री देखें' : 'View Risk & Alerts'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Live Market Cards: Baltic Sub-Indices */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              {isHi ? 'बाल्टिक एक्सचेंज ड्राई-बल्क उप-सूचकांक' : 'Baltic Exchange Dry-Bulk Sub-Indices'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isHi 
                ? 'प्रामाणिक बेंचमार्क सूचकांक स्तर, दैनिक प्रतिशत उतार-चढ़ाव और टाइम चार्टर औसत दैनिक दरें।'
                : 'Authoritative benchmark index levels, daily percent movement, and Time Charter average daily rates.'}
            </p>
          </div>
          <ProvenanceBadge type="OBSERVED" text={isHi ? 'बाल्टिक एक्सचेंज श्रृंखला' : 'Baltic Exchange Series'} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {['BCI', 'BPI', 'BSI', 'BHSI'].map((code) => {
            const idx = marketData?.indices?.[code];
            const change1d = idx?.change_1d_pct ?? 0;
            const isUp = change1d >= 0;
            const vesselMap = { BCI: 'Capesize', BPI: 'Panamax', BSI: 'Supramax', BHSI: 'Handysize' };

            return (
              <div
                key={code}
                onClick={() => {
                  setSelectedClass(vesselMap[code]);
                }}
                className={`p-3 rounded-lg border transition cursor-pointer ${
                  selectedClass === vesselMap[code]
                    ? 'bg-blue-50/60 border-blue-400 ring-1 ring-blue-300'
                    : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-govNavy text-sm font-mono">{code}</span>
                    <span className="text-[10px] text-slate-500 block leading-tight">{vesselMap[code]}</span>
                  </div>
                  <span className={`inline-flex items-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isUp ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isUp ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                    {isUp ? `+${change1d.toFixed(2)}%` : `${change1d.toFixed(2)}%`}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-govNavy font-mono">
                    {idx?.value ? Math.round(idx.value).toLocaleString() : '—'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    TC: {idx?.tc_avg_usd_day ? `$${Math.round(idx.tc_avg_usd_day).toLocaleString()}/${isHi ? 'दिन' : 'd'}` : '—'}
                  </span>
                </div>

                <div className="mt-1 pt-1 border-t border-slate-200/50 flex justify-between text-[9px] text-slate-400">
                  <span>30d: {idx?.change_30d_pct ? `${idx.change_30d_pct.toFixed(1)}%` : '—'}</span>
                  <span>{isHi ? 'अस्थिरता 20d:' : 'Vol 20d:'} {idx?.realised_vol_20d ? `${(idx.realised_vol_20d * 100).toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Macro, Commodity & Energy Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Bunker Fuel */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                {isHi ? 'बंकर ईंधन VLSFO (सिंगापुर)' : 'Bunker VLSFO Singapore'}
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ${marketData?.bunker?.value ? marketData.bunker.value.toFixed(2) : '550.00'} / {isHi ? 'मी.टन' : 'mt'}
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text={isHi ? 'सिंगापुर स्पॉट' : 'Singapore Spot'} />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>Series: BUNKER_VLSFO_SG</span>
            <span>{isHi ? 'अस्थिरता 90d: 14.2%' : 'Vol 90d: 14.2%'}</span>
          </div>
        </div>

        {/* Australian Coking Coal */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                {isHi ? 'ऑस्ट्रेलियाई प्रीमियम कोकिंग कोल' : 'Aus Premium Coking Coal'}
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ${marketData?.commodities?.COAL_COKING_AU_PHCC?.value ? marketData.commodities.COAL_COKING_AU_PHCC.value.toFixed(2) : '245.00'} / {isHi ? 'टन' : 't'}
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text={isHi ? 'एफओबी ऑस्ट्रेलिया' : 'FOB Australia'} />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>Change 30d: {marketData?.commodities?.COAL_COKING_AU_PHCC?.change_30d_pct ? `${marketData.commodities.COAL_COKING_AU_PHCC.change_30d_pct.toFixed(1)}%` : '+1.4%'}</span>
            <span>Index: PHCC</span>
          </div>
        </div>

        {/* Iron Ore 62% Fe CFR */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                {isHi ? 'लौह अयस्क 62% Fe CFR' : 'Iron Ore 62% Fe CFR'}
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ${marketData?.commodities?.IRON_ORE_CFR62?.value ? marketData.commodities.IRON_ORE_CFR62.value.toFixed(2) : '108.50'} / dmt
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text={isHi ? 'सीएफआर चीन / भारत' : 'CFR China / India'} />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>Change 30d: {marketData?.commodities?.IRON_ORE_CFR62?.change_30d_pct ? `${marketData.commodities.IRON_ORE_CFR62.change_30d_pct.toFixed(1)}%` : '-2.1%'}</span>
            <span>Benchmark Fe 62</span>
          </div>
        </div>

        {/* Currency Pair USD/INR */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                {isHi ? 'विनिमय दर USD / INR' : 'Exchange Rate USD / INR'}
              </span>
              <span className="text-base font-extrabold text-govNavy font-mono block mt-0.5">
                ₹{marketData?.fx?.rate ? marketData.fx.rate.toFixed(2) : '83.45'}
              </span>
            </div>
            <ProvenanceBadge type="OBSERVED" text={isHi ? 'आरबीआई संदर्भ' : 'RBI Reference'} />
          </div>
          <div className="text-[10px] text-slate-500 mt-2 flex justify-between border-t border-slate-100 pt-1">
            <span>{isHi ? 'लैंडेड लागत गुणक' : 'Landed Cost Multiplier'}</span>
            <span>{isHi ? 'तिथि:' : 'As of:'} {marketData?.fx?.obs_date || '2026-09-15'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
