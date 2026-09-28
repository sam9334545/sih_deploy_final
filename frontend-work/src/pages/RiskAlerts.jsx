import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  Activity, 
  TrendingUp, 
  Wind, 
  Clock, 
  Compass, 
  Ship, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  RefreshCw,
  Layers,
  ArrowRight
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import { fetchRisks, ApiError } from '../api';
import { useLanguage } from '../context/LanguageContext';

const DISCHARGE_PORTS = [
  { id: 'INPRT', name: 'Paradip Port (INPRT)', hiName: 'पारादीप बंदरगाह (INPRT)' },
  { id: 'INVTZ', name: 'Visakhapatnam (INVTZ)', hiName: 'विशाखापट्टनम बंदरगाह (INVTZ)' },
  { id: 'INDHA', name: 'Dhamra Port (INDHA)', hiName: 'धामरा बंदरगाह (INDHA)' },
  { id: 'INGGV', name: 'Gangavaram (INGGV)', hiName: 'गंगावरम बंदरगाह (INGGV)' },
  { id: 'INHAL', name: 'Haldia Dock Complex (INHAL)', hiName: 'हल्दिया डॉक कॉम्प्लेक्स (INHAL)' },
  { id: 'INGPR', name: 'Gopalpur Port (INGPR)', hiName: 'गोपालपुर बंदरगाह (INGPR)' },
];

const VESSEL_CLASSES = ['Capesize', 'Panamax', 'Supramax', 'Handysize'];

const COMPONENT_ICONS = {
  market: TrendingUp,
  congestion: Clock,
  weather: Wind,
  vessel_availability: Ship,
  route: Compass,
  demand: Activity,
};

export default function RiskAlerts({ onNavigate }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';

  const [selectedPortId, setSelectedPortId] = useState('INPRT');
  const [selectedClass, setSelectedClass] = useState('Panamax');
  const [selectedMonth, setSelectedMonth] = useState(10); // October (cyclone season)
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const asOfDate = '2026-09-15';

  useEffect(() => {
    loadRisks();
  }, [selectedPortId, selectedClass, selectedMonth]);

  async function loadRisks() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRisks({
        portId: selectedPortId,
        vesselClass: selectedClass,
        month: Number(selectedMonth),
        asOf: asOfDate,
      });
      setRiskData(data);
    } catch (err) {
      console.error('[Risks Error]:', err);
      setError(isHi ? 'बैकएंड से जोखिम मूल्यांकन प्राप्त करने में विफल।' : 'Failed to fetch risk assessment from backend.');
    } finally {
      setLoading(false);
    }
  }

  const components = riskData?.components || [];
  const alerts = riskData?.alerts || [];
  const overall = riskData?.overall || 'MEDIUM';

  return (
    <div className="space-y-4">
      {/* 1. Decision Workflow Banner */}
      <DecisionWorkflowBanner currentStep="risk" onNavigate={onNavigate} />

      {/* 2. Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-govNavy" />
            <h1 className="text-base font-bold text-govNavy font-serif">
              {isHi ? 'परिचालन जोखिम इंजन एवं समुद्री चेतावनी रजिस्ट्री' : 'Operational Risk Engine & Maritime Alert Registry'}
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              {isHi ? 'व्याख्यात्मक जोखिम मॉडल' : 'Explainable Risk Model'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isHi 
              ? 'सिम्युलेटर के ±1σ संवेदनशीलता अशांति से प्राप्त घटक-स्तरीय जोखिम कारक। शून्य मनमाने भार।'
              : 'Component-level risk attributions derived from ±1σ sensitivity perturbation of the simulator. Zero hand-tuned arbitrary weights.'}
          </p>
        </div>
        <ProvenanceBadge type="DERIVED" text={isHi ? 'अशांति संवेदनशीलता भार' : 'Perturbation Sensitivity Weights'} />
      </div>

      {/* 3. Parameter Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs space-y-2.5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <span className="text-xs font-bold text-govNavy uppercase tracking-wide">
            {isHi ? 'लक्षित बंदरगाह एवं बेड़ा खंड दायरा' : 'Target Port & Fleet Segment Scope'}
          </span>
          <button
            onClick={() => loadRisks()}
            className="text-[10px] text-govBlueAccent hover:underline flex items-center space-x-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>{isHi ? 'पुनः मूल्यांकन करें' : 'Re-evaluate'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'डिस्चार्ज पोर्ट' : 'Discharge Port'}
            </label>
            <select
              value={selectedPortId}
              onChange={(e) => setSelectedPortId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {DISCHARGE_PORTS.map((p) => (
                <option key={p.id} value={p.id}>{isHi && p.hiName ? p.hiName : p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'पोत वर्ग खंड' : 'Vessel Segment'}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {VESSEL_CLASSES.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'परिचालन कैलेंडर माह' : 'Operating Calendar Month'}
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              <option value="1">{isHi ? 'जनवरी (उत्तर-पूर्व मानसून - शांत)' : 'January (Northeast Monsoon - Calm)'}</option>
              <option value="4">{isHi ? 'अप्रैल (प्री-मानसून थर्मल)' : 'April (Pre-Monsoon Thermal)'}</option>
              <option value="7">{isHi ? 'जुलाई (दक्षिण-पश्चिम मानसून चरम - उच्च समुद्री लहरें)' : 'July (Southwest Monsoon Peak - High Swell)'}</option>
              <option value="10">{isHi ? 'अक्टूबर (मानसून उपरांत चक्रवात संक्रमण)' : 'October (Post-Monsoon Cyclone Transition)'}</option>
              <option value="11">{isHi ? 'नवंबर (बंगाल की खाड़ी चक्रवात चरम)' : 'November (Bay of Bengal Cyclone Peak)'}</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* 4. Overall Risk Assessment Gauge & Primary Driver */}
      {riskData && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Overall Risk Card (Col 4) */}
          <div className="md:col-span-4 bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start border-b border-slate-100 pb-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {isHi ? 'समग्र जोखिम स्कोर' : 'Composite Risk Score'}
                  </span>
                  <h3 className="text-base font-bold text-govNavy font-serif">
                    {isHi ? 'कुल जोखिम जोखिम' : 'Overall Exposure'}
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                  overall === 'HIGH' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                  overall === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                  'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {isHi 
                    ? (overall === 'HIGH' ? 'उच्च जोखिम' : overall === 'MEDIUM' ? 'मध्यम जोखिम' : 'निम्न जोखिम') 
                    : `${overall} Risk`}
                </span>
              </div>

              <div className="my-4 flex items-center space-x-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-extrabold font-mono text-xl ${
                  overall === 'HIGH' ? 'bg-rose-50 text-rose-700 border-2 border-rose-400' :
                  overall === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-2 border-amber-400' :
                  'bg-emerald-50 text-emerald-700 border-2 border-emerald-400'
                }`}>
                  {riskData.overall_raw ? riskData.overall_raw.toFixed(2) : '1.00'}
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-bold text-slate-800">
                    {isHi 
                      ? `${overall === 'HIGH' ? 'उच्च' : overall === 'MEDIUM' ? 'मध्यम' : 'निम्न'} समग्र स्तर` 
                      : `${overall} Composite Level`}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {isHi 
                      ? 'सीमांत लागत संवेदनशीलता द्वारा भारित 6 ऑर्थोगोनल जोखिम वैक्टर से व्युत्पन्न।' 
                      : 'Derived from 6 orthogonal risk vectors weighted by marginal cost sensitivities.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500">
              {isHi ? 'मूल्यांकन तिथि:' : 'Evaluated As Of:'} {asOfDate}
            </div>
          </div>

          {/* Primary Driver & What Would Change Card (Col 8) */}
          <div className="md:col-span-8 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                {isHi ? 'प्राथमिक निर्णय चालक' : 'Primary Decision Driver'}
              </span>
              <p className="text-xs text-slate-800 font-semibold mt-0.5 leading-relaxed">
                {riskData.main_driver || (isHi ? 'बाजार दर अस्थिरता कुल यात्रा लागत जोखिम में सबसे बड़ा हिस्सा योगदान करती है।' : 'Market rate volatility contributes the largest share to total voyage cost risk.')}
              </p>
            </div>

            {/* What Would Change This Decision? */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-govNavy uppercase tracking-wide block">
                {isHi ? 'कौन सी स्थितियां इस जोखिम निर्णय को बदल देंगी?' : 'What Conditions Would Change This Risk Verdict?'}
              </span>
              {riskData.what_would_change && riskData.what_would_change.length > 0 ? (
                <div className="space-y-1">
                  {riskData.what_would_change.map((cond, idx) => (
                    <div key={idx} className="flex items-start space-x-2 text-xs text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                      <span>{cond}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {isHi ? 'मानक परिचालन स्थितियां।' : 'Standard operational conditions.'}
                </p>
              )}
            </div>

            <div className="text-[9px] text-slate-400 font-mono pt-1">
              {isHi ? 'पद्धति:' : 'Methodology:'} {riskData.weights_method || (isHi ? 'प्रत्येक जोखिम कारक के संबंध में जोखिम-समायोजित लागत के आंशिक अवकलज।' : 'Partial derivatives of risk-adjusted cost with respect to each risk factor.')}
            </div>
          </div>
        </div>
      )}

      {/* 5. Six Risk Components Breakdown Table & Contribution Bars */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              {isHi ? 'घटक जोखिम अपघटन एवं संवेदनशीलता योगदान' : 'Component Risk Decomposition & Perturbation Contribution'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isHi 
                ? 'बाजार अस्थिरता, बर्थ प्रतीक्षा समय और जलवायु चक्रवात रिकॉर्ड से मूल्यांकित ऑर्थोगोनल जोखिम आयाम।'
                : 'Orthogonal risk dimensions evaluated from market volatility, berth wait times, and climatological cyclone records.'}
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {isHi ? `${components.length} निगरानी घटक` : `${components.length} Monitored Components`}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {components.map((comp) => {
            const Icon = COMPONENT_ICONS[comp.name] || Activity;
            const isHigh = comp.level === 'HIGH';
            const isMed = comp.level === 'MEDIUM';

            const compHindiName = {
              market: 'बाजार भाड़ा जोखिम (Market Risk)',
              congestion: 'बंदरगाह संकुलन जोखिम (Congestion Risk)',
              weather: 'मौसम एवं चक्रवात जोखिम (Weather Risk)',
              vessel_availability: 'पोत उपलब्धता जोखिम (Vessel Availability)',
              route: 'रूट एवं कॉरिडोर जोखिम (Route Risk)',
              demand: 'मांग अस्थिरता जोखिम (Demand Risk)',
            }[comp.name] || `${comp.name.replace(/_/g, ' ')} Risk`;

            return (
              <div
                key={comp.name}
                className="bg-slate-50/70 border border-slate-200 rounded-lg p-3 space-y-2 hover:bg-slate-100/70 transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-1.5">
                    <Icon className="w-4 h-4 text-govNavy" />
                    <span className="font-bold text-slate-800 text-xs capitalize">
                      {isHi ? compHindiName : `${comp.name.replace(/_/g, ' ')} Risk`}
                    </span>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                    isHigh ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                    isMed ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}>
                    {isHi ? (isHigh ? 'उच्च' : isMed ? 'मध्यम' : 'निम्न') : comp.level}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                  {comp.detail}
                </p>

                {/* Contribution bar */}
                <div className="space-y-1 pt-1 border-t border-slate-200/60">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>{isHi ? 'योगदान हिस्सा:' : 'Contribution Share:'}</span>
                    <strong className="text-govNavy">{comp.contribution_pct ? `${comp.contribution_pct.toFixed(1)}%` : '—'}</strong>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, comp.contribution_pct || 15)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono pt-0.5">
                    <span>{isHi ? 'भार:' : 'Weight:'} {(comp.weight * 100).toFixed(0)}%</span>
                    <span>{isHi ? 'सिग्नल z:' : 'Signal z:'} {comp.signal_z ? comp.signal_z.toFixed(2) : '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Active Live Alert Feed */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              {isHi 
                ? `सक्रिय समुद्री निर्णय चेतावनियां (${alerts.length})` 
                : `Active Maritime Decision Alerts (${alerts.length})`}
            </h3>
          </div>
          <ProvenanceBadge type="OBSERVED" text={isHi ? 'प्रणाली चेतावनी नियम' : 'System Alert Rules'} />
        </div>

        {alerts.length > 0 ? (
          <div className="space-y-2">
            {alerts.map((alert, idx) => {
              const isHigh = alert.severity === 'high';
              const isMed = alert.severity === 'medium';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 ${
                    isHigh
                      ? 'bg-rose-50/70 border-rose-300'
                      : isMed
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-blue-50/70 border-blue-200'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isHigh ? 'bg-rose-600 text-white' : isMed ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        {isHi ? (isHigh ? 'उच्च' : isMed ? 'मध्यम' : 'निम्न') : alert.severity}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500 font-bold">{alert.code}</span>
                      <span className="text-[10px] text-slate-400">
                        · {isHi ? 'लक्ष्य:' : 'Target:'} {selectedPortId} / {selectedClass}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">{alert.message}</p>
                  </div>

                  <span className="text-[9px] font-mono text-slate-400 whitespace-nowrap">
                    {isHi ? 'तिथि:' : 'As-Of:'} {asOfDate}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-400">
            {isHi 
              ? 'इस विन्यास के लिए कोई सक्रिय उच्च-तीव्रता चेतावनी नहीं मिली।' 
              : 'No active high-severity alerts detected for this configuration.'}
          </div>
        )}
      </div>
    </div>
  );
}
