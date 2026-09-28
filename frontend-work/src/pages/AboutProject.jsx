import React from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { useLanguage } from '../context/LanguageContext';

export default function AboutProject({ onNavigate }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-govNavy">
                {isHi ? 'SIH26006 — समस्या विवरण एवं प्रणाली वास्तुकला (Architecture)' : 'SIH26006 — Problem Statement & System Architecture'}
              </h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                {isHi ? 'राष्ट्रीय लॉजिस्टिक्स पहल' : 'National Logistics Initiative'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isHi
                ? 'भारत के पूर्वी तट समुद्री गलियारों के लिए बुद्धिमान माल ढुलाई पूर्वानुमान एवं थोक कार्गो खरीद निर्णय समर्थन प्रणाली।'
                : "Intelligent Freight Forecasting & Bulk Cargo Procurement Decision Support for India's East Coast maritime corridors."}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <ProvenanceBadge type="observed" text={isHi ? "पत्तन मंत्रालय संरेखित" : "MoPSW Aligned"} />
            <ProvenanceBadge type="conformal" text={isHi ? "NLP अनुरूप" : "NLP Compliant"} />
          </div>
        </div>
      </div>

      {/* Institutional Mission & Problem Statement */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-govNavy border-b border-slate-100 pb-2 uppercase tracking-wide">
          {isHi ? 'संप्रभु संदर्भ एवं परिचालन उद्देश्य' : 'Sovereign Context & Operational Objective'}
        </h2>

        <p className="text-xs text-slate-700 leading-relaxed">
          {isHi
            ? 'भारत के इस्पात, ताप विद्युत और विनिर्माण क्षेत्र महत्वपूर्ण थोक वस्तुओं के समुद्री आयात पर बहुत अधिक निर्भर करते हैं—मुख्य रूप से ऑस्ट्रेलिया और मोजाम्बिक से कोकिंग कोल, इंडोनेशिया और दक्षिण अफ्रीका से थर्मल कोल, और लौह अयस्क। ये कार्गो पारादीप, विशाखापट्टनम, धामरा, हल्दिया, गंगावरम और गोपालपुर सहित प्रमुख पूर्वी तट बंदरगाहों पर पहुंचते हैं।'
            : "India's steel, thermal power, and manufacturing sectors rely heavily on seaborne imports of critical bulk commodities—predominantly coking coal from Australia and Mozambique, thermal coal from Indonesia and South Africa, and iron ore. These cargoes arrive at major East Coast ports including Paradip, Visakhapatnam, Dhamra, Haldia, Gangavaram, and Gopalpur."}
        </p>

        <p className="text-xs text-slate-700 leading-relaxed">
          {isHi
            ? 'संप्रभु और उद्यम चार्टरर्स को बाल्टिक ड्राई-बल्क फ्रेट दरों में अत्यधिक बाजार अस्थिरता के साथ-साथ गंभीर भौतिक बंदरगाह बाधाओं (जैसे हल्दिया में हुगली नदी ड्राफ्ट सीमा या ज्वारीय प्रतिबंध) का सामना करना पड़ता है। पारंपरिक माल ढुलाई मूल्य भविष्यवक्ता विफल हो जाते हैं क्योंकि वे बाजार मूल्य को एक अनिश्चित वितरण के बजाय केवल एक बिंदु भविष्यवाणी मानते हैं, और भौतिक बर्थ व्यवहार्यता की उपेक्षा करते हैं।'
            : 'Sovereign and enterprise charterers face extreme market volatility in Baltic dry-bulk freight rates alongside severe physical port constraints (such as Hooghly river draft limits at Haldia or tidal restrictions). Conventional freight price oracles fail because they treat market price as a point prediction rather than an uncertain distribution, and neglect physical berth feasibility.'}
        </p>

        <div className="bg-blue-50/60 border border-blue-200 rounded p-3 text-xs text-govNavy font-medium">
          <strong>{isHi ? 'SIH26006 शासनादेश: ' : 'The SIH26006 Mandate: '}</strong>
          {isHi
            ? '"बाजार का पूर्वानुमान लगाएं → बंदरगाह एवं पोत बाधाओं को समझें → चार्टरिंग रणनीतियों का अनुकरण करें → पारदर्शी डेटा स्रोत के साथ एक व्याख्यात्मक खरीद अनुशंसा प्रदान करें।"'
            : '"Forecast the market → Understand port & vessel constraints → Simulate chartering strategies → Deliver an explainable procurement recommendation with transparent data provenance."'}
        </div>
      </div>

      {/* Core Architectural Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs space-y-2">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
            <div className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              M
            </div>
            <h3 className="text-xs font-bold text-govNavy">
              {isHi ? 'मशीन लर्निंग स्तर (ML Tier)' : 'Machine Learning Tier'}
            </h3>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {isHi
              ? 'सत्यापित बाल्टिक एक्सचेंज उप-सूचकांकों पर प्रशिक्षित क्वांटाइल LightGBM मॉडल (1,749 सत्र, मेंडेली CC BY 4.0)। 6 असतत क्षितिजों (7 से 180 सत्र) में परिमित-नमूना मान्य 80% भविष्यवाणी अंतराल (P10–P90) प्रदान करने के लिए स्प्लिट-कन्फॉर्मल भविष्यवाणी के माध्यम से कैलिब्रेटेड।'
              : 'Quantile LightGBM models trained on verified Baltic Exchange sub-indices (1,749 sessions, Mendeley CC BY 4.0). Calibrated via Split-Conformal prediction to provide finite-sample valid 80% prediction intervals (P10–P90) across 6 discrete horizons (7 to 180 sessions).'}
          </p>
          <span className="text-[10px] text-govBlueAccent font-mono block">ml-work/models/saved_models/</span>
        </div>

        <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs space-y-2">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
            <div className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              B
            </div>
            <h3 className="text-xs font-bold text-govNavy">
              {isHi ? 'निर्णय इंजन स्तर (Decision Engine Tier)' : 'Decision Engine Tier'}
            </h3>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {isHi
              ? 'एडमिरल्टी नौसैनिक दूरियों, बंकर ईंधन खपत वक्रों, पत्तन प्राधिकरण शुल्कों, और स्पष्ट जोखिम प्राथमिकताओं (λ) के साथ मोंटे कार्लो रणनीति सिमुलेशन (स्पॉट बनाम लगातार बनाम स्प्लिट फ्लीट बनाम सीओए) का मॉडलिंग करने वाली FastAPI निर्णय सेवा।'
              : 'FastAPI decision service modeling Admiralty nautical distances, bunker fuel consumption curves, port authority tariffs, and Monte Carlo strategy simulation (Spot vs Consecutive vs Split Fleet vs COA) with explicit risk preferences (λ).'}
          </p>
          <span className="text-[10px] text-govBlueAccent font-mono block">backend-work/app/routers/</span>
        </div>

        <div className="bg-white border border-lightBorder rounded p-3.5 shadow-xs space-y-2">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-1.5">
            <div className="w-6 h-6 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              U
            </div>
            <h3 className="text-xs font-bold text-govNavy">
              {isHi ? 'सरकारी यूआई स्तर (Government UI Tier)' : 'Government UI Tier'}
            </h3>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {isHi
              ? 'पत्तन, पोत परिवहन और जलमार्ग मंत्रालय के डिजाइन मानकों के अनुसार तैयार किया गया संस्थागत सरकारी निर्णय-समर्थन डैशबोर्ड। रिएक्ट 18, विट, और शून्य सिंथेटिक बाजार दावों के साथ उच्च-कंट्रास्ट सुलभ लेआउट के साथ निर्मित।'
              : 'Institutional government decision-support dashboard styled in accordance with Ministry of Ports, Shipping & Waterways design standards. Built with React 18, Vite, and high-contrast accessible layouts with zero synthetic market claims.'}
          </p>
          <span className="text-[10px] text-govBlueAccent font-mono block">frontend-work/src/</span>
        </div>
      </div>

      {/* Repository Quick Links */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
        <h2 className="text-xs font-bold text-govNavy mb-2">
          {isHi ? 'प्रामाणिक विनिर्देश एवं एपीआई लिंक' : 'Authoritative Specifications & API Links'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="p-3 border border-slate-200 rounded hover:border-govBlueAccent hover:bg-slate-50 transition flex items-center justify-between"
          >
            <div>
              <strong className="text-govNavy block">
                {isHi ? 'इंटरएक्टिव एपीआई डॉक्स' : 'Interactive API Docs'}
              </strong>
              <span className="text-[10px] text-slate-500">FastAPI Swagger / OpenAPI Spec</span>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <button
            onClick={() => onNavigate('methodology')}
            className="p-3 border border-slate-200 rounded hover:border-govBlueAccent hover:bg-slate-50 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <strong className="text-govNavy block">
                {isHi ? 'कानूनी डेटा स्रोत रजिस्ट्री' : 'Legal Provenance Registry'}
              </strong>
              <span className="text-[10px] text-slate-500">Mendeley CC BY 4.0 &amp; FRED Series</span>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => onNavigate('ports')}
            className="p-3 border border-slate-200 rounded hover:border-govBlueAccent hover:bg-slate-50 transition flex items-center justify-between text-left cursor-pointer"
          >
            <div>
              <strong className="text-govNavy block">
                {isHi ? 'पत्तन बाधा निर्देशिका' : 'Port Constraint Directory'}
              </strong>
              <span className="text-[10px] text-slate-500">
                {isHi ? 'प्रमुख पत्तन प्राधिकरण अधिनियम 2021' : 'Major Port Authorities Act 2021'}
              </span>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
