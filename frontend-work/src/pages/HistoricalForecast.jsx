import React, { useState, useEffect } from 'react';
import { 
  LineChart as ChartIcon, Calendar, Clock, Target, AlertCircle, 
  CheckCircle, ArrowRight, ShieldCheck, HelpCircle, Layers 
} from 'lucide-react';
import ProvenanceBadge from '../components/ProvenanceBadge';
import { useLanguage } from '../context/LanguageContext';
import { 
  VESSEL_INDEX_MAP, 
  VALID_HORIZONS, 
  executeForecast, 
  fetchAvailableDates,
  fetchHistoricalSeries,
  ApiError
} from '../api';

const VESSEL_OPTIONS = ['Panamax', 'Capesize', 'Supramax', 'Handysize'];

const VESSEL_HI_NAMES = {
  Panamax: 'पनामैक्स (Panamax)',
  Capesize: 'केपसाइज (Capesize)',
  Supramax: 'सुप्रामैक्स (Supramax)',
  Handysize: 'हैंडीसाइज़ (Handysize)',
};

export default function HistoricalForecast({ initialVessel = 'Panamax', onNavigateToRoute }) {
  const { lang } = useLanguage();
  const isHi = lang === 'hi';

  const [vessel, setVessel] = useState(initialVessel);
  const [originDate, setOriginDate] = useState('2019-06-28');
  const [horizon, setHorizon] = useState(28);
  const [validDates, setValidDates] = useState([]);
  
  const [forecastResult, setForecastResult] = useState(null);
  const [historySeries, setHistorySeries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch valid historical dates on mount
  useEffect(() => {
    fetchAvailableDates()
      .then(data => {
        if (data && data.dates) {
          setValidDates(data.dates);
        }
      })
      .catch(err => console.warn('Could not load valid dates list:', err));
  }, []);

  const targetIndex = VESSEL_INDEX_MAP[vessel]?.index || 'BPI';

  const handleGenerateForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Call real backend inference endpoint with correct schema { target, origin_date, horizon_sessions, vessel_type }
      const res = await executeForecast({
        target: targetIndex,
        originDate,
        horizonSessions: Number(horizon),
        vesselType: vessel,
      });
      setForecastResult(res);

      // 2. Load context history
      try {
        const hist = await fetchHistoricalSeries({
          target: targetIndex,
          endDate: originDate,
          limit: 60,
        });
        setHistorySeries(hist.observations || []);
      } catch (histErr) {
        console.warn('Context history load notice:', histErr);
      }
    } catch (err) {
      console.error('[Historical Forecast Error]:', err);
      setError(
        err instanceof ApiError 
          ? err.message 
          : isHi 
            ? 'चयनित मापदंडों के लिए पूर्वानुमान निष्पादन विफल रहा।' 
            : 'Inference failed for selected parameters.'
      );
      setForecastResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Run on change of vessel, originDate, or horizon
  useEffect(() => {
    handleGenerateForecast();
  }, [vessel, originDate, horizon]);

  return (
    <div className="space-y-6">
      {/* Header Dossier */}
      <div className="bg-white border border-lightBorder rounded p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold tracking-wider text-govBlueAccent uppercase">
                {isHi ? 'संभाव्य बैकटेस्टिंग इंजन' : 'Probabilistic Backtesting Engine'}
              </span>
              <ProvenanceBadge type="model" text={isHi ? 'क्वांटाइल LightGBM' : 'Quantile LightGBM'} />
              <ProvenanceBadge type="conformal" text={isHi ? '80% कन्फॉर्मल कैलिब्रेटेड' : '80% Conformal Calibrated'} />
            </div>
            <h2 className="text-xl font-bold text-govNavy tracking-tight">
              {isHi ? 'ऐतिहासिक बिंदु एवं क्वांटाइल पूर्वानुमान मूल्यांकन' : 'Historical Point & Quantile Forecast Evaluation'}
            </h2>
            <p className="text-slate-600 text-xs mt-1 max-w-3xl">
              {isHi
                ? 'चयनित पूर्वानुमान मूल तिथि T₀ तक केवल सत्यापित बाजार अवलोकनों का उपयोग करके उत्पन्न सख्त लीकेज-मुक्त बिंदु (P50) और कैलिब्रेटेड भविष्यवाणी अंतराल (P10–P90)।'
                : 'Strictly leakage-free point (P50) and calibrated prediction intervals (P10–P90) generated using only verified market observations up to the selected forecast origin date T₀.'}
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs bg-slate-50 p-3 rounded border border-slate-200">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <div className="text-govNavy font-bold">
                {isHi ? 'शून्य-लीकेज एंटी-लुकअहेड' : 'Zero-Leakage Anti-Lookahead'}
              </div>
              <div className="text-[10px] text-slate-500">
                {isHi ? 'विशेषताएं केवल t ≤ T₀ से निर्मित' : 'Features built strictly from t ≤ T₀'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel: Vessel, Date, Horizon */}
      <div className="bg-white border border-lightBorder rounded p-5 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
        {/* Vessel Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            {isHi ? 'पोत वर्ग' : 'Vessel Class'}
          </label>
          <select
            value={vessel}
            onChange={(e) => setVessel(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:border-govBlueAccent focus:outline-none transition cursor-pointer"
          >
            {VESSEL_OPTIONS.map(v => (
              <option key={v} value={v}>
                {isHi ? VESSEL_HI_NAMES[v] : v} ({VESSEL_INDEX_MAP[v]?.index}) • {VESSEL_INDEX_MAP[v]?.deadweight}
              </option>
            ))}
          </select>
        </div>

        {/* Index Mapped */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            {isHi ? 'मैप किया गया बाल्टिक सूचकांक' : 'Mapped Baltic Index'}
          </label>
          <div className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-xs text-govNavy font-mono font-bold flex items-center justify-between">
            <span>{targetIndex}</span>
            <span className="text-[10px] font-normal text-slate-500">
              {isHi ? 'मेंडेली सत्यापित' : 'Mendeley Verified'}
            </span>
          </div>
        </div>

        {/* Forecast Origin Date */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            {isHi ? 'पूर्वानुमान मूल तिथि (T₀)' : 'Forecast Origin (T₀)'}
          </label>
          <input
            type="date"
            min="2012-08-01"
            max="2019-07-31"
            value={originDate}
            onChange={(e) => setOriginDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:border-govBlueAccent focus:outline-none transition font-mono cursor-pointer"
          />
        </div>

        {/* Forecast Horizon */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            {isHi ? 'पूर्वानुमान क्षितिज (h)' : 'Forecast Horizon (h)'}
          </label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-800 focus:border-govBlueAccent focus:outline-none transition cursor-pointer"
          >
            {VALID_HORIZONS.map((h) => (
              <option key={h} value={h}>
                {h} {isHi ? 'कारोबारी सत्र (Trading Sessions)' : 'Trading Sessions'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Results Container */}
      {loading ? (
        <div className="bg-white border border-lightBorder rounded p-12 text-center space-y-3 shadow-xs">
          <div className="w-8 h-8 border-3 border-govNavy/20 border-t-govNavy rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-govNavy font-semibold">
            {isHi 
              ? 'लीकेज-सुरक्षित विशेषताएं तैयार की जा रही हैं और क्वांटाइल LightGBM मॉडल निष्पादित हो रहे हैं...' 
              : 'Constructing leakage-safe features & running Quantile LightGBM models...'}
          </p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <div className="font-bold text-xs">
              {isHi ? 'अनुमान त्रुटि (Inference Error)' : 'Inference Error'}
            </div>
            <div className="text-xs text-rose-700 mt-0.5">{error}</div>
          </div>
        </div>
      ) : forecastResult ? (
        <div className="space-y-5">
          {/* Top Metric Cards: P10, P50, P90, and Actual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* P10 Card */}
            <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                  {isHi ? 'P10 निचली सीमा' : 'P10 Lower Bound'}
                </span>
                <ProvenanceBadge type="conformal" text={isHi ? 'कैलिब्रेटेड' : 'Calibrated'} />
              </div>
              <div className="text-2xl font-black font-mono text-govNavy">
                {Math.round(forecastResult.p10).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">{isHi ? 'अंक' : 'pts'}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                {isHi ? 'कच्चा P10: ' : 'Raw P10: '} {Math.round(forecastResult.p10Raw).toLocaleString()} {isHi ? 'अंक' : 'pts'}
              </div>
            </div>

            {/* P50 Card (Median) */}
            <div className="bg-white border-2 border-govBlueAccent/30 rounded p-4 shadow-xs bg-blue-50/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-govBlueAccent uppercase font-bold flex items-center gap-1">
                  <Target className="w-3 h-3 text-govBlueAccent" />
                  {isHi ? 'P50 बिंदु पूर्वानुमान' : 'P50 Point Forecast'}
                </span>
                <ProvenanceBadge type="model" text={isHi ? 'मध्यिका' : 'Median'} />
              </div>
              <div className="text-2xl font-black font-mono text-govNavy">
                {Math.round(forecastResult.p50).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">{isHi ? 'अंक' : 'pts'}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                {isHi ? 'क्वांटाइल LightGBM मध्यिका' : 'Quantile LightGBM median'}
              </div>
            </div>

            {/* P90 Card */}
            <div className="bg-white border border-lightBorder rounded p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase font-semibold">
                  {isHi ? 'P90 ऊपरी सीमा' : 'P90 Upper Bound'}
                </span>
                <ProvenanceBadge type="conformal" text={isHi ? 'कैलिब्रेटेड' : 'Calibrated'} />
              </div>
              <div className="text-2xl font-black font-mono text-govNavy">
                {Math.round(forecastResult.p90).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">{isHi ? 'अंक' : 'pts'}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                {isHi ? 'कच्चा P90: ' : 'Raw P90: '} {Math.round(forecastResult.p90Raw).toLocaleString()} {isHi ? 'अंक' : 'pts'}
              </div>
            </div>

            {/* Actual Realisation Card */}
            <div className={`rounded p-4 border shadow-xs ${
              forecastResult.actualValue !== null
                ? 'bg-emerald-50/40 border-emerald-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono text-slate-600 uppercase font-semibold">
                  {isHi ? 'प्रेक्षित वास्तविक Y(T₀+h)' : 'Observed Actual Y(T₀+h)'}
                </span>
                <ProvenanceBadge 
                  type={forecastResult.actualValue !== null ? 'observed' : 'unavailable'} 
                  text={
                    forecastResult.actualValue !== null 
                      ? (isHi ? 'प्रेक्षित' : 'Observed') 
                      : (isHi ? 'अप्रमाणित' : 'Unobserved')
                  } 
                />
              </div>
              {forecastResult.actualValue !== null ? (
                <>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    {Math.round(forecastResult.actualValue).toLocaleString()}
                    <span className="text-xs font-normal text-slate-500 ml-1">{isHi ? 'अंक' : 'pts'}</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 font-mono mt-1">
                    {isHi ? `${forecastResult.targetDate} को प्रेक्षित` : `Observed on ${forecastResult.targetDate}`}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-bold font-mono text-slate-500 mt-1">
                    {isHi ? '2019 उपरांत अप्रशिक्षित' : 'Post-2019 Unobserved'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {isHi 
                      ? `लक्षित तिथि (${forecastResult.targetDate}) 2019 कटऑफ के बाद है। शून्य फैब्रिकेशन नीति लागू।` 
                      : `Target date (${forecastResult.targetDate}) is post-2019 cutoff. Zero fabrication enforced.`}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Visual Prediction Interval Gauge / Fan */}
          <div className="bg-white border border-lightBorder rounded p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs font-bold text-govNavy flex items-center gap-1.5 uppercase tracking-wide">
                  <ChartIcon className="w-4 h-4 text-govBlueAccent" />
                  {isHi ? 'कैलिब्रेटेड भविष्यवाणी अंतराल फैन (P10 – P90)' : 'Calibrated Prediction Interval Fan (P10 – P90)'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isHi 
                    ? 'प्रेक्षित वास्तविक मूल्य बनाम 80% कन्फॉर्मल भविष्यवाणी बैंड का दृश्य प्रतिनिधित्व।' 
                    : 'Visual representation of the 80% conformal prediction band vs the observed realization.'}
                </p>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-blue-800">
                  <span className="w-2.5 h-2.5 rounded bg-sky-200 border border-sky-400" />
                  {isHi ? '80% बैंड (P10–P90)' : '80% Band (P10–P90)'}
                </span>
                <span className="flex items-center gap-1.5 text-govNavy font-bold">
                  <span className="w-2 h-2 rounded-full bg-govNavy" />
                  {isHi ? 'P50 पूर्वानुमान' : 'P50 Forecast'}
                </span>
                {forecastResult.actualValue !== null && (
                  <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    {isHi ? 'वास्तविक प्रेक्षित' : 'Actual Observed'}
                  </span>
                )}
              </div>
            </div>

            {/* Interval Bar Graphic */}
            <div className="bg-slate-50 p-5 rounded border border-slate-200">
              {(() => {
                const p10 = forecastResult.p10;
                const p50 = forecastResult.p50;
                const p90 = forecastResult.p90;
                const act = forecastResult.actualValue;

                const minVal = Math.min(p10, act !== null ? Math.min(p10, act) : p10) * 0.90;
                const maxVal = Math.max(p90, act !== null ? Math.max(p90, act) : p90) * 1.10;
                const range = maxVal - minVal || 1;

                const getPercent = (v) => Math.max(0, Math.min(100, ((v - minVal) / range) * 100));

                const p10Pct = getPercent(p10);
                const p50Pct = getPercent(p50);
                const p90Pct = getPercent(p90);
                const actPct = act !== null ? getPercent(act) : null;

                return (
                  <div className="space-y-6 pt-4 pb-2">
                    {/* Gauge track */}
                    <div className="relative h-10 bg-slate-200 rounded border border-slate-300 flex items-center px-4">
                      {/* Band P10 to P90 */}
                      <div
                        className="absolute h-7 rounded bg-gradient-to-r from-blue-200 via-sky-300 to-indigo-200 border border-blue-400"
                        style={{
                          left: `${p10Pct}%`,
                          width: `${Math.max(2, p90Pct - p10Pct)}%`,
                        }}
                      />

                      {/* P10 Marker */}
                      <div
                        className="absolute top-1 bottom-1 w-0.5 bg-blue-600"
                        style={{ left: `${p10Pct}%` }}
                      >
                        <span className="absolute -top-5 -translate-x-1/2 text-[9px] font-mono font-bold text-blue-700">
                          P10 ({Math.round(p10)})
                        </span>
                      </div>

                      {/* P50 Marker */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-govNavy z-10"
                        style={{ left: `${p50Pct}%` }}
                      >
                        <div className="w-3.5 h-3.5 bg-govNavy rounded-full border-2 border-white absolute -top-1.5 -left-1.25 shadow-xs" />
                        <span className="absolute -bottom-5 -translate-x-1/2 text-[10px] font-mono font-extrabold text-govNavy whitespace-nowrap">
                          P50 ({Math.round(p50)})
                        </span>
                      </div>

                      {/* P90 Marker */}
                      <div
                        className="absolute top-1 bottom-1 w-0.5 bg-indigo-600"
                        style={{ left: `${p90Pct}%` }}
                      >
                        <span className="absolute -top-5 -translate-x-1/2 text-[9px] font-mono font-bold text-indigo-700">
                          P90 ({Math.round(p90)})
                        </span>
                      </div>

                      {/* Actual Realisation Marker */}
                      {actPct !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-emerald-600 z-20"
                          style={{ left: `${actPct}%` }}
                        >
                          <div className="w-3.5 h-3.5 bg-emerald-600 rounded-full border-2 border-white absolute -top-1.5 -left-1.25 shadow-xs" />
                          <span className="absolute -bottom-5 -translate-x-1/2 text-[10px] font-mono font-extrabold text-emerald-800 whitespace-nowrap">
                            {isHi ? 'वास्तविक' : 'Act'} ({Math.round(act)})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
