import React from 'react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { useLanguage } from '../context/LanguageContext';

export default function Methodology() {
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
                {isHi ? 'डेटा स्रोत (Provenance), अर्थमिति एवं कार्यप्रणाली' : 'Data Provenance, Econometrics & Methodology'}
              </h1>
              <span className="bg-blue-100 text-govBlueAccent font-semibold px-2 py-0.5 rounded text-[10px] border border-blue-200">
                {isHi ? 'वैधानिक अनुपालन' : 'Statutory Compliance'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isHi
                ? 'पारदर्शी गणितीय सूत्रीकरण, डेटा वंशावली ऑडिटिंग, एवं कानूनी पुनर्वितरण अनुपालन।'
                : 'Transparent mathematical formulation, data lineage auditing, and legal redistribution compliance.'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <ProvenanceBadge type="observed" text={isHi ? "श्रेणी 'क' सत्यापित" : "Category A Verified"} />
            <ProvenanceBadge type="conformal" text={isHi ? "80% कन्फॉर्मल कैलिब्रेटेड" : "80% Conformal Calibrated"} />
          </div>
        </div>
      </div>

      {/* Notice on Current Data Status (Section 19) */}
      <div className="bg-bannerBg border border-bannerBorder rounded p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div className="text-govBlueAccent mt-0.5 flex-shrink-0">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" fillRule="evenodd" />
            </svg>
          </div>
          <div className="text-[11px] leading-relaxed">
            <strong className="text-govNavy font-bold block text-xs">
              {isHi
                ? 'पूर्वानुमान वातावरण: सत्यापित ऐतिहासिक (2012–2019) + सिंथेटिक विस्तार (2020–2026)'
                : 'Forecast Environment: Verified Historical (2012–2019) + Synthetic Extension (2020–2026)'}
            </strong>
            <p className="text-slate-700 mt-0.5">
              {isHi
                ? 'मॉडल सत्यापित ऐतिहासिक बाल्टिक एक्सचेंज अवलोकनों (2012–2019, मेंडेली डेटा) पर प्रशिक्षित और कन्फॉर्मल-कैलिब्रेटेड है। वास्तविक अवलोकनों का निर्माण किए बिना 2026 पूर्वानुमान प्रयोगों और बहु-यात्रा सिमुलेशन का समर्थन करने के लिए, प्रणाली परियोजना की कैलिब्रेटेड पोस्ट-2019 सिंथेटिक विस्तार पाइपलाइन को शामिल करती है। वास्तविक प्रेक्षित और सिंथेटिक डेटा को सभी इंटरफेस पर सख्ती से अलग और बैज किया गया है।'
                : "The model is trained and conformal-calibrated on verified historical Baltic Exchange observations (2012–2019, Mendeley Data). To support 2026 forecasting experiments and multi-voyage simulation without fabricating real observations, the system incorporates the project's calibrated post-2019 synthetic extension pipeline. Real observed and synthetic data are strictly segregated and badged across all surfaces."}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-govBlueAccent bg-white px-2 py-1 rounded border border-blue-200 whitespace-nowrap">
          {isHi ? '2026 पूर्वानुमान सक्रिय' : '2026 Forecasting Active'}
        </span>
      </div>

      {/* Grid: 3 Methodology Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pillar 1: Baltic Market Data */}
        <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h2 className="text-xs font-bold text-govNavy">
              {isHi ? 'बाल्टिक उप-सूचकांक लक्ष्य' : 'Baltic Sub-Index Targets'}
            </h2>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'डेटासेट पहचान' : 'Dataset Identification'}
              </span>
              <strong className="text-slate-800 font-mono">baltic dry index freight rates47</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'मुख्य शोधकर्ता / शैक्षणिक स्रोत' : 'Primary Investigator / Academic Source'}
              </span>
              <span className="text-slate-700">
                {isHi ? 'डॉ. बांगर राजू (UPES देहरादून, एल्सेवियर मेंडेली डेटा)' : 'Dr. Bangar Raju (UPES Dehradun, Elsevier Mendeley Data)'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'सत्यापित समय सीमा' : 'Verified Temporal Window'}
              </span>
              <span className="font-mono font-bold text-govNavy">2012-08-01 – 2019-07-31</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'ऑडिट किया गया कवरेज' : 'Audited Coverage'}
              </span>
              <span className="text-slate-700">
                {isHi ? '1,749 सत्यापित दैनिक कारोबारी सत्र (0 अनुपलब्ध, 0 रिक्त)' : '1,749 verified daily trading sessions (0 missing, 0 nulls)'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'खुला लाइसेंस' : 'Open License'}
              </span>
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                CC BY 4.0 (Creative Commons Attribution)
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 2: FRED Macro Indicators */}
        <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h2 className="text-xs font-bold text-govNavy">
              {isHi ? 'समष्टि आर्थिक पुनर्विश्लेषण' : 'Macroeconomic Reanalysis'}
            </h2>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'डेटा प्रदाता' : 'Data Provider'}
              </span>
              <strong className="text-slate-800">
                {isHi ? 'फेडरल रिजर्व बैंक ऑफ सेंट लुइस (FRED) / IMF' : 'Federal Reserve Bank of St. Louis (FRED) / IMF'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'ब्रेंट कच्चा तेल (दैनिक बंकर प्रॉक्सी)' : 'Brent Crude Oil (Daily Bunker Proxy)'}
              </span>
              <span className="font-mono text-slate-700">DCOILBRENTEU (1987–2026, 9,563 rows)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'USD / INR विनिमय दर (दैनिक FX)' : 'USD / INR Exchange Rate (Daily FX)'}
              </span>
              <span className="font-mono text-slate-700">DEXINUS (1973–2026, 14,009 rows)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'वैश्विक कोयला एवं लौह अयस्क (IMF बेंचमार्क)' : 'Global Coal & Iron Ore (IMF Benchmarks)'}
              </span>
              <span className="font-mono text-slate-700">PCOALAUUSDM &amp; PIORECRUSDM (1992–2026)</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'कानूनी शर्तें' : 'Legal Terms'}
              </span>
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {isHi ? 'अमेरिकी सरकारी कार्य / खुला IMF डेटा' : 'U.S. Government Work / Open IMF Data'}
              </span>
            </div>
          </div>
        </div>

        {/* Pillar 3: Quantile LightGBM & Conformal Prediction */}
        <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
            <div className="w-7 h-7 rounded bg-blue-100 text-govNavy flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h2 className="text-xs font-bold text-govNavy">
              {isHi ? 'मॉडल वास्तुकला एवं कैलिब्रेशन' : 'Model Architecture & Calibration'}
            </h2>
          </div>

          <div className="space-y-2 text-[11px]">
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'कोर पूर्वानुमान मॉडल' : 'Core Forecaster'}
              </span>
              <strong className="text-govNavy">
                {isHi ? 'क्वांटाइल ग्रेडिएंट बूस्टेड ट्रीज (LightGBM)' : 'Quantile Gradient Boosted Trees (LightGBM)'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'क्वांटाइल उद्देश्य' : 'Quantile Objectives'}
              </span>
              <span className="font-mono text-slate-700">Pinball Loss @ α ∈ &#123;0.10, 0.50, 0.90&#125;</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'सीमित-नमूना कवरेज गारंटी' : 'Finite-Sample Coverage Guarantee'}
              </span>
              <strong className="text-slate-800">
                {isHi ? 'स्प्लिट कन्फॉर्मल प्रेडिक्शन (Vovk et al.)' : 'Split Conformal Prediction (Vovk et al.)'}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'असतत पूर्वानुमान क्षितिज' : 'Discrete Forecast Horizons'}
              </span>
              <span className="font-mono text-slate-700">
                h ∈ &#123;7, 14, 28, 60, 90, 180&#125; {isHi ? 'कारोबारी सत्र' : 'trading sessions'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">
                {isHi ? 'क्रमबद्ध मॉडल आर्टिफैक्ट्स' : 'Model Artifacts Serialized'}
              </span>
              <span className="font-mono text-slate-700">
                {isHi ? 'ml-work/models/saved_models/ में 72 joblib मॉडल' : '72 joblib models in ml-work/models/saved_models/'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Provenance Classification Matrix (Section 18) */}
      <div className="bg-white border border-lightBorder rounded p-4 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-govNavy border-b border-slate-100 pb-2 uppercase tracking-wide">
          {isHi ? 'आधिकारिक स्रोत (Provenance) एवं विश्वसनीयता टैगिंग मानक' : 'Official Provenance & Reliability Tagging Standard'}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse gov-table">
            <thead>
              <tr>
                <th>{isHi ? 'वर्गीकरण टैग' : 'Classification Tag'}</th>
                <th>{isHi ? 'परिभाषा' : 'Definition'}</th>
                <th>{isHi ? 'SIH26006 में उदाहरण उपयोग' : 'Example Use in SIH26006'}</th>
                <th>{isHi ? 'प्रामाणिक सत्यापन विधि' : 'Authoritative Verification Method'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              <tr>
                <td>
                  <ProvenanceBadge type="observed" text={isHi ? 'प्रेक्षित' : 'Observed'} />
                </td>
                <td className="text-slate-700">
                  {isHi 
                    ? 'सत्यापित डेटा वंशावली के साथ आधिकारिक प्रकाशित ऐतिहासिक रिकॉर्ड।' 
                    : 'Official published historical record with verified data lineage.'}
                </td>
                <td className="font-mono text-slate-800">
                  {isHi ? 'मेंडेली बाल्टिक उप-सूचकांक, FRED ब्रेंट क्रूड' : 'Mendeley Baltic Sub-Indices, FRED Brent Crude'}
                </td>
                <td className="text-slate-600">
                  {isHi ? 'SHA256 चेकसम ऑडिट एवं .metadata.json साइडकार' : 'SHA256 checksum audit & .metadata.json sidecars'}
                </td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="model" text={isHi ? 'मॉडल आउटपुट' : 'Model Output'} />
                </td>
                <td className="text-slate-700">
                  {isHi 
                    ? 'पूर्व-प्रशिक्षित मशीन लर्निंग मॉडल द्वारा निर्मित नियतात्मक एल्गोरिदमिक पूर्वानुमान।' 
                    : 'Deterministic algorithmic forecast produced by pre-trained ML model.'}
                </td>
                <td className="font-mono text-slate-800">
                  {isHi ? 'क्वांटाइल LightGBM P50 फ्रेट पूर्वानुमान' : 'Quantile LightGBM P50 freight forecast'}
                </td>
                <td className="text-slate-600">
                  {isHi ? 'वॉक-फॉरवर्ड क्रॉस वैलिडेशन एवं पिनबॉल लॉस ऑडिट' : 'Walk-forward cross validation & pinball loss audit'}
                </td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="conformal" text={isHi ? 'कन्फॉर्मल कैलिब्रेटेड' : 'Conformal Calibrated'} />
                </td>
                <td className="text-slate-700">
                  {isHi 
                    ? '80% कवरेज (P10–P90) को संतुष्ट करने वाला सांख्यिकीय रूप से कैलिब्रेटेड भविष्यवाणी अंतराल।' 
                    : 'Statistically calibrated prediction interval satisfying 80% coverage (P10–P90).'}
                </td>
                <td className="font-mono text-slate-800">
                  {isHi ? 'Q̂ के माध्यम से P10 – P90 भविष्यवाणी अंतराल विस्तार' : 'P10 – P90 prediction interval expansion via Q̂'}
                </td>
                <td className="text-slate-600">
                  {isHi ? 'स्प्लिट-कन्फॉर्मल अनुभवजन्य अवशिष्ट कैलिब्रेशन' : 'Split-conformal empirical residual calibration'}
                </td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="derived" text={isHi ? 'व्युत्पन्न (Derived)' : 'Derived'} />
                </td>
                <td className="text-slate-700">
                  {isHi 
                    ? 'भौतिक, भौगोलिक या लेखांकन सूत्रों से पुनर्गठित मान।' 
                    : 'Reconstructed value from physical, geographic, or accounting formulas.'}
                </td>
                <td className="font-mono text-slate-800">
                  {isHi ? 'मार्ग माल ढुलाई $/टन, समुद्री पारगमन दिन, बंकर लागत' : 'Route freight $/tonne, sea transit days, bunker cost'}
                </td>
                <td className="text-slate-600">
                  {isHi ? 'एडमिरल्टी समुद्री दूरी × पोत इंजन खपत' : 'Admiralty nautical distance × vessel engine consumption'}
                </td>
              </tr>
              <tr>
                <td>
                  <ProvenanceBadge type="assumed" text={isHi ? 'अनुमानित / डेमो' : 'Assumed / Demo'} />
                </td>
                <td className="text-slate-700">
                  {isHi 
                    ? 'सॉफ्टवेयर एकीकरण के लिए कैलिब्रेटेड बेंचमार्क या विशेषज्ञ-क्यूरेटेड फिक्सचर।' 
                    : 'Calibrated benchmark or expert-curated fixture for software integration.'}
                </td>
                <td className="font-mono text-slate-800">
                  {isHi ? 'ओर्नस्टीन-उहलेनबेक डेमो श्रृंखला, निजी टर्मिनल शुल्क' : 'Ornstein-Uhlenbeck demo series, private terminal tariffs'}
                </td>
                <td className="text-slate-600">
                  {isHi ? 'प्रेक्षित बाजार डेटा से अलग करने के लिए स्पष्ट रूप से टैग किया गया' : 'Clearly tagged to distinguish from observed market data'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
