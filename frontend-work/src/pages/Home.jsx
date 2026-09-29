import React from 'react';
import { 
  Compass, 
  TrendingUp, 
  Anchor, 
  Ship, 
  Layers, 
  ShieldAlert, 
  ArrowRight, 
  BarChart2, 
  Navigation, 
  FileText, 
  Info, 
  Globe, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  MapPin,
  Calendar,
  Activity,
  Cpu
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import bulkCarrierImg from '../assets/bulk_carrier_hero.jpg';

export default function Home({ onNavigate }) {
  const { t, lang } = useLanguage();
  // 6 Authoritative Global Origins supported by SIH26006 registry
  const supportedOrigins = [
    {
      code: 'AUHPT',
      name: 'Hay Point',
      country: 'Australia',
      cargos: 'Coking Coal, Thermal Coal',
      primaryVessels: 'Capesize, Panamax',
      region: 'Oceania',
      notes: 'Deepwater offshore terminal, high loading rates',
    },
    {
      code: 'AUGLT',
      name: 'Gladstone',
      country: 'Australia',
      cargos: 'Coking Coal, Thermal Coal',
      primaryVessels: 'Capesize, Panamax',
      region: 'Oceania',
      notes: 'Multi-berth coal export hub, RG Tanna terminal',
    },
    {
      code: 'IDTBA',
      name: 'Taboneo',
      country: 'Indonesia',
      cargos: 'Thermal Coal Only',
      primaryVessels: 'Supramax, Panamax',
      region: 'Southeast Asia',
      notes: 'Offshore anchorage transshipment with floating cranes',
    },
    {
      code: 'ZARBY',
      name: 'Richards Bay',
      country: 'South Africa',
      cargos: 'Coking Coal, Thermal Coal',
      primaryVessels: 'Capesize, Panamax',
      region: 'Africa',
      notes: 'RBCT terminal, major source for Indian power & steel',
    },
    {
      code: 'USHAM',
      name: 'Hampton Roads',
      country: 'United States',
      cargos: 'Coking Coal Only',
      primaryVessels: 'Panamax, Capesize',
      region: 'North America',
      notes: 'East Coast US coal export piers (Lamberts Point / Pier IX)',
    },
    {
      code: 'MZBEW',
      name: 'Beira',
      country: 'Mozambique',
      cargos: 'Coking Coal',
      primaryVessels: 'Handysize',
      region: 'Africa',
      notes: 'Draft-constrained channel (max ~50k DWT), tidal entry',
    },
  ];

  // Core Decision Support Services
  const coreServices = [
    {
      id: 'forecast',
      title: t('tab_forecast'),
      subtitle: lang === 'hi' ? 'अनिश्चितता अंतरालों के साथ संभाव्य बाल्टिक ड्राई-थोक भाड़ा पूर्वानुमान।' : 'Probabilistic Baltic dry-bulk freight forecasts with uncertainty intervals.',
      desc: lang === 'hi' ? 'विभाजित-कॉन्फ़ॉर्मल 80% अंशांकन अंतरालों के साथ BCI, BPI, BSI और BHSI हेतु 7 से 180 दिन के क्षितिजों पर एन्सेम्बल पूर्वानुमान।' : 'Ensemble forecasting (Ridge + Damped Momentum + LightGBM v2) across 7, 14, 28, 60, 90, 180 day horizons for BCI, BPI, BSI, and BHSI with split-conformal 80% calibration intervals.',
      icon: TrendingUp,
      cta: lang === 'hi' ? 'पूर्वानुमान खोलें →' : 'Open Forecast →',
      badge: 'ML Engine v2',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      id: 'planner',
      title: t('tab_planner'),
      subtitle: lang === 'hi' ? 'कार्गो आवश्यकताओं, बंदरगाह सीमाओं और पोत व्यवहार्यता को चार्टर विकल्पों में परिवर्तित करें।' : 'Translate cargo requirements, port constraints and vessel feasibility into charter options.',
      desc: lang === 'hi' ? 'पोत क्षमता, लाइटरिंग सीमाओं और लैंडेड लागत अनुकूलन के साथ मात्रा, वस्तु, स्रोत और लेकैन का मिलान करने वाला एंड-टू-एंड अधिप्राप्ति ऑर्केस्ट्रेटर।' : 'End-to-end procurement orchestrator matching quantity, commodity, origin and laycan with vessel capacity, lighterage constraints, and landed cost optimization.',
      icon: Compass,
      cta: lang === 'hi' ? 'चार्टर योजना बनाएं →' : 'Plan a Charter →',
      badge: lang === 'hi' ? 'प्रमुख कार्यप्रवाह' : 'Core Workflow',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'ports',
      title: t('tab_ports'),
      subtitle: lang === 'hi' ? 'गंतव्य-बंदरगाह सीमाओं और परिचालन व्यवहार्यता का अन्वेषण करें।' : 'Explore destination-port constraints and operational feasibility.',
      desc: lang === 'hi' ? 'चैनल गहराई, ड्राफ्ट सीमा, बर्थ आयाम, यांत्रिक हैंडलिंग दर और प्रतीक्षा टेलीमेट्री को कवर करने वाली 14 संदर्भ बंदरगाहों की आधिकारिक रजिस्ट्री।' : 'Authoritative terminal constraint registry for 14 reference ports covering channel depths, draft limits, berth dimensions, mechanical handling rates, and waiting telemetry.',
      icon: Anchor,
      cta: lang === 'hi' ? 'बंदरगाह देखें →' : 'Explore Ports →',
      badge: lang === 'hi' ? '14 संदर्भ बंदरगाह' : '14 Reference Ports',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    },
    {
      id: 'vessels',
      title: t('tab_vessels'),
      subtitle: lang === 'hi' ? 'कार्गो और यात्रा बाधाओं के विरुद्ध पोत-वर्ग व्यवहार्यता का मूल्यांकन करें।' : 'Evaluate vessel-class feasibility against cargo and voyage constraints.',
      desc: lang === 'hi' ? 'मानक बाल्टिक पोत वर्ग विनिर्देश (Handysize, Supramax, Panamax, Capesize) बंकर ईंधन खपत प्रोफाइल और डेडवेट क्षमता सहित।' : 'Standard Baltic vessel class specifications (Handysize, Supramax, Panamax, Capesize) with laden/ballast bunker consumption profiles, deadweight ranges, and parcel sizing.',
      icon: Ship,
      cta: lang === 'hi' ? 'पोत मूल्यांकन करें →' : 'Evaluate Vessels →',
      badge: 'Baltic Profiles',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      id: 'simulator',
      title: t('tab_simulator'),
      subtitle: lang === 'hi' ? 'मोंटे कार्लो सिमुलेशन और जोखिम-समायोजित अर्थशास्त्र का उपयोग करके रणनीतियों की तुलना करें।' : 'Compare charter strategies using Monte Carlo simulation and risk-adjusted economics.',
      desc: lang === 'hi' ? 'स्पॉट बनाम सीओए बनाम टाइम चार्टर रणनीतियों पर 200 से 5,000 संभाव्य ड्रा का अनुकरण, CVaR-90 और डिलीवरी विलंब जोखिम की गणना।' : 'Simulate Spot vs. COA vs. Time Charter strategies over 200 to 5,000 stochastic draws, computing CVaR-90, expected landed cost, and deadline breach probability under risk aversion.',
      icon: Layers,
      cta: lang === 'hi' ? 'सिमुलेशन चलाएं →' : 'Run Simulation →',
      badge: 'Monte Carlo N=5000',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 'risks',
      title: t('tab_risks'),
      subtitle: lang === 'hi' ? 'अधिप्राप्ति निर्णयों से संबंधित परिचालन और बाजार जोखिमों की समीक्षा करें।' : 'Review operational and market risks relevant to procurement decisions.',
      desc: lang === 'hi' ? 'मानसून मौसम गतिरोध, बंदरगाह संकुलन, बंकर अस्थिरता और मौसमी चक्रवात कारकों को कवर करने वाला बहुभिन्नरूपी परिचालन जोखिम स्कोरिंग।' : 'Multivariate operational risk scoring covering monsoon weather stoppage climatology, port congestion detention, bunker volatility, and seasonal cyclone factors.',
      icon: ShieldAlert,
      cta: lang === 'hi' ? 'जोखिम देखें →' : 'View Risks →',
      badge: lang === 'hi' ? 'व्याख्यात्मक जोखिम' : 'Explainable Risk',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    },
  ];

  // 7-Step Workflow Pipeline
  const workflowSteps = [
    {
      num: '01',
      title: t('wf_step1_title'),
      detail: t('wf_step1_desc'),
      tab: 'planner',
    },
    {
      num: '02',
      title: t('wf_step2_title'),
      detail: t('wf_step2_desc'),
      tab: 'forecast',
    },
    {
      num: '03',
      title: t('wf_step3_title'),
      detail: t('wf_step3_desc'),
      tab: 'ports',
    },
    {
      num: '04',
      title: t('wf_step4_title'),
      detail: t('wf_step4_desc'),
      tab: 'vessels',
    },
    {
      num: '05',
      title: t('wf_step5_title'),
      detail: t('wf_step5_desc'),
      tab: 'simulator',
    },
    {
      num: '06',
      title: t('wf_step6_title'),
      detail: t('wf_step6_desc'),
      tab: 'simulator',
    },
    {
      num: '07',
      title: t('wf_step7_title'),
      detail: t('wf_step7_desc'),
      tab: 'planner',
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION                                                          */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200/90 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        {/* Subtle decorative maritime background lines */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-slate-50/30 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: System Identity, Headline, & Primary CTAs */}
          <div className="lg:col-span-6 space-y-4">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-semibold text-govBlueAccent">
              <span className="w-1.5 h-1.5 rounded-full bg-govBlueAccent animate-pulse" />
              <span>{t('hero_ministry_pill')}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-govNavyDark tracking-tight font-serif leading-tight">
              {t('hero_headline')}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              {t('hero_subtitle')}
            </p>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate('planner')}
                className="px-5 py-2.5 bg-govNavy hover:bg-govNavyDark text-white text-xs font-semibold rounded shadow-sm hover:shadow transition flex items-center space-x-2 cursor-pointer"
              >
                <span>{t('hero_cta_plan')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('forecast')}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 text-govNavy border border-slate-300 hover:border-govNavy text-xs font-semibold rounded transition flex items-center space-x-2 cursor-pointer shadow-2xs"
              >
                <TrendingUp className="w-4 h-4 text-govBlueAccent" />
                <span>{t('hero_cta_forecast')}</span>
              </button>

              <button
                onClick={() => onNavigate('market')}
                className="px-3.5 py-2.5 text-slate-600 hover:text-govNavy text-xs font-medium hover:underline transition flex items-center space-x-1.5 cursor-pointer"
              >
                <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('hero_cta_market')}</span>
              </button>
            </div>

            {/* Feature highlights pill strip */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-y-2 gap-x-4 text-[11px] text-slate-500">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('hero_feat_ports')}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('hero_feat_corridors')}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('hero_feat_forecast')}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('hero_feat_conformal')}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Institutional Maritime Trade Visual Card */}
          <div className="lg:col-span-6">
            <div className="bg-gradient-to-b from-slate-50 to-blue-50/50 rounded-lg border border-slate-200/90 shadow-sm p-4 space-y-3">
              {/* Institutional Card Header */}
              <div className="border-b border-slate-200 pb-2.5 flex items-start justify-between">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {t('card_ministry')}
                  </div>
                  <div className="text-xs font-bold text-govNavy uppercase tracking-wide flex items-center space-x-1.5 mt-0.5">
                    <Anchor className="w-3.5 h-3.5 text-govBlueAccent" />
                    <span>{t('card_logistics_title')}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {t('card_logistics_sub')}
                  </div>
                </div>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-blue-100/80 text-govNavy font-mono text-[9px] rounded font-bold uppercase tracking-wider">
                  {t('card_operational_hub')}
                </span>
              </div>

              {/* Visual Split: Bulk Carrier Photography + SVG Maritime Map Overlay */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
                {/* Bulk Carrier Image */}
                <div className="sm:col-span-7 relative rounded border border-slate-200 overflow-hidden shadow-2xs group min-h-[170px]">
                  <img 
                    src={bulkCarrierImg} 
                    alt="Commercial dry bulk carrier ship laden with mineral cargo sailing in ocean waters" 
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 text-white">
                    <span className="px-1.5 py-0.5 bg-blue-600/90 text-[9px] font-semibold uppercase tracking-wider rounded">
                      {t('card_commercial_tag')}
                    </span>
                    <p className="text-[10px] font-medium text-slate-100 mt-1 leading-tight">
                      {t('card_fleet_opt')}
                    </p>
                  </div>
                </div>

                {/* East Coast India Bay of Bengal Map Inset */}
                <div className="sm:col-span-5 bg-govNavyDark rounded border border-slate-800 p-2.5 flex flex-col justify-between text-white relative overflow-hidden">
                  <div className="flex items-center justify-between text-[10px] border-b border-slate-800 pb-1.5 z-10">
                    <span className="font-semibold text-cyan-300 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      <span>{t('card_east_coast_nodes')}</span>
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">86°E · 20°N</span>
                  </div>

                  {/* Stylized SVG Map of East Coast India & Bay of Bengal Sea Lanes */}
                  <div className="relative h-28 w-full my-1">
                    <svg viewBox="0 0 200 130" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                      {/* Ocean background */}
                      <rect width="200" height="130" fill="#041226" />
                      
                      {/* Stylized Indian Coastline Path (East Coast) */}
                      <path 
                        d="M 20 0 Q 35 30, 45 60 Q 60 90, 80 130 L 0 130 L 0 0 Z" 
                        fill="#0c2340" 
                        stroke="#1a3a60" 
                        strokeWidth="1"
                      />

                      {/* Shipping Sea Lanes converging into East Coast */}
                      {/* Lane 1: From Australia (Southeast) */}
                      <path 
                        d="M 195 120 Q 140 85, 58 55" 
                        fill="none" 
                        stroke="#06b6d4" 
                        strokeWidth="1.2" 
                        strokeDasharray="3 2"
                        opacity="0.85"
                      />
                      {/* Lane 2: From Indonesia / Malacca Strait (East) */}
                      <path 
                        d="M 195 75 Q 120 60, 52 42" 
                        fill="none" 
                        stroke="#38bdf8" 
                        strokeWidth="1.2" 
                        strokeDasharray="3 2"
                        opacity="0.85"
                      />
                      {/* Lane 3: From South Africa / Mozambique (South) */}
                      <path 
                        d="M 130 130 Q 90 95, 48 70" 
                        fill="none" 
                        stroke="#60a5fa" 
                        strokeWidth="1.2" 
                        strokeDasharray="3 2"
                        opacity="0.85"
                      />

                      {/* Port Terminal Nodes */}
                      {/* Haldia / Sandheads */}
                      <circle cx="58" cy="28" r="2.8" fill="#fbbf24" stroke="#78350f" strokeWidth="0.8" />
                      <text x="63" y="30" fill="#fde68a" fontSize="6.5" fontWeight="bold">
                        {lang === 'hi' ? 'हल्दिया' : 'Haldia'}
                      </text>

                      {/* Dhamra */}
                      <circle cx="54" cy="42" r="2.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.8" />
                      <text x="60" y="44" fill="#bae6fd" fontSize="6">
                        {lang === 'hi' ? 'धामरा' : 'Dhamra'}
                      </text>

                      {/* Paradip */}
                      <circle cx="50" cy="55" r="3.5" fill="#22c55e" stroke="#14532d" strokeWidth="1" />
                      <text x="56" y="57" fill="#86efac" fontSize="7" fontWeight="bold">
                        {lang === 'hi' ? 'पारादीप' : 'Paradip'}
                      </text>

                      {/* Gopalpur */}
                      <circle cx="45" cy="70" r="2.5" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.8" />
                      <text x="51" y="72" fill="#bae6fd" fontSize="6">
                        {lang === 'hi' ? 'गोपालपुर' : 'Gopalpur'}
                      </text>

                      {/* Visakhapatnam */}
                      <circle cx="40" cy="88" r="3.2" fill="#38bdf8" stroke="#0369a1" strokeWidth="0.8" />
                      <text x="46" y="90" fill="#93c5fd" fontSize="6.5" fontWeight="bold">
                        {lang === 'hi' ? 'विशाखापट्टनम' : 'Vizag'}
                      </text>

                      {/* Bay of Bengal Label */}
                      <text x="110" y="45" fill="#334e68" fontSize="8" fontStyle="italic" letterSpacing="1">
                        {lang === 'hi' ? 'बंगाल की खाड़ी' : 'BAY OF BENGAL'}
                      </text>
                    </svg>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-300">
                    <span className="text-amber-300 font-semibold">
                      {lang === 'hi' ? 'गलियारा: बंगाल की खाड़ी' : 'Corridor: Bay of Bengal'}
                    </span>
                    <span className="text-slate-400">
                      {lang === 'hi' ? 'गहरे पानी का डिस्चार्ज' : 'Deepwater Discharge'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status footer pill */}
              <div className="bg-white rounded border border-slate-200 px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-medium text-govNavy">
                  {lang === 'hi' ? (
                    <>सक्रिय टर्मिनल सीमाएं: <strong>पारादीप · विशाखापट्टनम · धामरा · हल्दिया · गोपालपुर</strong></>
                  ) : (
                    <>Terminal Constraints Active: <strong>Paradip · Vizag · Dhamra · Haldia · Gopalpur</strong></>
                  )}
                </span>
                <button
                  onClick={() => onNavigate('ports')}
                  className="text-govBlueAccent hover:underline font-semibold text-[10px] flex items-center space-x-1 cursor-pointer"
                >
                  <span>{lang === 'hi' ? 'सीमा रडार' : 'Constraint Radar'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. DATA / PROVENANCE STATUS STRIP                                        */}
      {/* ========================================================================= */}
      <section className="bg-bannerBg border border-bannerBorder rounded-lg p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="p-1 bg-blue-100 rounded text-govNavy mt-0.5 flex-shrink-0">
            <AlertCircle className="w-4 h-4 text-govBlueAccent" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-govNavyDark">
                {t('lineage_title')}
              </span>
              <span className="px-2 py-0.5 bg-blue-100 text-govNavy font-semibold text-[10px] rounded border border-blue-200">
                {t('lineage_tag_observed')}
              </span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-semibold text-[10px] rounded border border-amber-300">
                {t('lineage_tag_synthetic')}
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-normal">
              {lang === 'hi' 
                ? 'ऐतिहासिक बाजार अवलोकन 31 जुलाई 2019 (CC-BY 4.0 के तहत 1,749 सत्यापित बाल्टिक ट्रेडिंग सत्र) तक उपलब्ध हैं। 2019 के बाद का पूर्वानुमान अधिकृत अवलोकन एकीकृत होने तक सिंथेटिक विस्तार का उपयोग करता है।' 
                : 'Historical market observations are available through 31 July 2019 (1,749 verified Baltic trading sessions under CC-BY 4.0). Post-2019 forecasting uses an explicitly identified synthetic extension until authorized observations are integrated. Pre-berthing waiting queues represent simulated demo telemetry.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('methodology')}
          className="self-end md:self-center px-3 py-1.5 bg-white hover:bg-slate-50 text-govBlueAccent border border-blue-200 hover:border-govNavy text-[11px] font-semibold rounded whitespace-nowrap transition cursor-pointer flex items-center space-x-1 flex-shrink-0"
        >
          <span>{lang === 'hi' ? 'डेटा पद्धति देखें' : 'View Data Methodology'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>

      {/* ========================================================================= */}
      {/* 3. PLATFORM INTRODUCTION                                                 */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-7 space-y-4">
        <div className="max-w-3xl space-y-2">
          <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
            {lang === 'hi' ? 'संरचना एवं कार्यप्रणाली' : 'Architecture & Methodology'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
            {t('pillars_heading')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('pillars_subheading')}
          </p>
        </div>

        {/* 3 Architectural Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2">
            <div className="w-8 h-8 rounded bg-blue-100 text-govNavy flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-govBlueAccent" />
            </div>
            <h3 className="text-xs font-bold text-govNavyDark">1. {t('pillar1_title')}</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {t('pillar1_desc')}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2">
            <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Anchor className="w-4 h-4 text-emerald-700" />
            </div>
            <h3 className="text-xs font-bold text-govNavyDark">2. {t('pillar2_title')}</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {t('pillar2_desc')}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 space-y-2">
            <div className="w-8 h-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center">
              <Layers className="w-4 h-4 text-amber-700" />
            </div>
            <h3 className="text-xs font-bold text-govNavyDark">3. {t('pillar3_title')}</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {t('pillar3_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. CORE CAPABILITIES (DECISION SUPPORT SERVICES)                         */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
              {lang === 'hi' ? 'प्रमुख मॉड्यूल' : 'Primary Capabilities'}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
              {t('services_heading')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('services_subheading')}
            </p>
          </div>
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-xs font-semibold text-govNavy hover:text-govBlueAccent flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
          >
            <span>{t('cta_banner_open_dash')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6 Capabilities Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coreServices.map((card) => {
            const Icon = card.icon;
            return (
              <div 
                key={card.id}
                className="bg-white rounded-lg border border-slate-200/90 shadow-2xs hover:shadow-md transition p-5 flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-md bg-blue-50 text-govNavy flex items-center justify-center group-hover:bg-govNavy group-hover:text-white transition-colors duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${card.badgeColor}`}>
                      {card.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-govNavyDark group-hover:text-govBlueAccent transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">
                      {card.subtitle}
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {card.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => onNavigate(card.id)}
                    className="text-xs font-semibold text-govNavy group-hover:text-govBlueAccent flex items-center space-x-1.5 cursor-pointer"
                  >
                    <span>{card.cta}</span>
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono">
                    /{card.id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. END-TO-END WORKFLOW SECTION                                           */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-7 space-y-5">
        <div className="max-w-3xl space-y-1">
          <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
            {lang === 'hi' ? 'क्रमिक निर्णय पाइपलाइन' : 'Sequential Decision Pipeline'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
            {t('workflow_heading')}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t('workflow_subheading')}
          </p>
        </div>

        {/* 7 Workflow Cards in Horizontal Flex / Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {workflowSteps.map((step, idx) => (
            <div 
              key={step.num}
              onClick={() => onNavigate(step.tab)}
              className="bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded p-3 flex flex-col justify-between space-y-2 transition cursor-pointer group shadow-2xs"
            >
              <div>
                <span className="text-[10px] font-mono font-bold text-govBlueAccent">
                  {lang === 'hi' ? `चरण ${step.num}` : `STAGE ${step.num}`}
                </span>
                <h4 className="text-xs font-bold text-govNavyDark mt-1 group-hover:text-govBlueAccent transition-colors">
                  {step.title}
                </h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                  {step.detail}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-govNavy font-medium">
                <span>{lang === 'hi' ? 'जांचें' : 'Inspect'}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. MARITIME TRADE NETWORK (OVERSEAS ORIGINS -> INDIA EAST COAST)          */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
              {lang === 'hi' ? 'अंतरराष्ट्रीय गलियारे' : 'International Corridors'}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-govNavyDark tracking-tight font-serif">
              {t('corridors_heading')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('corridors_subheading')}
            </p>
          </div>
          <button
            onClick={() => onNavigate('routes')}
            className="text-xs font-semibold text-govNavy hover:text-govBlueAccent flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
          >
            <span>{lang === 'hi' ? 'सभी मार्ग देखें' : 'Explore All Routes'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 6 Origins Table / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {supportedOrigins.map((orig) => (
            <div 
              key={orig.code}
              className="bg-slate-50/70 border border-slate-200/90 rounded-md p-3.5 space-y-2 hover:bg-white hover:border-slate-300 transition shadow-2xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center text-[10px] font-bold font-mono">
                    {orig.code.slice(0, 2)}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-govNavyDark">
                      {orig.name}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {orig.country} ({orig.region})
                    </span>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-govBlueAccent bg-white px-2 py-0.5 rounded border border-slate-200">
                  {orig.code}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'hi' ? 'वस्तु / कार्गो:' : 'Commodity:'}</span>
                  <span className="font-medium text-slate-800">
                    {lang === 'hi' 
                      ? orig.cargos.replace('Coking Coal, Thermal Coal', 'कोकिंग कोल, थर्मल कोल').replace('Thermal Coal Only', 'केवल थर्मल कोल').replace('Coking Coal Only', 'केवल कोकिंग कोल').replace('Coking Coal', 'कोकिंग कोल')
                      : orig.cargos}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{lang === 'hi' ? 'प्रमुख पोत:' : 'Typical Vessels:'}</span>
                  <span className="font-medium text-slate-800">{orig.primaryVessels}</span>
                </div>
                <div className="text-[10px] text-slate-500 italic pt-0.5">
                  {lang === 'hi'
                    ? orig.notes
                        .replace('Deepwater offshore terminal, high loading rates', 'गहरे पानी का अपतटीय टर्मिनल, उच्च लोडिंग दर')
                        .replace('Multi-berth coal export hub, RG Tanna terminal', 'मल्टी-बर्थ कोयला निर्यात केंद्र, आरजी तन्ना टर्मिनल')
                        .replace('Offshore anchorage transshipment with floating cranes', 'फ्लोटिंग क्रेन के साथ अपतटीय लंगरगाह ट्रांसशिपमेंट')
                        .replace('RBCT terminal, major source for Indian power & steel', 'आरबीसीटी टर्मिनल, भारतीय बिजली और इस्पात हेतु प्रमुख स्रोत')
                        .replace('East Coast US coal export piers (Lamberts Point / Pier IX)', 'अमेरिकी पूर्वी तट कोयला निर्यात पियर')
                        .replace('Draft-constrained channel (max ~50k DWT), tidal entry', 'ड्राफ्ट-बाधित चैनल (अधिकतम ~50k DWT), ज्वारीय प्रवेश')
                    : orig.notes}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{lang === 'hi' ? 'लक्ष्य डिस्चार्ज:' : 'Target Discharges:'}</span>
                <span className="text-[10px] font-semibold text-govNavy">{lang === 'hi' ? 'पारादीप · विशाखापट्टनम · धामरा' : 'Paradip · Vizag · Dhamra'}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. SUPPORTING FEATURES & ANALYTICS                                       */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="border-b border-slate-200 pb-2">
          <span className="text-[11px] font-bold text-govBlueAccent uppercase tracking-wider">
            {lang === 'hi' ? 'सहायक मॉड्यूल' : 'Supporting Modules'}
          </span>
          <h3 className="text-base sm:text-lg font-bold text-govNavyDark font-serif">
            {lang === 'hi' ? 'बाजार आसूचना, समुद्री गलियारे एवं पारदर्शिता' : 'Market Intelligence, Corridors & Transparency'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div 
            onClick={() => onNavigate('market')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <BarChart2 className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              {t('tab_market')}
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              {lang === 'hi' 
                ? 'बाल्टिक मैक्रो सूचकांक, मांग-आपूर्ति व्यवस्था, एवं हिंद महासागर बैलास्ट पोत स्थिति।'
                : 'Baltic macro indices, supply-demand regimes, and Indian Ocean ballast vessel positioning.'}
            </p>
          </div>

          <div 
            onClick={() => onNavigate('routes')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <Navigation className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              {t('tab_routes')}
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              {lang === 'hi'
                ? 'समुद्री दूरी, बंकर ईंधन खपत, नहर पारगमन शुल्क, एवं राउंड-यात्रा अर्थशास्त्र।'
                : 'Nautical distances, bunker fuel consumption, canal transit fees, and round-voyage economics.'}
            </p>
          </div>

          <div 
            onClick={() => onNavigate('methodology')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <FileText className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              {t('tab_methodology')}
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              {lang === 'hi'
                ? 'संपूर्ण डेटा वंशावली, सत्यापित डेटा कटऑफ, गणितीय परिभाषाएं, एवं धारणा सूची।'
                : 'Complete data provenance, verified data cutoffs, mathematical definitions, and assumption catalog.'}
            </p>
          </div>

          <div 
            onClick={() => onNavigate('about')}
            className="bg-white border border-slate-200 rounded p-3.5 hover:border-govNavy transition cursor-pointer space-y-1.5 shadow-2xs group"
          >
            <div className="flex items-center justify-between text-govNavy">
              <Info className="w-4 h-4 text-govBlueAccent" />
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
            <h4 className="text-xs font-bold text-govNavyDark group-hover:text-govBlueAccent">
              {t('tab_about')}
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              {lang === 'hi'
                ? 'SIH26006 समस्या संदर्भ, तकनीकी विनिर्देश, एवं प्रणाली संरचना सिद्धांत।'
                : 'SIH26006 problem statement context, technical specifications, and system architectural principles.'}
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FINAL CALL TO ACTION (CTA)                                            */}
      {/* ========================================================================= */}
      <section className="bg-gradient-to-r from-govNavyDark via-govNavy to-govNavyLight text-white rounded-lg p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl text-center md:text-left">
          <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">
            {lang === 'hi' ? 'संस्थागत निर्णय इंजन · SIH26006' : 'Institutional Decision Engine · SIH26006'}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-serif">
            {t('cta_banner_title')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {t('cta_banner_desc')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 flex-shrink-0">
          <button
            onClick={() => onNavigate('planner')}
            className="px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded shadow transition flex items-center space-x-2 cursor-pointer"
          >
            <span>{t('cta_banner_launch_planner')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-semibold rounded transition cursor-pointer"
          >
            <span>{t('cta_banner_open_dash')}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
