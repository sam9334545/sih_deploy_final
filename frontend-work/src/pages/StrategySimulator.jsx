import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  RotateCcw, 
  Sliders, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  TrendingUp, 
  Layers, 
  Ship, 
  DollarSign,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import DecisionWorkflowBanner from '../components/DecisionWorkflowBanner';
import CostDistributionChart from '../components/CostDistributionChart';
import TornadoChart from '../components/TornadoChart';
import { simulateStrategy, ApiError } from '../api';
import { useLanguage } from '../context/LanguageContext';

const LOAD_PORTS = [
  { id: 'AUHPT', name: 'Hay Point (Australia)', hiName: 'हे पॉइंट (ऑस्ट्रेलिया)', cargo: 'coking_coal' },
  { id: 'AUGLT', name: 'Gladstone (Australia)', hiName: 'ग्लैडस्टोन (ऑस्ट्रेलिया)', cargo: 'coking_coal' },
  { id: 'IDTBA', name: 'Taboneo (Indonesia)', hiName: 'ताबानेओ (इंडोनेशिया)', cargo: 'thermal_coal' },
  { id: 'ZARBY', name: 'Richards Bay (South Africa)', hiName: 'रिचर्ड्स बे (दक्षिण अफ्रीका)', cargo: 'thermal_coal' },
  { id: 'USHAM', name: 'Hampton Roads (USA)', hiName: 'हैम्पटन रोड्स (यूएसए)', cargo: 'coking_coal' },
  { id: 'MZBEW', name: 'Beira (Mozambique)', hiName: 'बेइरा (मोजाम्बिक)', cargo: 'coking_coal' },
];

const DISCHARGE_PORTS = [
  { id: 'INPRT', name: 'Paradip Port (INPRT)', hiName: 'पारादीप बंदरगाह (INPRT)', state: 'Odisha' },
  { id: 'INVTZ', name: 'Visakhapatnam (INVTZ)', hiName: 'विशाखापट्टनम बंदरगाह (INVTZ)', state: 'Andhra Pradesh' },
  { id: 'INDHA', name: 'Dhamra Port (INDHA)', hiName: 'धामरा बंदरगाह (INDHA)', state: 'Odisha' },
  { id: 'INGGV', name: 'Gangavaram (INGGV)', hiName: 'गंगावरम बंदरगाह (INGGV)', state: 'Andhra Pradesh' },
  { id: 'INHAL', name: 'Haldia Dock Complex (INHAL)', hiName: 'हल्दिया डॉक कॉम्प्लेक्स (INHAL)', state: 'West Bengal' },
  { id: 'INGPR', name: 'Gopalpur Port (INGPR)', hiName: 'गोपालपुर बंदरगाह (INGPR)', state: 'Odisha' },
];

export default function StrategySimulator({ onNavigate }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';

  // Input simulation controls
  const [cargoType, setCargoType] = useState('coking_coal');
  const [quantityT, setQuantityT] = useState(120000);
  const [originPort, setOriginPort] = useState('AUHPT');
  const [destinationPort, setDestinationPort] = useState('INPRT');
  const [deadlineDays, setDeadlineDays] = useState(60);
  const [riskAversion, setRiskAversion] = useState(0.5); // lambda
  const [nSimulations, setNSimulations] = useState(1000);
  const [simSeed, setSimSeed] = useState(42);

  // UX states
  const [status, setStatus] = useState('initial');
  const [simResponse, setSimResponse] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);
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
    runSimulation();
  }, [riskAversion, deadlineDays, cargoType, quantityT, originPort, destinationPort]);

  async function runSimulation() {
    const currentReqId = ++reqIdRef.current;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const requiredBy = computeRequiredBy(deadlineDays);
      const res = await simulateStrategy({
        cargoType,
        quantityT: Number(quantityT),
        originPort,
        destinationPort,
        requiredBy,
        asOf: asOfDate,
        riskAversion: Number(riskAversion),
        deadlinePenaltyUsd: 500000,
        nSimulations: Number(nSimulations),
        seed: simSeed,
        strategies: ['auto'],
      });

      if (currentReqId !== reqIdRef.current) return;
      setSimResponse(res);
      setSelectedStrategyId(res.winner || (res.results && res.results[0]?.id));
      setStatus('success');
    } catch (err) {
      if (currentReqId !== reqIdRef.current) return;
      console.error('[Simulation Error]:', err);
      setStatus('error');
      setSimResponse(null);
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : (isHi ? 'मोंटे कार्लो रणनीति सिमुलेशन चलाने में विफल।' : 'Failed to run Monte Carlo strategy simulation.')
      );
    }
  }

  const results = simResponse?.results || [];
  const infeasible = simResponse?.infeasible || [];
  const winnerId = simResponse?.winner;
  const activeStrategy = results.find(r => r.id === selectedStrategyId) || results[0];

  const handleBannerNavigate = (tab) => {
    if (tab === 'simulator') {
      runSimulation();
    }
    if (onNavigate) onNavigate(tab);
  };

  return (
    <div className="space-y-4">
      {/* 1. Decision Workflow Banner */}
      <DecisionWorkflowBanner currentStep="simulation" onNavigate={handleBannerNavigate} />

      {/* 2. Top Header Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-govBlueAccent" />
            <h1 className="text-base font-bold text-govNavy font-serif">
              {isHi ? 'चार्टर रणनीति सिम्युलेटर एवं डिजिटल ट्विन (मोंटे कार्लो इंजन)' : 'Charter Strategy Simulator & Digital Twin (Monte Carlo Engine)'}
            </h1>
            <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
              {isHi ? 'प्रमुख प्रणाली यूएसपी' : 'Primary System USP'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isHi 
              ? 'CVaR टेल जोखिम, अनुसूची अनिश्चितता और जोखिम-समायोजित लैंडेड लागत का मूल्यांकन करने के लिए प्रति रणनीति 1,000+ स्टोकेस्टिक पुनरावृत्तियों का अनुकरण करें।'
              : 'Simulate 1,000+ stochastic realizations per charter strategy to evaluate CVaR tail risk, schedule uncertainty, and risk-adjusted landed cost.'}
          </p>
        </div>
        <ProvenanceBadge type="DERIVED" text={isHi ? 'मोंटे कार्लो डिजिटल ट्विन' : 'Monte Carlo Digital Twin'} />
      </div>

      {/* 3. Interactive Scenario & Risk Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-2">
            <Sliders className="w-3.5 h-3.5 text-govNavy" />
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              {isHi ? 'स्टोकेस्टिक सिमुलेशन नियंत्रण एवं जोखिम-प्रतिरोध (λ)' : 'Stochastic Simulation Controls & Risk-Aversion (λ)'}
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            {isHi ? 'रनटाइम:' : 'Runtime:'} {simResponse?.runtime_ms ? `${simResponse.runtime_ms} ms` : '—'} · N = {nSimulations} {isHi ? 'रन' : 'runs'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'कार्गो वस्तु (Commodity)' : 'Cargo Commodity'}
            </label>
            <select
              value={cargoType}
              onChange={(e) => handleCargoChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              <option value="coking_coal">{isHi ? 'कोकिंग कोल (AUHPT)' : 'Coking Coal (AUHPT)'}</option>
              <option value="thermal_coal">{isHi ? 'थर्मल कोल (IDTBA)' : 'Thermal Coal (IDTBA)'}</option>
              <option value="iron_ore">{isHi ? 'लौह अयस्क (Lump / Fines)' : 'Iron Ore (Lump / Fines)'}</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'कार्गो टन भार (टन)' : 'Cargo Tonnage (t)'}
            </label>
            <input
              type="number"
              value={quantityT}
              step="5000"
              onChange={(e) => setQuantityT(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-mono text-slate-800 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'लोडिंग पोर्ट (मूल स्रोत)' : 'Loading Port'}
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

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'डिस्चार्ज पोर्ट (भारत पूर्वी तट)' : 'Discharge Port'}
            </label>
            <select
              value={destinationPort}
              onChange={(e) => setDestinationPort(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none"
            >
              {DISCHARGE_PORTS.map((p) => (
                <option key={p.id} value={p.id}>{isHi && p.hiName ? p.hiName : p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              {isHi ? 'लेकैन समय-सीमा:' : 'Laycan Deadline:'}{' '}
              <strong className="font-mono text-govNavy">{deadlineDays} {isHi ? 'दिन' : 'days'}</strong>
            </label>
            <input
              type="range"
              min="25"
              max="150"
              step="5"
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Number(e.target.value))}
              className="w-full accent-govNavy cursor-pointer mt-1"
            />
          </div>

          {/* Interactive Risk Aversion Slider (0 to 1) */}
          <div className="bg-blue-50/70 p-2 rounded border border-blue-200">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-govNavy">{isHi ? 'जोखिम प्रतिरोध (λ):' : 'Risk Aversion (λ):'}</span>
              <strong className="font-mono text-govNavy text-xs font-extrabold">{riskAversion.toFixed(2)}</strong>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={riskAversion}
              onChange={(e) => setRiskAversion(Number(e.target.value))}
              className="w-full accent-govNavy cursor-pointer mt-1"
            />
            <div className="flex justify-between text-[8px] text-slate-500 mt-0.5 font-medium">
              <span>{isHi ? 'तटस्थ (0)' : 'Neutral (0)'}</span>
              <span>{isHi ? 'संतुलित (0.5)' : 'Balanced (0.5)'}</span>
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

        {/* Simulation Execution CTA Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-slate-700 text-[11px]">
                {isHi ? 'मोंटे कार्लो पुनरावृत्तियां (N):' : 'Monte Carlo Iterations (N):'}
              </span>
              <select
                value={nSimulations}
                onChange={(e) => setNSimulations(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono text-xs text-slate-800 focus:bg-white"
              >
                <option value={200}>{isHi ? '200 रन (त्वरित ड्राफ्ट)' : '200 runs (Fast draft)'}</option>
                <option value={500}>{isHi ? '500 रन (मानक परिचालन)' : '500 runs (Standard operational)'}</option>
                <option value={1000}>{isHi ? '1,000 रन (संस्थागत सटीकता)' : '1,000 runs (Institutional precision)'}</option>
                <option value={2500}>{isHi ? '2,500 रन (गहन स्ट्रेस टेस्टिंग)' : '2,500 runs (Deep stress testing)'}</option>
              </select>
            </div>
            <div className="text-[11px] text-slate-400">
              {isHi 
                ? 'भाड़ा दरों, बंकर अस्थिरता और पोर्ट कतारों में संयुक्त स्टोकेस्टिक झटके।' 
                : 'Joint stochastic shocks across freight rates, bunker volatilities & port queues.'}
            </div>
          </div>

          <button
            id="run-monte-carlo-btn"
            onClick={() => runSimulation()}
            disabled={status === 'loading'}
            className="px-5 py-2.5 bg-govNavy text-white hover:bg-govNavyLight disabled:opacity-50 transition rounded font-bold text-xs flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${status === 'loading' ? 'animate-spin' : ''}`} />
            <span>
              {status === 'loading' 
                ? (isHi ? 'मोंटे कार्लो सिमुलेशन निष्पादित हो रहा है...' : 'Executing Monte Carlo Sim...') 
                : (isHi ? 'मोंटे कार्लो सिमुलेशन निष्पादित करें' : 'EXECUTE MONTE CARLO SIMULATION')}
            </span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 rounded p-3 text-xs text-rose-800">
          {errorMessage}
        </div>
      )}

      {/* 4. Strategy Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-2.5">
          <div>
            <h3 className="text-xs font-bold text-govNavy uppercase tracking-wide">
              {isHi ? 'स्टोकेस्टिक रणनीति तुलना एवं टेल जोखिम रैंकिंग' : 'Stochastic Strategy Comparison & Tail Risk Ranking'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isHi 
                ? 'बैकएंड जोखिम-समायोजित लैंडेड लागत द्वारा सख्त क्रमबद्धता: अपेक्षित लागत + λ × (CVaR-90 − माध्य) + P(विलंब) × पेनल्टी।'
                : 'Ranked strictly by backend risk-adjusted landed cost: Expected Cost + λ × (CVaR-90 − Mean) + P(late) × Penalty.'}
            </p>
          </div>
          <div className="flex items-center space-x-2 text-[10px]">
            <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded font-bold uppercase">
              {isHi ? 'प्रामाणिक बैकएंड विजेता:' : 'Authoritative Backend Winner:'} {winnerId || '—'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left gov-table border-collapse">
            <thead>
              <tr>
                <th>{isHi ? 'रणनीति ID' : 'Strategy ID'}</th>
                <th>{isHi ? 'रणनीति विन्यास' : 'Strategy Configuration'}</th>
                <th>{isHi ? 'पोत वर्ग' : 'Vessel Class'}</th>
                <th className="text-right">{isHi ? 'अपेक्षित लागत (माध्य)' : 'Expected Cost (Mean)'}</th>
                <th className="text-right">{isHi ? 'P90 सीमा' : 'P90 Bound'}</th>
                <th className="text-right">{isHi ? 'CVaR-90 (टेल)' : 'CVaR-90 (Tail)'}</th>
                <th className="text-right">{isHi ? 'विलंब जोखिम' : 'Late Risk'}</th>
                <th className="text-right">{isHi ? 'जोखिम-समायोजित लागत' : 'Risk-Adjusted Cost'}</th>
                <th className="text-center">{isHi ? 'कार्रवाई' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {results.length > 0 ? (
                results.map((r) => {
                  const isWinner = r.id === winnerId;
                  const isSelected = r.id === selectedStrategyId;
                  const c = r.cost || {};

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedStrategyId(r.id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50/80 font-semibold'
                          : isWinner
                          ? 'bg-emerald-50/40'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="font-bold text-slate-800">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            isWinner ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {r.id}
                          </span>
                          {isWinner && (
                            <Award className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                      </td>
                      <td className="font-sans">
                        <span className="font-semibold text-slate-800 block">{r.label}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {r.voyages} {isHi ? 'यात्राएं' : 'voy'} · {r.structure} · {r.execution}
                        </span>
                      </td>
                      <td className="font-sans font-medium text-slate-700">{r.vessel_class}</td>
                      <td className="text-right">${Math.round(c.mean || 0).toLocaleString()}</td>
                      <td className="text-right text-slate-600">${Math.round(c.p90 || 0).toLocaleString()}</td>
                      <td className="text-right text-rose-700 font-bold">${Math.round(c.cvar_90 || 0).toLocaleString()}</td>
                      <td className={`text-right ${r.p_deadline_miss > 0.05 ? 'text-rose-600 font-bold' : 'text-emerald-700'}`}>
                        {(r.p_deadline_miss * 100).toFixed(1)}%
                      </td>
                      <td className="text-right font-extrabold text-govNavy text-sm">
                        ${Math.round(r.risk_adjusted_cost || 0).toLocaleString()}
                      </td>
                      <td className="text-center font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStrategyId(r.id);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                            isSelected
                              ? 'bg-govNavy text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? (isHi ? 'जांच जारी' : 'Inspecting') : (isHi ? 'जांचें' : 'Inspect')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-400 font-sans">
                    {status === 'loading' 
                      ? (isHi ? 'सभी उम्मीदवार वर्गों पर सिमुलेशन चल रहा है...' : 'Running simulation runs across all candidate classes...') 
                      : (isHi ? 'कोई सिमुलेशन परिणाम उपलब्ध नहीं हैं।' : 'No simulation results available.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Strategy Cost Distribution Chart (P10, P50, P90, Mean, CVaR 90%) */}
      {results.length > 0 && (
        <CostDistributionChart results={results} winnerId={winnerId} />
      )}

      {/* 6. Selected Strategy Detailed Inspection & Sensitivity */}
      {activeStrategy && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Active Strategy Details & Cost Breakdown (Col 6) */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">
                  {isHi ? 'विस्तृत रणनीति डोजियर' : 'Detailed Strategy Dossier'}
                </span>
                <h4 className="text-sm font-bold text-govNavy">
                  {activeStrategy.id}: {activeStrategy.label}
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-govNavy">
                ${activeStrategy.usd_per_tonne ? activeStrategy.usd_per_tonne.toFixed(2) : '—'} / {isHi ? 'टन' : 't'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">{isHi ? 'कुल दिन' : 'Total Days'}</span>
                <strong className="text-slate-800">
                  {activeStrategy.total_days ? `${activeStrategy.total_days.toFixed(1)} ${isHi ? 'दिन' : 'd'}` : '—'}
                </strong>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">{isHi ? 'निष्क्रिय समय' : 'Idle Time'}</span>
                <strong className="text-slate-800">
                  {activeStrategy.idle_days ? `${activeStrategy.idle_days.toFixed(1)} ${isHi ? 'दिन' : 'd'}` : `0.0 ${isHi ? 'दिन' : 'd'}`}
                </strong>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">{isHi ? 'निष्क्रिय लागत' : 'Idle Cost'}</span>
                <strong className="text-slate-800">${Math.round(activeStrategy.idle_cost_usd || 0).toLocaleString()}</strong>
              </div>
              <div className="p-2 bg-slate-50 rounded border border-slate-100">
                <span className="text-[9px] text-slate-500 block font-sans">{isHi ? 'लागत मानक विचलन' : 'Cost Std Dev'}</span>
                <strong className="text-slate-800">${Math.round(activeStrategy.cost?.std || 0).toLocaleString()}</strong>
              </div>
            </div>

            {/* Notes / Caveats from Backend */}
            {activeStrategy.notes && activeStrategy.notes.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">
                  {isHi ? 'परिचालन प्रेक्षण:' : 'Operational Observations:'}
                </span>
                {activeStrategy.notes.map((note, idx) => (
                  <div key={idx} className="p-2 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start space-x-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 mt-0.5" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Sensitivity Tornado for Selected Strategy (Col 6) */}
          <div className="lg:col-span-6">
            <TornadoChart
              sensitivity={(activeStrategy.sensitivity && activeStrategy.sensitivity.length > 0) ? activeStrategy.sensitivity : simResponse?.sensitivity}
              breakdown={activeStrategy.breakdown}
              totalCost={activeStrategy.cost?.mean}
            />
          </div>
        </div>
      )}

      {/* 7. Infeasible Strategies Registry (if any) */}
      {infeasible.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
            {isHi 
              ? `छंटाई किए गए / अव्यवहार्य वैकल्पिक विकल्प (${infeasible.length})` 
              : `Pruned / Infeasible Alternative Options (${infeasible.length})`}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {infeasible.map((inf, i) => (
              <div key={i} className="p-2 bg-white rounded border border-slate-200">
                <span className="font-semibold text-slate-800 block">{inf.label || inf.id}</span>
                <span className="text-[10px] text-rose-600 block mt-0.5">
                  {isHi ? 'प्रतिबंध:' : 'Constraint:'} {inf.reason}
                </span>
                <p className="text-[10px] text-slate-500 mt-0.5">{inf.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
