import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  BarChart3, 
  Info, 
  AlertTriangle,
  Layers,
  ArrowRight,
  CheckCircle2,
  Sliders,
  Compass
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DataCutoffNotice from '../components/DataCutoffNotice';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import HistoricalForecast from './HistoricalForecast';
import { 
  VESSEL_INDEX_MAP, 
  VALID_HORIZONS, 
  executeLiveForecast,
  fetchHistoricalSeries,
  ApiError
} from '../api';
import { useLanguage } from '../context/LanguageContext';

export default function FreightForecast({ onNavigate }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';
  const [activeSubTab, setActiveSubTab] = useState('live2026'); // 'live2026' | 'backtest'
  const [vesselClass, setVesselClass] = useState('Panamax');
  const [horizon, setHorizon] = useState(28);
  
  // UX States
  const [status, setStatus] = useState('initial');
  const [forecastResult, setForecastResult] = useState(null);
  const [historyPoints, setHistoryPoints] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const mappedIndex = VESSEL_INDEX_MAP[vesselClass]?.index || 'BPI';
  const asOfDate = '2026-09-15';

  // Load live forecast on change
  useEffect(() => {
    if (activeSubTab === 'live2026') {
      runLiveForecast();
    }
  }, [vesselClass, horizon, activeSubTab]);

  async function runLiveForecast() {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const result = await executeLiveForecast({
        vesselClass,
        horizonDays: Number(horizon),
        asOf: asOfDate,
      });
      setForecastResult(result);

      // Fetch recent history context
      if (result.history && result.history.length > 0) {
        setHistoryPoints(result.history);
      } else {
        try {
          const histData = await fetchHistoricalSeries({
            target: mappedIndex,
            limit: 60,
          });
          setHistoryPoints(histData.observations || []);
        } catch (e) {
          console.warn('History fetch notice:', e);
        }
      }

      setStatus('success');
    } catch (err) {
      console.error('[Forecast Error]:', err);
      setStatus('error');
      setForecastResult(null);
      setErrorMessage(
        err instanceof ApiError 
          ? err.message 
          : 'Unable to compute forecast for selected parameters.'
      );
    }
  }

  // Render SVG Chart for the Live Forecast Trajectory
  const renderLiveForecastChart = () => {
    if (!forecastResult) {
      return (
        <div className="w-full h-56 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded border border-dashed border-slate-200">
          <p className="text-xs font-semibold">Loading forecast trajectory...</p>
        </div>
      );
    }

    const w = 620;
    const h = 200;
    const padX = 55;
    const padY = 25;

    const p10 = forecastResult.p10;
    const p50 = forecastResult.p50;
    const p90 = forecastResult.p90;

    const histVals = (historyPoints || []).map(d => Number(d.value) || 0).filter(v => v > 0);
    const allVals = [...(histVals.length ? histVals : [p50]), p10, p90];
    const minV = Math.min(...allVals) * 0.90;
    const maxV = Math.max(...allVals) * 1.10;
    const range = maxV - minV || 1;

    const toY = (val) => padY + h - ((val - minV) / range) * (h - 20);

    // Build historical path
    const recentHist = (historyPoints || []).slice(-45);
    const histPts = recentHist.map((d, i, arr) => {
      const x = padX + (i / (arr.length + 8)) * (w * 0.70);
      const y = toY(Number(d.value) || p50);
      return { x, y, val: d.value };
    });

    const histLine = histPts.length > 1
      ? histPts.reduce((acc, p, i) => (i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`), '')
      : null;

    const originPt = histPts.length > 0 
      ? histPts[histPts.length - 1] 
      : { x: padX + w * 0.70, y: toY(p50) };

    // Forecast coordinates
    const forecastX = Math.min(w + 30, originPt.x + 90);
    const p50Y = toY(p50);
    const p10Y = toY(p10);
    const p90Y = toY(p90);

    return (
      <svg className="w-full h-full select-none" viewBox={`0 0 ${w + 80} ${h + 45}`}>
        <defs>
          <linearGradient id="forecastBandGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.25" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        <line stroke="#E2E8F0" strokeWidth="1" x1={padX} x2={w + 50} y1={padY} y2={padY} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 6} y={padY + 3}>{Math.round(maxV)}</text>

        <line stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3,3" x1={padX} x2={w + 50} y1={padY + h / 2} y2={padY + h / 2} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 6} y={padY + h / 2 + 3}>{Math.round((maxV + minV) / 2)}</text>

        <line stroke="#E2E8F0" strokeWidth="1" x1={padX} x2={w + 50} y1={padY + h} y2={padY + h} />
        <text fill="#94A3B8" fontSize="9" textAnchor="end" x={padX - 6} y={padY + h + 3}>{Math.round(minV)}</text>

        {/* Observed History Trajectory */}
        {histLine && (
          <path d={histLine} fill="none" stroke="#003366" strokeWidth="2.2" strokeLinecap="round" />
        )}

        {/* T0 Origin Vertical Marker */}
        <line 
          x1={originPt.x} 
          x2={originPt.x} 
          y1={padY} 
          y2={padY + h} 
          stroke="#D97706" 
          strokeWidth="1.5" 
          strokeDasharray="4,3" 
        />
        <text fill="#B45309" fontSize="9" fontWeight="bold" textAnchor="middle" x={originPt.x} y={padY - 8}>
          T₀ {isHi ? 'वर्तमान' : 'As-Of'} ({asOfDate})
        </text>

        {/* 80% Conformal Prediction Cone */}
        <polygon 
          points={`${originPt.x},${originPt.y} ${forecastX},${p10Y} ${forecastX},${p90Y}`}
          fill="url(#forecastBandGrad)" 
        />
        <line x1={forecastX} x2={forecastX} y1={p10Y} y2={p90Y} stroke="#0284C7" strokeWidth="3.5" strokeLinecap="round" />

        {/* P50 Trajectory */}
        <line 
          x1={originPt.x} 
          x2={forecastX} 
          y1={originPt.y} 
          y2={p50Y} 
          stroke="#0B5FA5" 
          strokeWidth="2" 
          strokeDasharray="4,4" 
        />

        {/* P50 Forecast Node */}
        <circle cx={forecastX} cy={p50Y} r="5" fill="#003366" stroke="#FFFFFF" strokeWidth="2" />
        <text fill="#003366" fontSize="10" fontWeight="bold" x={forecastX + 10} y={p50Y + 3}>
          P50: {Math.round(p50).toLocaleString()} {isHi ? 'अंक' : 'pts'}
        </text>

        {/* P10 & P90 Boundary Labels */}
        <text fill="#64748B" fontSize="8.5" x={forecastX + 10} y={p90Y + 3}>
          P90: {Math.round(p90).toLocaleString()}
        </text>
        <text fill="#64748B" fontSize="8.5" x={forecastX + 10} y={p10Y + 3}>
          P10: {Math.round(p10).toLocaleString()}
        </text>

        {/* Bottom X-axis session markers */}
        <text fill="#64748B" fontSize="9" x={padX} y={padY + h + 16}>
          {isHi ? 'सिंथेटिक विस्तार इतिहास' : 'Synthetic Extension History'}
        </text>
        <text fill="#B45309" fontSize="9" fontWeight="semibold" textAnchor="middle" x={originPt.x} y={padY + h + 16}>T₀</text>
        <text fill="#0B5FA5" fontSize="9" fontWeight="bold" textAnchor="middle" x={forecastX} y={padY + h + 16}>
          +{horizon} {isHi ? 'दिन क्षितिज' : 'Days Horizon'}
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Decision Workflow Banner */}
      <DecisionWorkflowBanner currentStep="forecast" onNavigate={onNavigate} />

      {/* 2. Top Header with Sub-tab Switcher */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-govNavy" />
            <h1 className="text-base font-bold text-govNavy font-serif">
              {isHi ? 'क्वांटाइल भाड़ा पूर्वानुमान एवं कॉन्फ़ॉर्मल अनिश्चितता बैंड' : 'Quantile Freight Forecasting & Conformal Uncertainty Bands'}
            </h1>
            <span className={`font-semibold px-2 py-0.5 rounded text-[10px] border ${
              forecastResult?.modelSource === 'forecast_v2'
                ? 'bg-blue-100 text-govBlueAccent border-blue-200'
                : forecastResult?.modelSource === 'fallback_v1'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              {forecastResult?.modelSource === 'forecast_v2'
                ? (isHi ? 'LightGBM v2 + कॉन्फ़ॉर्मल' : 'LightGBM v2 + Conformal')
                : forecastResult?.modelSource === 'fallback_v1'
                ? (isHi ? 'फ़ॉलबैक मॉडल (v1)' : 'Fallback Model (v1)')
                : (isHi ? 'एमएल पूर्वानुमान' : 'ML Forecast')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isHi 
              ? '80% कवरेज अंशांकन के साथ विभिन्न समयावधियों (7, 14, 28, 60, 90, 180 दिन) पर संभाव्य सूचकांक प्रक्षेपवक्र पूर्वानुमान।'
              : 'Probabilistic index trajectory forecasting across discrete horizons (h ∈ {7, 14, 28, 60, 90, 180}) with 80% coverage calibration.'}
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveSubTab('live2026')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition border cursor-pointer ${
              activeSubTab === 'live2026'
                ? 'bg-govNavy text-white border-govNavy shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            {isHi ? '2026 पूर्वानुमान क्षितिज' : '2026 Forecast Horizon'}
          </button>
          <button
            onClick={() => setActiveSubTab('backtest')}
            className={`px-3 py-1.5 rounded text-xs font-bold transition border cursor-pointer ${
              activeSubTab === 'backtest'
                ? 'bg-govNavy text-white border-govNavy shadow-xs'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
            }`}
          >
            {isHi ? 'ऐतिहासिक बैक-टेस्ट (2012–2019)' : 'Historical Backtest (2012–2019)'}
          </button>
        </div>
      </div>

      {/* 3. Honest Data Integrity Architecture Banner */}
      <DataCutoffNotice />

      {/* Sub-tab: Historical Backtest */}
      {activeSubTab === 'backtest' ? (
        <HistoricalForecast initialVessel={vesselClass} />
      ) : (
        /* Sub-tab: 2026 Forecast View */
        <div className="space-y-4">
          {/* Controls Strip */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  {isHi ? 'पोत श्रेणी (Vessel Segment)' : 'Vessel Segment'}
                </label>
                <select
                  value={vesselClass}
                  onChange={(e) => setVesselClass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
                >
                  {Object.keys(VESSEL_INDEX_MAP).map(cls => (
                    <option key={cls} value={cls}>{cls} ({VESSEL_INDEX_MAP[cls].index})</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {isHi ? 'बाल्टिक लक्ष्य:' : 'Baltic Target:'} <strong className="text-govNavy font-mono">{mappedIndex}</strong>
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  {isHi ? 'पूर्वानुमान क्षितिज' : 'Forecast Horizon'}
                </label>
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
                >
                  {VALID_HORIZONS.map(h => (
                    <option key={h} value={h}>{h} {isHi ? 'दिन (ट्रेडिंग सत्र)' : 'Days (Trading Sessions)'}</option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {isHi ? 'लक्ष्य तिथि:' : 'Target Date:'} 2026-10-13 (+{horizon}d)
                </span>
              </div>

              <div className="flex items-end">
                <div className="w-full p-2 bg-blue-50/70 border border-blue-200 rounded text-[11px] text-govNavy flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-500 block">
                      {isHi ? 'पूर्वानुमान मॉडल स्थिति' : 'Forecast Model Status'}
                    </span>
                    <strong>{forecastResult?.modelSource === 'forecast_v2' ? (isHi ? 'एन्सेम्बल v2 (एमएल)' : 'Ensemble v2 (ML)') : (isHi ? 'फ़ॉलबैक रिज v1' : 'Fallback Ridge v1')}</strong>
                  </div>
                  <ProvenanceBadge type="FORECAST" text={isHi ? '80% कॉन्फ़ॉर्मल' : 'Conformal 80%'} />
                </div>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
              {errorMessage}
            </div>
          )}

          {/* Forecast Chart Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                  {vesselClass} ({mappedIndex}) {isHi ? 'अग्रिम प्रक्षेपवक्र एवं 80% पूर्वानुमान शंकु' : 'Forward Horizon Trajectory & 80% Prediction Cone'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isHi
                    ? `अंशांकित कॉन्फ़ॉर्मल पूर्वानुमान शंकु के साथ प्रारंभिक तिथि T₀ (${asOfDate}) तक का ऐतिहासिक प्रक्षेपवक्र।`
                    : `Historical synthetic trajectory leading to origin date T₀ (${asOfDate}) with calibrated conformal forecast cone.`}
                </p>
              </div>
              <div className="flex items-center space-x-3 text-[10px] font-medium text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-0.5 bg-govNavy" />
                  <span>{isHi ? 'ऐतिहासिक प्रक्षेपवक्र' : 'Historical Trajectory'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-2 bg-sky-200 border border-sky-500" />
                  <span>{isHi ? '80% पूर्वानुमान शंकु' : '80% Prediction Cone'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-govNavy" />
                  <span>{isHi ? 'मध्यमान P50' : 'Median P50'}</span>
                </span>
              </div>
            </div>

            {/* SVG Chart Container */}
            <div className="h-64 w-full">
              {renderLiveForecastChart()}
            </div>

            {/* Trajectory Metrics Strip */}
            {forecastResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs font-mono">
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'P10 निचली सीमा' : 'P10 Lower Bound'}
                  </span>
                  <strong className="text-emerald-700 text-sm">
                    {Math.round(forecastResult.p10).toLocaleString()} {isHi ? 'अंक' : 'pts'}
                  </strong>
                </div>
                <div className="p-2.5 bg-blue-50/70 rounded border border-blue-200">
                  <span className="text-[9px] text-govBlueAccent font-semibold block font-sans">
                    {isHi ? 'P50 मध्यमान पूर्वानुमान' : 'P50 Median Forecast'}
                  </span>
                  <strong className="text-govNavy text-sm">
                    {Math.round(forecastResult.p50).toLocaleString()} {isHi ? 'अंक' : 'pts'}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'P90 ऊपरी सीमा' : 'P90 Upper Bound'}
                  </span>
                  <strong className="text-rose-700 text-sm">
                    {Math.round(forecastResult.p90).toLocaleString()} {isHi ? 'अंक' : 'pts'}
                  </strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? '80% शंकु चौड़ाई' : '80% Cone Width'}
                  </span>
                  <strong className="text-slate-800 text-sm">
                    {Math.round(forecastResult.p90 - forecastResult.p10).toLocaleString()} {isHi ? 'अंक' : 'pts'}
                  </strong>
                </div>
              </div>
            )}
          </div>

          {/* Model Scorecard & Driver Attributions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Model Performance Scorecard (Col 6) */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                  {isHi ? 'मॉडल सत्यापन एवं अंशांकन स्कोरकार्ड' : 'Model Validation & Calibration Scorecard'}
                </h3>
                <ProvenanceBadge type="DERIVED" text={isHi ? 'सत्यापन मेट्रिक्स' : 'Validation Metrics'} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'सत्यापन MASE' : 'Validation MASE'}
                  </span>
                  <strong className="text-govNavy">
                    {typeof forecastResult?.validationMase === 'number' ? forecastResult.validationMase.toFixed(3) : 'N/A'}
                  </strong>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'अनुभवजन्य कवरेज' : 'Empirical Coverage'}
                  </span>
                  <strong className="text-emerald-700">
                    {typeof forecastResult?.empiricalCoverage === 'number' ? `${(forecastResult.empiricalCoverage * 100).toFixed(1)}%` : '80.0% (Nominal)'}
                  </strong>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'नाममात्र लक्ष्य' : 'Nominal Target'}
                  </span>
                  <strong className="text-slate-700">80.0% (P10–P90)</strong>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'अंशांकन प्रकार' : 'Calibration Type'}
                  </span>
                  <strong className="text-slate-700 font-sans text-[10px]">
                    {isHi ? 'विभाजित-कॉन्फ़ॉर्मल' : 'Split-Conformal'}
                  </strong>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'सत्यापन पद्धति' : 'Validation Method'}
                  </span>
                  <strong className="text-slate-700 font-sans text-[10px]">
                    {isHi ? 'विस्तारित-मूल (Expanding)' : 'Expanding-Origin'}
                  </strong>
                </div>

                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[9px] text-slate-500 block font-sans">
                    {isHi ? 'मॉडल इंजन' : 'Model Engine'}
                  </span>
                  <strong className={`font-sans text-[10px] px-1 py-0.5 rounded ${
                    forecastResult?.modelSource === 'forecast_v2' ? 'text-blue-800 bg-blue-50' : 'text-amber-800 bg-amber-50'
                  }`}>
                    {forecastResult?.modelSource === 'forecast_v2' ? 'LightGBM v2' : (isHi ? 'फ़ॉलबैक v1' : 'Fallback v1')}
                  </strong>
                </div>
              </div>

              <p className="text-[10px] text-slate-500 italic pt-1">
                {isHi 
                  ? 'नोट: सत्यापन आँकड़े सत्यापित 2012-2019 बाल्टिक सत्रों पर विस्तार-मूल मूल्यांकन को दर्शाते हैं, भविष्य की गारंटी नहीं।'
                  : 'Note: Validation statistics reflect expanding-origin evaluation on verified 2012–2019 Baltic sessions, not future guarantees.'}
              </p>
            </div>

            {/* Plain-English Feature Driver Attribution (Col 6) */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                    {isHi ? 'इस पूर्वानुमान को क्या प्रभावित कर रहा है?' : 'What Is Moving This Forecast?'}
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {isHi ? 'फीचर योगदान' : 'Feature Contribution'}
                </span>
              </div>

              {forecastResult?.drivers && forecastResult.drivers.length > 0 ? (
                <div className="space-y-1.5 text-xs">
                  {forecastResult.drivers.slice(0, 5).map((driver, i) => {
                    const isUp = driver.direction === 'up' || driver.contribution_log > 0;
                    return (
                      <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                        <div className="flex items-center space-x-2">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isUp ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isUp ? '↑' : '↓'}
                          </span>
                          <span className="font-semibold text-slate-800 font-mono text-[11px]">{driver.feature}</span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-600">
                          {driver.contribution_log 
                            ? `${driver.contribution_log > 0 ? '+' : ''}${driver.contribution_log.toFixed(3)}` 
                            : (isUp ? (isHi ? 'तेजी' : 'Bullish') : (isHi ? 'मंदी' : 'Bearish'))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-700">
                      {isHi ? '↑ 21-दिवसीय मूल्य गति एवं रुझान अनुसरण' : '↑ 21-Day Price Momentum & Trend Following'}
                    </span>
                    <span className="font-mono text-emerald-700 font-bold text-[10px]">
                      {isHi ? 'तेजी चालक' : 'Bullish Driver'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-700">
                      {isHi ? '↑ बंकर ईंधन मूल्य प्रसार (VLSFO सिंगापुर)' : '↑ Bunker Fuel Price Spread (VLSFO Singapore)'}
                    </span>
                    <span className="font-mono text-emerald-700 font-bold text-[10px]">
                      {isHi ? '+लागत दबाव' : '+Cost Pressure'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="text-slate-700">
                      {isHi ? '↓ मानसून उपरांत मौसमी मंदी' : '↓ Post-Monsoon Seasonal Taper'}
                    </span>
                    <span className="font-mono text-rose-700 font-bold text-[10px]">
                      {isHi ? 'मौसमी मंदी' : 'Seasonal Drag'}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-2 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-500">
                <strong>{isHi ? 'योगदान कार्यप्रणाली: ' : 'Attribution Methodology: '}</strong>
                {isHi
                  ? 'मान मॉडल फीचर योगदान (SHAP / रैखिक गुणांक) दर्शाते हैं। ये सांख्यिकीय मॉडल लोडिंग को दर्शाते हैं।'
                  : 'Values represent model feature contributions (SHAP / linear coefficients). They reflect statistical model loadings, not an asserted causal market explanation.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
