import React, { useState, useEffect, useRef } from 'react';
import { 
  Ship, 
  Compass, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
  BarChart3,
  Sliders,
  Check
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import TornadoChart from '../components/TornadoChart';
import { optimizeCharter, ApiError } from '../api';
import { useLanguage } from '../context/LanguageContext';

const LOAD_PORTS = [
  { id: 'AUHPT', name: 'Hay Point (Australia)', hiName: 'हे पॉइंट (ऑस्ट्रेलिया)', defaultCommodity: 'coking_coal' },
  { id: 'AUGLT', name: 'Gladstone (Australia)', hiName: 'ग्लैडस्टोन (ऑस्ट्रेलिया)', defaultCommodity: 'coking_coal' },
  { id: 'IDTBA', name: 'Taboneo (Indonesia)', hiName: 'ताबानेओ (इंडोनेशिया)', defaultCommodity: 'thermal_coal' },
  { id: 'ZARBY', name: 'Richards Bay (South Africa)', hiName: 'रिचर्ड्स बे (दक्षिण अफ्रीका)', defaultCommodity: 'thermal_coal' },
  { id: 'USHAM', name: 'Hampton Roads (USA)', hiName: 'हैम्पटन रोड्स (यूएसए)', defaultCommodity: 'coking_coal' },
  { id: 'MZBEW', name: 'Beira (Mozambique)', hiName: 'बेइरा (मोजाम्बिक)', defaultCommodity: 'coking_coal' },
];

const DISCHARGE_PORTS = [
  { id: 'INPRT', name: 'Paradip Port (INPRT)', hiName: 'पारादीप बंदरगाह (INPRT)', state: 'Odisha', maxDraft: 16.0 },
  { id: 'INVTZ', name: 'Visakhapatnam (INVTZ)', hiName: 'विशाखापट्टनम बंदरगाह (INVTZ)', state: 'Andhra Pradesh', maxDraft: 18.1 },
  { id: 'INDHA', name: 'Dhamra Port (INDHA)', hiName: 'धामरा बंदरगाह (INDHA)', state: 'Odisha', maxDraft: 18.5 },
  { id: 'INGGV', name: 'Gangavaram (INGGV)', hiName: 'गंगावरम बंदरगाह (INGGV)', state: 'Andhra Pradesh', maxDraft: 18.5 },
  { id: 'INHAL', name: 'Haldia Dock Complex (INHAL)', hiName: 'हल्दिया डॉक कॉम्प्लेक्स (INHAL)', state: 'West Bengal', maxDraft: 8.5 },
  { id: 'INGPR', name: 'Gopalpur Port (INGPR)', hiName: 'गोपालपुर बंदरगाह (INGPR)', state: 'Odisha', maxDraft: 13.5 },
];

export default function CharterPlanner({ onNavigate }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';

  // Input form state
  const [cargoType, setCargoType] = useState('coking_coal');
  const [quantityT, setQuantityT] = useState(120000);
  const [originPort, setOriginPort] = useState('AUHPT');
  const [destinationPort, setDestinationPort] = useState('INPRT');
  const [deadlineDays, setDeadlineDays] = useState(60);
  const [contractHorizon, setContractHorizon] = useState(''); // '' (auto) | '1' | '2' | '3'
  const [riskAversion, setRiskAversion] = useState(0.5); // lambda in [0, 1]

  // UX states: 'initial' | 'loading' | 'success' | 'error' | 'infeasible'
  const [status, setStatus] = useState('initial');
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [infeasiblePayload, setInfeasiblePayload] = useState(null);
  const [commodityNotice, setCommodityNotice] = useState(null);

  const reqIdRef = useRef(0);
  const asOfDate = '2026-09-15';

  const computeRequiredBy = (days) => {
    const d = new Date(asOfDate);
    d.setDate(d.getDate() + Number(days));
    return d.toISOString().split('T')[0];
  };

  const handleOriginChange = (newPort) => {
    setOriginPort(newPort);
    if (newPort === 'IDTBA' && cargoType !== 'thermal_coal') {
      setCargoType('thermal_coal');
      setCommodityNotice(
        isHi
          ? 'चयनित लोडिंग पोर्ट संदर्भ रजिस्ट्री में थर्मल कोल का समर्थन करता है, अतः वस्तु थर्मल कोल में समायोजित की गई।'
          : 'Commodity adjusted to Thermal Coal because the selected loading port supports thermal coal in the reference registry.'
      );
    } else if (newPort === 'USHAM' && cargoType !== 'coking_coal') {
      setCargoType('coking_coal');
      setCommodityNotice(
        isHi
          ? 'चयनित लोडिंग पोर्ट संदर्भ रजिस्ट्री में कोकिंग कोल का समर्थन करता है, अतः वस्तु कोकिंग कोल में समायोजित की गई।'
          : 'Commodity adjusted to Coking Coal because the selected loading port supports coking coal in the reference registry.'
      );
    } else {
      setCommodityNotice(null);
    }
  };

  const handleCargoChange = (newCargo) => {
    setCargoType(newCargo);
    if (originPort === 'IDTBA' && newCargo !== 'thermal_coal') {
      setCommodityNotice(
        isHi
          ? 'सूचना: पोर्ट रजिस्ट्री में ताबानेओ एंकरेज थर्मल कोल का समर्थन करता है।'
          : 'Note: Taboneo Anchorage supports Thermal Coal in the port registry.'
      );
    } else if (originPort === 'USHAM' && newCargo !== 'coking_coal') {
      setCommodityNotice(
        isHi
          ? 'सूचना: पोर्ट रजिस्ट्री में हैम्पटन रोड्स कोकिंग कोल का समर्थन करता है।'
          : 'Note: Hampton Roads supports Coking Coal in the port registry.'
      );
    } else {
      setCommodityNotice(null);
    }
  };

  useEffect(() => {
    runCharterAnalysis();
  }, []);

  async function runCharterAnalysis() {
    const currentReqId = ++reqIdRef.current;
    setStatus('loading');
    setErrorMessage(null);
    setInfeasiblePayload(null);
    try {
      const requiredBy = computeRequiredBy(deadlineDays);
      const data = await optimizeCharter({
        cargoType,
        quantityT: Number(quantityT),
        originPort,
        destinationPort,
        requiredBy,
        asOf: asOfDate,
        riskAversion: Number(riskAversion),
        contractHorizonVoyages: contractHorizon ? Number(contractHorizon) : undefined,
        deadlinePenaltyUsd: 500000,
        nSimulations: 500,
      });

      if (currentReqId !== reqIdRef.current) return;
      setResult(data);
      setStatus('success');
    } catch (err) {
      if (currentReqId !== reqIdRef.current) return;
      console.error('[Charter Planner Error]:', err);
      if (err instanceof ApiError && err.status === 422) {
        setStatus('infeasible');
        setInfeasiblePayload(err.payload);
        setErrorMessage(err.message || 'No feasible charter strategy satisfies the constraint set.');
      } else {
        setStatus('error');
        setResult(null);
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'Unable to complete charter optimization. Please verify port and deadline parameters.'
        );
      }
    }
  }

  const rec = result?.recommendation;
  const breakdown = result?.cost_breakdown_usd;
  const opp = result?.opportunity;

  return (
    <div className="space-y-4">
      {/* 1. Core Workflow Pipeline */}
      <DecisionWorkflowBanner currentStep="cargo" onNavigate={onNavigate} />

      {/* 2. Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-govNavy font-serif">
              {isHi ? 'चार्टर योजनाकार एवं अधिप्राप्ति रणनीति अनुकूलक' : 'Charter Planner & Procurement Strategy Optimizer'}
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              {isHi ? 'प्रमुख निर्णय इंजन' : 'Core Decision Engine'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isHi 
              ? 'भौतिक ड्राफ्ट सीमाओं का मूल्यांकन करें, भाड़ा वक्रों का पूर्वानुमान लगाएं और अनिश्चितता के तहत बहु-यात्रा अनुबंध रणनीतियों का अनुकरण करें।'
              : 'Evaluate physical draft constraints, forecast freight curves, and simulate multi-voyage contract strategies under uncertainty.'}
          </p>
        </div>
        <ProvenanceBadge type="DERIVED" text={isHi ? 'निर्णय इंजन आउटपुट' : 'Decision Engine Output'} />
      </div>

      {/* 3. Parameter Input Console */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <Sliders className="w-3.5 h-3.5 text-govBlueAccent" />
            <h2 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              {isHi ? 'अधिप्राप्ति एवं समुद्री यात्रा विनिर्देश' : 'Procurement & Voyage Specification'}
            </h2>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {isHi ? 'निर्णय तिथि:' : 'Decision As-Of:'} {asOfDate}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          {/* Commodity Type */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'कार्गो वस्तु (Commodity)' : 'Cargo Commodity'}
            </label>
            <select
              value={cargoType}
              onChange={(e) => handleCargoChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              <option value="coking_coal">{isHi ? 'कोकिंग कोल (धातुकर्म कोयला)' : 'Coking Coal (Met Coal)'}</option>
              <option value="thermal_coal">{isHi ? 'थर्मल कोल (स्टीम कोयला)' : 'Thermal Coal (Steam Coal)'}</option>
              <option value="iron_ore">{isHi ? 'लौह अयस्क (Lump / Fines)' : 'Iron Ore (Lump / Fines)'}</option>
            </select>
          </div>

          {/* Cargo Volume */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'अधिप्राप्ति टन भार (टन)' : 'Procurement Tonnage (t)'}
            </label>
            <input
              type="number"
              value={quantityT}
              step="5000"
              min="20000"
              max="500000"
              onChange={(e) => setQuantityT(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono text-slate-800 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Origin Port */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'लोडिंग पोर्ट (मूल स्रोत)' : 'Origin Loading Port'}
            </label>
            <select
              value={originPort}
              onChange={(e) => handleOriginChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {LOAD_PORTS.map((p) => (
                <option key={p.id} value={p.id}>{isHi && p.hiName ? p.hiName : p.name}</option>
              ))}
            </select>
          </div>

          {/* Destination Port */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'डिस्चार्ज पोर्ट (भारत पूर्वी तट)' : 'Discharge Port (India East Coast)'}
            </label>
            <select
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {DISCHARGE_PORTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {isHi && p.hiName ? `${p.hiName} (अधिकतम ${p.maxDraft}मी)` : `${p.name} (Max ${p.maxDraft}m)`}
                </option>
              ))}
            </select>
          </div>

          {/* Delivery Deadline */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'लेकैन समय-सीमा:' : 'Laycan Deadline:'}{' '}
              <strong className="font-mono text-govNavy">{deadlineDays} {isHi ? 'दिन' : 'days'}</strong>
            </label>
            <input
              type="range"
              min="20"
              max="180"
              step="5"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Number(e.target.value))}
              className="w-full accent-govNavy cursor-pointer"
            />
            <span className="text-[9px] font-mono text-slate-400 block text-right mt-0.5">
              {isHi ? 'लक्ष्य तिथि:' : 'Target:'} {computeRequiredBy(deadlineDays)}
            </span>
          </div>

          {/* Risk Aversion Slider */}
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'जोखिम प्रतिरोध (λ):' : 'Risk Aversion (λ):'}{' '}
              <strong className="font-mono text-govNavy">{riskAversion.toFixed(2)}</strong>
            </label>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={riskAversion}
              onChange={(e) => setRiskAversion(Number(e.target.value))}
              className="w-full accent-govNavy cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
              <span>{isHi ? 'तटस्थ (0)' : 'Neutral (0)'}</span>
              <span>{isHi ? 'प्रतिरोधी (1)' : 'Averse (1)'}</span>
            </div>
          </div>
        </div>

        {commodityNotice && (
          <div className="bg-amber-50 border border-amber-300 rounded p-2.5 text-[11px] text-amber-900 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{commodityNotice}</span>
            </div>
            <button
              onClick={() => setCommodityNotice(null)}
              className="text-[10px] text-amber-700 hover:text-amber-900 underline cursor-pointer"
            >
              {isHi ? 'हटाएं' : 'Dismiss'}
            </button>
          </div>
        )}

        {/* CTA Button */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="text-[11px] text-slate-500">
            {isHi 
              ? 'क्लिक करने पर बंदरगाह व्यवहार्यता फ़िल्टर, मोंटे कार्लो सिमुलेशन और CVaR रैंकिंग निष्पादित होगी।' 
              : 'Clicking will execute hard port feasibility filter, Monte Carlo simulation, and CVaR ranking.'}
          </div>
          <button
            onClick={() => runCharterAnalysis()}
            disabled={status === 'loading'}
            className="px-5 py-2 bg-govNavy text-white hover:bg-govNavyLight disabled:opacity-50 transition rounded font-semibold text-xs flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <span>
              {status === 'loading' 
                ? (isHi ? 'चार्टर विश्लेषण चल रहा है...' : 'Running Charter Analysis...') 
                : (isHi ? 'चार्टर विश्लेषण निष्पादित करें' : 'RUN CHARTER ANALYSIS')}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4. Infeasible State */}
      {status === 'infeasible' && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-amber-950">
                {isHi ? 'अव्यवहार्य चार्टर आवश्यकता' : 'Infeasible Charter Requirement'}
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">{errorMessage}</p>
            </div>
          </div>

          {infeasiblePayload?.infeasible && (
            <div className="space-y-2 mt-2">
              <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wide block">
                {isHi ? 'बैकएंड परिचालन सीमा उल्लंघन:' : 'Backend Constraint Violations:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {infeasiblePayload.infeasible.map((inf, i) => (
                  <div key={i} className="bg-white/80 border border-amber-200 rounded p-2.5 text-xs">
                    <span className="font-bold text-slate-800 block">{inf.label || inf.id}</span>
                    <span className="text-[11px] text-rose-700 block mt-0.5">
                      {isHi ? 'कारण:' : 'Reason:'} {inf.reason}
                    </span>
                    <p className="text-[10px] text-slate-600 mt-1">{inf.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-amber-900 pt-2 border-t border-amber-200">
            <strong>{isHi ? 'अनुशंसित समायोजन: ' : 'Recommended Adjustments: '}</strong>
            {isHi 
              ? 'लेकैन समय-सीमा बढ़ाएं, अधिप्राप्ति पार्सल को अधिक पोतों में विभाजित करें, या गहरे ड्राफ्ट वाले वैकल्पिक टर्मिनल (जैसे धामरा या गंगावरम) का चयन करें।'
              : 'Extend the laycan deadline window, split the procurement parcel across more vessels, or select an alternative deep-draft terminal (e.g. Dhamra or Gangavaram).'}
          </div>
        </div>
      )}

      {/* 5. Error State */}
      {status === 'error' && (
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-4 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => runCharterAnalysis()} className="underline font-bold">
            {isHi ? 'पुनः विश्लेषण करें' : 'Retry Analysis'}
          </button>
        </div>
      )}

      {/* 6. Success Output: Decision Summary + Why + Cost Breakdown */}
      {status === 'success' && rec && (
        <div className="space-y-4 animate-fadeIn">
          {/* Main Recommendation Banner Card */}
          <div className="bg-white border-2 border-blue-500/40 rounded-lg p-4 shadow-sm bg-gradient-to-r from-blue-50/50 via-white to-slate-50">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-blue-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                  {isHi ? 'प्रामाणिक बैकएंड चार्टर अनुशंसा' : 'Authoritative Backend Charter Recommendation'}
                </span>
                <div className="flex items-center space-x-2 mt-0.5">
                  <Ship className="w-4 h-4 text-govNavy" />
                  <h2 className="text-lg font-extrabold text-govNavy">
                    {rec.voyages} × {rec.vessel_class} ({
                      isHi 
                        ? (rec.contract_structure === 'spot' ? 'स्पॉट' : rec.contract_structure === 'coa' ? 'सीओए अनुबंध' : rec.contract_structure === 'time_charter' ? 'टाइम चार्टर' : rec.contract_structure.replace(/_/g, ' '))
                        : rec.contract_structure.replace(/_/g, ' ')
                    })
                  </h2>
                  <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-300 uppercase">
                    {isHi ? 'सर्वोत्तम निर्णय' : 'Optimal Decision'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">
                  {isHi ? 'अनुशंसित अनुबंध खिड़की' : 'Recommended Fix Window'}
                </span>
                <span className="text-xs font-mono font-bold text-govNavy">
                  {rec.charter_window?.start} → {rec.charter_window?.end}
                </span>
              </div>
            </div>

            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
              <div className="p-2.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">
                  {isHi ? 'अपेक्षित लैंडेड लागत' : 'Expected Landed Cost'}
                </span>
                <strong className="text-sm font-extrabold text-govNavy font-mono block mt-0.5">
                  ${Math.round(rec.expected_cost_usd).toLocaleString()}
                </strong>
                <span className="text-[9px] text-slate-400 font-mono">
                  (₹{Math.round(rec.expected_cost_inr / 1e7).toFixed(1)} {isHi ? 'करोड़' : 'Cr'})
                </span>
              </div>

              <div className="p-2.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">
                  {isHi ? 'भाड़ा / टन' : 'Freight / Tonne'}
                </span>
                <strong className="text-sm font-extrabold text-govNavy font-mono block mt-0.5">
                  ${rec.expected_usd_per_tonne ? rec.expected_usd_per_tonne.toFixed(2) : '—'} / {isHi ? 'टन' : 't'}
                </strong>
                <span className="text-[9px] text-emerald-700 font-semibold">
                  {isHi ? 'प्रतिस्पर्धी लैंडेड दर' : 'Competitive landed'}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">
                  {isHi ? 'जोखिम-समायोजित लागत' : 'Risk-Adjusted Cost'}
                </span>
                <strong className="text-sm font-extrabold text-blue-900 font-mono block mt-0.5">
                  ${Math.round(rec.risk_adjusted_cost_usd).toLocaleString()}
                </strong>
                <span className="text-[9px] text-slate-500 font-mono">λ = {riskAversion.toFixed(2)}</span>
              </div>

              <div className="p-2.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">
                  {isHi ? '80% विश्वास अंतराल' : '80% Confidence Band'}
                </span>
                <strong className="text-xs font-bold text-slate-700 font-mono block mt-0.5">
                  ${(rec.interval_80_usd[0] / 1e6).toFixed(2)}M – ${(rec.interval_80_usd[1] / 1e6).toFixed(2)}M
                </strong>
                <span className="text-[9px] text-slate-400">{isHi ? 'P10 से P90' : 'P10 to P90'}</span>
              </div>

              <div
                onClick={() => onNavigate && onNavigate('simulator')}
                className="p-2.5 bg-white rounded border border-slate-200 hover:border-govNavy cursor-pointer transition group"
                title={isHi ? 'मोंटे कार्लो रणनीति सिम्युलेटर खोलने हेतु क्लिक करें' : 'Click to open Monte Carlo Strategy Simulator'}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 block">
                    {isHi ? 'समय-सीमा चूक जोखिम' : 'Deadline Miss Risk'}
                  </span>
                  <span className="text-[9px] text-govNavy font-semibold opacity-0 group-hover:opacity-100 transition">
                    {isHi ? 'जांचें →' : 'Inspect →'}
                  </span>
                </div>
                <strong className={`text-sm font-extrabold font-mono block mt-0.5 ${
                  rec.p_deadline_miss > 0.10 ? 'text-rose-600' : 'text-emerald-700'
                }`}>
                  {(rec.p_deadline_miss * 100).toFixed(1)}%
                </strong>
                <span className="text-[9px] text-slate-400 group-hover:text-govNavy font-medium">
                  {isHi ? 'मोंटे कार्लो सिमुलेशन' : 'Monte Carlo Sim'}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-500 block">
                  {isHi ? 'अवसर स्कोर (COS)' : 'Opportunity Score (COS)'}
                </span>
                <strong className="text-sm font-extrabold text-govNavy font-mono block mt-0.5">
                  {rec.charter_opportunity_score ? `${Math.round(rec.charter_opportunity_score)} / 100` : '—'}
                </strong>
                <span className="text-[9px] text-emerald-700 font-semibold uppercase">
                  {opp?.verdict 
                    ? (isHi 
                        ? (opp.verdict.toLowerCase().includes('charter') ? 'तत्काल चार्टर करें' : 'प्रतीक्षा करें एवं देखें')
                        : opp.verdict.replace('_', ' ')) 
                    : (isHi ? 'तत्काल चार्टर करें' : 'Charter Now')}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Why This Decision? (Backend Authoritative Reasoning) */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                {isHi ? 'यह निर्णय क्यों? (प्रामाणिक प्रणाली व्याख्यात्मकता)' : 'Why This Decision? (Authoritative Backend Explainability)'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {result.explanation && result.explanation.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-2 p-2 bg-slate-50 rounded border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700 leading-snug">{item}</span>
                </div>
              ))}
            </div>

            {opp?.note && (
              <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200 text-xs text-govNavy mt-2">
                <strong>{isHi ? 'बाजार समय अंतर्दृष्टि: ' : 'Market Timing Insight: '}</strong>
                <span>{opp.note}</span>
              </div>
            )}
          </div>

          {/* Section: Cost Breakdown & Sensitivity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Cost Breakdown Table (Col 6) */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
                  {isHi ? 'मदवार यात्रा लागत विवरण' : 'Itemized Voyage Cost Breakdown'}
                </h3>
                <span className="text-[10px] font-mono text-slate-500">USD</span>
              </div>

              {breakdown && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left gov-table">
                    <thead>
                      <tr>
                        <th>{isHi ? 'लागत घटक' : 'Cost Component'}</th>
                        <th className="text-right">{isHi ? 'अनुमानित USD' : 'Estimated USD'}</th>
                        <th className="text-right">{isHi ? 'हिस्सा (%)' : 'Share (%)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      <tr>
                        <td className="font-semibold text-slate-800">{isHi ? 'महासागर भाड़ा किराया (Ocean Freight)' : 'Ocean Freight Hire'}</td>
                        <td className="text-right">${Math.round(breakdown.freight || 0).toLocaleString()}</td>
                        <td className="text-right">{((breakdown.freight / breakdown.total) * 100).toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800">{isHi ? 'बंदरगाह शुल्क एवं टर्मिनल प्रभार' : 'Port Dues & Terminal Charges'}</td>
                        <td className="text-right">${Math.round(breakdown.port_costs || 0).toLocaleString()}</td>
                        <td className="text-right">{((breakdown.port_costs / breakdown.total) * 100).toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800">{isHi ? 'ले-टाइम के भीतर प्रतीक्षा समय' : 'Waiting Time Inside Laytime'}</td>
                        <td className="text-right">${Math.round(breakdown.waiting || 0).toLocaleString()}</td>
                        <td className="text-right">{((breakdown.waiting / breakdown.total) * 100).toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="font-semibold text-slate-800">{isHi ? 'अपेक्षित विलंब शुल्क (Demurrage) दावे' : 'Expected Demurrage Claims'}</td>
                        <td className="text-right">${Math.round(breakdown.expected_demurrage || 0).toLocaleString()}</td>
                        <td className="text-right">{((breakdown.expected_demurrage / breakdown.total) * 100).toFixed(1)}%</td>
                      </tr>
                      {breakdown.lighterage > 0 && (
                        <tr>
                          <td className="font-semibold text-amber-800">{isHi ? 'सैंडहेड्स लाइटरज एवं बार्ज' : 'Sandheads Lighterage & Barge'}</td>
                          <td className="text-right font-bold text-amber-800">${Math.round(breakdown.lighterage).toLocaleString()}</td>
                          <td className="text-right">{((breakdown.lighterage / breakdown.total) * 100).toFixed(1)}%</td>
                        </tr>
                      )}
                      <tr>
                        <td className="font-semibold text-slate-800">{isHi ? 'बैलास्ट एवं पुनर्संस्थापन लागत' : 'Ballast & Repositioning Cost'}</td>
                        <td className="text-right">${Math.round(breakdown.repositioning || 0).toLocaleString()}</td>
                        <td className="text-right">{((breakdown.repositioning / breakdown.total) * 100).toFixed(1)}%</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold text-govNavy border-t-2 border-slate-300">
                        <td>{isHi ? 'कुल लैंडेड यात्रा लागत' : 'TOTAL LANDED VOYAGE COST'}</td>
                        <td className="text-right">${Math.round(breakdown.total || 0).toLocaleString()}</td>
                        <td className="text-right">100.0%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right: Sensitivity Tornado (Col 6) */}
            <div className="lg:col-span-6">
              <TornadoChart
                sensitivity={rec.sensitivity || optResponse?.sensitivity}
                breakdown={breakdown}
                totalCost={rec.expected_cost_usd}
              />
            </div>
          </div>

          {/* Section: Next Step Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <span className="text-slate-600">
              {isHi 
                ? 'क्या आप सभी पोत विकल्पों की तुलना करना चाहते हैं या सभी रणनीतियों का सिमुलेशन करना चाहते हैं?' 
                : 'Want to compare all physical vessel options or simulate all strategy variations?'}
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onNavigate('vessels')}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded text-govNavy font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                {isHi ? 'पोत अनुकूलक में देखें' : 'Inspect in Vessel Optimizer'}
              </button>
              <button
                onClick={() => onNavigate('simulator')}
                className="px-3 py-1.5 bg-govNavy text-white rounded font-semibold hover:bg-govNavyLight transition cursor-pointer"
              >
                {isHi ? 'रणनीति सिम्युलेटर खोलें' : 'Open Strategy Simulator'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
