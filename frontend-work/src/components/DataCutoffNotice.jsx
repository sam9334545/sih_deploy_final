import React from 'react';
import ProvenanceBadge from './ProvenanceBadge';
import { useLanguage } from '../context/LanguageContext';

export default function DataCutoffNotice({ className = '', compact = false }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center gap-2 py-1.5 px-3 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-600 ${className}`}>
        <span className="font-semibold text-govNavy">
          {isHi ? 'पूर्वानुमान वातावरण:' : 'Forecast Environment:'}
        </span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge type="OBSERVED" text={isHi ? 'सत्यापित (2012–2019)' : 'Observed (2012–2019)'} />
        </span>
        <span className="text-slate-400">→</span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge type="SYNTHETIC EXTENSION" text={isHi ? 'सिंथेटिक विस्तार (2020–2026)' : 'Synthetic Extension (2020–2026)'} />
        </span>
        <span className="text-slate-400">→</span>
        <span className="flex items-center gap-1">
          <ProvenanceBadge type="FORECAST" text={isHi ? 'एमएल पूर्वानुमान (2026+)' : 'ML Forecast (2026+)'} />
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-lg p-3 text-xs ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-2 mb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <strong className="text-govNavy font-semibold uppercase tracking-wide text-[10px]">
            {isHi ? 'डेटा अखंडता एवं पूर्वानुमान वातावरण संरचना' : 'Data Integrity & Forecasting Environment Architecture'}
          </strong>
        </div>
        <div className="flex items-center gap-1.5">
          <ProvenanceBadge type="OBSERVED" text={isHi ? '2012–2019 सत्यापित' : '2012–2019 Verified'} />
          <ProvenanceBadge type="SYNTHETIC EXTENSION" text={isHi ? '2020–2026 सिंथेटिक' : '2020–2026 Synthetic'} />
          <ProvenanceBadge type="FORECAST" text={isHi ? '2026+ क्षितिज' : '2026+ Horizon'} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700">
        <div className="p-2 bg-white/80 rounded border border-emerald-100">
          <div className="font-bold text-emerald-900 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            {isHi ? '1. सत्यापित ऐतिहासिक डेटा (2012–2019)' : '1. Verified Ground Truth (2012–2019)'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            {isHi 
              ? 'Mendeley Data (DOI 10.17632/mcm7ycmjtt.1) से 1,749 सत्यापित दैनिक सत्र। मॉडल केवल सत्यापित ऐतिहासिक अभिलेखों पर प्रशिक्षित एवं विभाजित-कॉन्फ़ॉर्मल अंशांकित हैं।'
              : '1,749 verified daily sessions from Mendeley Data (DOI 10.17632/mcm7ycmjtt.1). Models are trained and split-conformal calibrated strictly on verified historical records.'}
          </p>
        </div>
        <div className="p-2 bg-white/80 rounded border border-purple-100">
          <div className="font-bold text-purple-900 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            {isHi ? '2. सिंथेटिक विस्तार (2020–2026)' : '2. Synthetic Extension (2020–2026)'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            {isHi
              ? 'बाल्टिक बाजार अस्थिरता व्यवस्था के आधार पर अंशांकित ऑर्स्टीन-उहलेनबेक स्टोकेस्टिक विस्तार, जो 2026 निर्णय खिड़की हेतु बहु-यात्रा प्रयोगों का समर्थन करता है।'
              : 'Ornstein-Uhlenbeck stochastic extension calibrated to Baltic market volatility regimes, supporting multi-voyage simulation experiments leading into the 2026 decision window.'}
          </p>
        </div>
        <div className="p-2 bg-white/80 rounded border border-blue-100">
          <div className="font-bold text-blue-900 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            {isHi ? '3. मशीन लर्निंग पूर्वानुमान क्षितिज (2026+)' : '3. ML Forecast Horizon (2026+)'}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
            {isHi
              ? '6 अलग-अलग ट्रेडिंग क्षितिजों (7, 14, 28, 60, 90, 180 दिन) पर विभाजित-कॉन्फ़ॉर्मल कवरेज अंशांकन के साथ LightGBM क्वांटाइल रिग्रेशन (P10, P50, P90)।'
              : 'LightGBM quantile regression (P10, P50, P90) with split-conformal coverage calibration across 6 discrete trading horizons (7, 14, 28, 60, 90, 180 days).'}
          </p>
        </div>
      </div>
    </div>
  );
}
