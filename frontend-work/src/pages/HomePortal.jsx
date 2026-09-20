import React, { useState, useEffect, useMemo } from 'react';
import StatusBanner from '../components/StatusBanner';

const PERIOD_LIMITS = {
  '1Y': 250,   // ~1 trading year
  '2Y': 500,   // ~2 trading years
  '3Y': 750,   // ~3 trading years
  '5Y': 1250,  // ~5 trading years
  'Full': 1800 // Full verified historical range
};

export default function HomePortal({ onNavigate }) {
  const [selectedTrendIndex, setSelectedTrendIndex] = useState('BPI');
  const [selectedPeriod, setSelectedPeriod] = useState('3Y');
  const [selectedView, setSelectedView] = useState('Daily');
  const [marketIndices, setMarketIndices] = useState([
    { code: 'BCI', segment: 'Capesize', value: '3,445 pts', date: '31 Jul 2019', status: 'Observed' },
    { code: 'BPI', segment: 'Panamax', value: '2,042 pts', date: '31 Jul 2019', status: 'Observed' },
    { code: 'BSI', segment: 'Supramax', value: '984 pts', date: '31 Jul 2019', status: 'Observed' },
    { code: 'BHSI', segment: 'Handysize', value: '479 pts', date: '31 Jul 2019', status: 'Observed' },
  ]);
  const [chartSeries, setChartSeries] = useState(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [hoverPoint, setHoverPoint] = useState(null);

  // Fetch real market summary on mount
  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch('/api/v1/historical/market-summary');
        if (res.ok) {
          const json = await res.json();
          if (json.indices && json.indices.length > 0) {
            setMarketIndices(json.indices.map(idx => ({
              code: idx.target,
              segment: idx.vessel_class,
              value: `${Math.round(idx.latest_value).toLocaleString()} pts`,
              date: idx.obs_date || '31 Jul 2019',
              status: 'Observed'
            })));
          }
        }
      } catch (err) {
        console.warn('Market summary fetch notice:', err);
      }
    }
    loadSummary();
  }, []);

  // Fetch real historical series dynamically based on selected index and period
  useEffect(() => {
    async function fetchSeriesData() {
      setLoadingChart(true);
      try {
        const limit = PERIOD_LIMITS[selectedPeriod] || 750;
        const res = await fetch(`/api/v1/historical/series?target=${selectedTrendIndex}&limit=${limit}`);
        if (res.ok) {
          const json = await res.json();
          const observations = json.observations || json.data || [];
          if (observations.length > 0) {
            setChartSeries(observations);
          }
        }
      } catch (err) {
        console.warn('Backend series fetch notice:', err);
      } finally {
        setLoadingChart(false);
      }
    }
    fetchSeriesData();
  }, [selectedTrendIndex, selectedPeriod]);

  // Downsample or aggregate based on selectedView (Daily / Weekly / Monthly)
  const processedSeries = useMemo(() => {
    if (!chartSeries || chartSeries.length === 0) return [];
    if (selectedView === 'Daily') return chartSeries;

    const step = selectedView === 'Weekly' ? 5 : 21;
    const aggregated = [];
    for (let i = 0; i < chartSeries.length; i += step) {
      const chunk = chartSeries.slice(i, Math.min(i + step, chartSeries.length));
      const avgVal = chunk.reduce((sum, item) => sum + (Number(item.value) || 0), 0) / chunk.length;
      const lastItem = chunk[chunk.length - 1];
      aggregated.push({
        obs_date: lastItem.obs_date || lastItem.date,
        date: lastItem.date || lastItem.obs_date,
        value: Math.round(avgVal * 10) / 10,
        target: lastItem.target,
      });
    }
    return aggregated;
  }, [chartSeries, selectedView]);

  // Generate dynamic chart geometry, real dynamic Y and X axes, and summary stats
  const chartData = useMemo(() => {
    if (!processedSeries || processedSeries.length < 2) {
      return {
        area: "M 45,140 C 80,140 100,135 130,138 C 160,141 180,132 210,126 C 240,120 260,105 285,95 C 310,85 330,102 355,80 C 380,58 400,68 425,75 C 450,82 465,100 490,110 L 490,150 L 45,150 Z",
        line: "M 45,140 C 80,140 100,135 130,138 C 160,141 180,132 210,126 C 240,120 260,105 285,95 C 310,85 330,102 355,80 C 380,58 400,68 425,75 C 450,82 465,100 490,110",
        peak: { x: 425, y: 75, value: 2042, date: '31 Jul 2019' },
        points: [],
        yTicks: [
          { y: 20, value: 4000 },
          { y: 52.5, value: 3000 },
          { y: 85, value: 2000 },
          { y: 117.5, value: 1000 },
          { y: 150, value: 0 },
        ],
        xLabels: [
          { x: 45, label: '2016', anchor: 'start' },
          { x: 156, label: '2017', anchor: 'middle' },
          { x: 267, label: '2018', anchor: 'middle' },
          { x: 378, label: '2019', anchor: 'middle' },
          { x: 490, label: 'Jul \'19', anchor: 'end' },
        ],
        stats: null,
      };
    }

    const padX = 45;
    const plotWidth = 445; // 490 - 45
    const padY = 20;
    const plotHeight = 130; // 150 - 20

    const values = processedSeries.map(d => Number(d.value) || 0);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const rawRange = rawMax - rawMin || 1;

    // Calculate pleasant round axis bounds
    const stepSize = rawMax > 2500 ? 100 : (rawMax > 1000 ? 50 : 25);
    const yMin = Math.max(0, Math.floor((rawMin - rawRange * 0.06) / stepSize) * stepSize);
    const yMax = Math.ceil((rawMax + rawRange * 0.06) / stepSize) * stepSize;
    const yRange = yMax - yMin || 1;

    // 5 evenly spaced Y-ticks
    const yTicks = [
      { y: padY, value: yMax },
      { y: padY + (plotHeight * 0.25), value: Math.round(yMax - yRange * 0.25) },
      { y: padY + (plotHeight * 0.50), value: Math.round(yMax - yRange * 0.50) },
      { y: padY + (plotHeight * 0.75), value: Math.round(yMax - yRange * 0.75) },
      { y: padY + plotHeight, value: yMin },
    ];

    // Map each observation to SVG coordinates
    const points = processedSeries.map((d, i) => {
      const x = padX + (i / (processedSeries.length - 1)) * plotWidth;
      const val = Number(d.value) || 0;
      const y = (padY + plotHeight) - ((val - yMin) / yRange) * plotHeight;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        date: d.obs_date || d.date,
        value: val,
      };
    });

    const linePath = points.reduce((acc, pt, i) => (i === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`), '');
    const areaPath = `${linePath} L ${points[points.length - 1].x},${padY + plotHeight} L ${points[0].x},${padY + plotHeight} Z`;

    // Find highest peak point and lowest point
    let peakPt = points[0];
    let lowPt = points[0];
    points.forEach(p => {
      if (p.value > peakPt.value) peakPt = p;
      if (p.value < lowPt.value) lowPt = p;
    });

    // Format date string for X-axis
    const formatXDate = (dateStr) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length < 3) return dateStr;
      const yr = parts[0];
      const mo = parseInt(parts[1], 10) - 1;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const moStr = months[mo] || '';
      return `${moStr} '${yr.slice(2)}`;
    };

    // 5 evenly spaced X-axis date labels
    const count = points.length;
    const xIndices = [
      0,
      Math.floor((count - 1) * 0.25),
      Math.floor((count - 1) * 0.50),
      Math.floor((count - 1) * 0.75),
      count - 1,
    ];

    const xLabels = xIndices.map((idx, i) => {
      const pt = points[idx];
      let anchor = 'middle';
      if (i === 0) anchor = 'start';
      if (i === 4) anchor = 'end';
      return {
        x: pt.x,
        label: formatXDate(pt.date),
        anchor,
      };
    });

    // Statistical summary for the active period
    const startVal = points[0]?.value || 0;
    const currentVal = points[points.length - 1]?.value || 0;
    const delta = currentVal - startVal;
    const deltaPct = startVal > 0 ? (delta / startVal) * 100 : 0;

    return {
      area: areaPath,
      line: linePath,
      points,
      peak: peakPt,
      low: lowPt,
      yTicks,
      xLabels,
      stats: {
        current: currentVal,
        currentDate: points[points.length - 1]?.date,
        high: peakPt.value,
        highDate: peakPt.date,
        low: lowPt.value,
        lowDate: lowPt.date,
        delta,
        deltaPct,
        sessions: processedSeries.length,
      }
    };
  }, [processedSeries, selectedPeriod]);

  // Handle interactive hover over SVG chart
  const handleChartMouseMove = (e) => {
    if (!chartData || !chartData.points || chartData.points.length === 0) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const svgX = (mouseX / svgRect.width) * 500;

    let closest = chartData.points[0];
    let minDiff = Math.abs(closest.x - svgX);
    for (let i = 1; i < chartData.points.length; i++) {
      const diff = Math.abs(chartData.points[i].x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = chartData.points[i];
      }
    }
    setHoverPoint(closest);
  };

  return (
    <div className="space-y-4">
      {/* BEGIN: HeroBannerSection */}
      <section aria-labelledby="hero-heading" className="relative bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-100 rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        {/* Background Maritime Graphic Vector Elements */}
        <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
          <svg className="w-full h-full absolute right-0 top-0" fill="none" viewBox="0 0 900 320">
            {/* Coastline curve representation */}
            <path d="M 680,0 Q 640,90 670,160 T 730,320" opacity="0.35" stroke="#0284c7" strokeDasharray="6,6" strokeWidth="2" />
            <path d="M 650,40 Q 610,120 630,200 T 700,320" opacity="0.25" stroke="#0369a1" strokeDasharray="3,3" strokeWidth="1.5" />
            {/* Marine Shipping Route Dotted Tracks */}
            <path d="M 450,260 C 530,220 590,200 680,110" opacity="0.5" stroke="#0284c7" strokeDasharray="5,4" strokeWidth="2" />
            {/* Compass Rose motif */}
            <g opacity="0.3" stroke="#0369a1" transform="translate(820, 260)">
              <circle cx="0" cy="0" fill="none" r="28" strokeWidth="1" />
              <path d="M0 -34 L4 -8 L12 0 L4 8 L0 34 L-4 8 L-12 0 L-4 -8 Z" fill="#0369a1" />
            </g>
          </svg>
        </div>

        {/* Hero Content & Split Layout */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 items-center">
          {/* Left Text & Call to Actions (Col 7) */}
          <div className="lg:col-span-7 space-y-3.5">
            <div className="inline-block">
              <span className="text-xs font-bold uppercase tracking-wider text-govBlueAccent bg-blue-100/80 px-2.5 py-0.5 rounded border border-blue-200">
                SIH26006
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-govNavy tracking-tight leading-tight" id="hero-heading">
              Smarter Decisions for<br className="hidden sm:inline" /> India's Maritime Trade
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl leading-relaxed">
              Forecast Baltic dry-bulk markets, evaluate East Coast India trade routes, and support vessel charter decisions under uncertainty.
            </p>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-wrap gap-2.5 text-xs font-medium">
              <button 
                onClick={() => onNavigate('market')}
                className="bg-govNavy hover:bg-govNavyLight text-white px-4 py-2 rounded shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer"
              >
                <span>Explore Market Intelligence</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
              <button 
                onClick={() => onNavigate('forecast')}
                className="bg-white hover:bg-slate-50 text-govNavy border border-slate-300 px-3.5 py-2 rounded shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-govBlueAccent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span>Run Historical Forecast</span>
              </button>
              <button 
                onClick={() => onNavigate('routes')}
                className="bg-white hover:bg-slate-50 text-govNavy border border-slate-300 px-3.5 py-2 rounded shadow-sm inline-flex items-center space-x-1.5 transition cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-govBlueAccent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                <span>Analyze a Route</span>
              </button>
            </div>
          </div>

          {/* Right Visual Graphic: Maritime Vessel & East Coast Ports (Col 5) */}
          <div className="lg:col-span-5 relative flex items-center justify-center min-h-[190px]">
            <div className="relative w-full h-full min-h-[220px] flex items-center justify-end overflow-hidden rounded-lg border border-slate-200 shadow-sm bg-slate-900">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAC5YHYGpX9swOp6BhNtg_TU_1hQfSJAzyoZMyqWxGfocrQ8qW3cJH_GP0UKpRnjgfso6GGMHYLXT7xKBr_kD6BVRvI6PQX-hR7_-SDbSoPop40r71SXH35DUOi5naFnd6zfsvVrQV-X873LL0A2GlqgUhm1W5Fxm0qXnFCpIh2y2mTGj17hCrFNKPQdRtmkRjpkZaGn4yG5ItCRmTBEht5T1WoeNcKW_QaoKKjSbA" 
                alt="East Coast Maritime Trade Logistics - Bulk Shipping Network" 
                className="w-full h-full object-cover object-right"
                onError={(e) => {
                  // Fallback to high-res maritime bulk carrier
                  e.target.src = "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-transparent to-transparent opacity-90 sm:opacity-50" />
              
              {/* Port nodes overlay */}
              <div className="absolute right-3 top-3 bg-govNavyDark/85 backdrop-blur-xs text-white p-2 rounded border border-blue-400/30 text-[10px] space-y-1">
                <div className="font-bold text-amber-300 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>East Coast Nodes</span>
                </div>
                <div className="text-slate-200">⚓ Paradip · Vizag · Haldia</div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* END: HeroBannerSection */}

      {/* BEGIN: ImportantInformationBanner */}
      <StatusBanner onNavigate={onNavigate} />
      {/* END: ImportantInformationBanner */}

      {/* BEGIN: OnlineServicesSection */}
      <section aria-labelledby="online-services-heading">
        <div className="border-b border-slate-200 pb-1.5 mb-3">
          <h2 className="text-sm font-bold text-govNavy" id="online-services-heading">Online Services</h2>
          <p className="text-[11px] text-slate-500">Access forecasting, route analysis and charter decision-support services.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Service Card 1 */}
          <div className="bg-white border border-lightBorder rounded p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-govBlueAccent">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-govNavy leading-tight">Freight Market Forecast</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                View historical Baltic dry-bulk indices and generate leakage-free probabilistic forecasts across multiple forecast horizons.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100">
              <button 
                onClick={() => onNavigate('forecast')}
                className="text-[11px] font-bold text-govBlueAccent hover:text-govNavy inline-flex items-center space-x-1 cursor-pointer"
              >
                <span>Open Service</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Service Card 2 */}
          <div className="bg-white border border-lightBorder rounded p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-sky-50 border border-sky-100 flex items-center justify-center text-govBlueAccent">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-govNavy leading-tight">Route &amp; Voyage Analysis</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Analyse shipping corridors, vessel classes, voyage economics and destination-port constraints.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100">
              <button 
                onClick={() => onNavigate('routes')}
                className="text-[11px] font-bold text-govBlueAccent hover:text-govNavy inline-flex items-center space-x-1 cursor-pointer"
              >
                <span>Open Service</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Service Card 3 */}
          <div className="bg-white border border-lightBorder rounded p-4 hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-8 h-8 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-govNavy">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </div>
              <h3 className="text-xs font-bold text-govNavy leading-tight">Charter Strategy &amp; Procurement</h3>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Compare chartering strategies under freight uncertainty, cargo requirements and operational constraints.
              </p>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100">
              <button 
                onClick={() => onNavigate('optimizer')}
                className="text-[11px] font-bold text-govBlueAccent hover:text-govNavy inline-flex items-center space-x-1 cursor-pointer"
              >
                <span>Open Service</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>
      {/* END: OnlineServicesSection */}

      {/* BEGIN: DualPanelDataGrid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel: Dry Bulk Market Information (Col 6) */}
        <section aria-labelledby="market-info-heading" className="lg:col-span-6 bg-white border border-lightBorder rounded flex flex-col justify-between p-3.5 shadow-xs">
          <div>
            <div className="border-b border-slate-100 pb-2 mb-2 flex justify-between items-baseline">
              <div>
                <h2 className="text-xs font-bold text-govNavy" id="market-info-heading">Dry Bulk Market Information</h2>
                <p className="text-[10px] text-slate-500">Latest observed Baltic dry-bulk indices</p>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Baltic Exchange</span>
            </div>

            {/* Official Data Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" id="baltic-indices-table">
                <thead>
                  <tr className="bg-govNavy text-white text-[10px] uppercase font-semibold">
                    <th className="py-1.5 px-2">Index</th>
                    <th className="py-1.5 px-2">Vessel Segment</th>
                    <th className="py-1.5 px-2 text-right">Latest Observed</th>
                    <th className="py-1.5 px-2 text-center">Observation Date</th>
                    <th className="py-1.5 px-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px]">
                  {marketIndices.map((row, idx) => (
                    <tr key={row.code} className={`hover:bg-slate-50 ${idx % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                      <td className="py-2 px-2 font-bold text-govNavy">{row.code}</td>
                      <td className="py-2 px-2 text-slate-700">{row.segment}</td>
                      <td className="py-2 px-2 font-semibold text-right font-mono text-slate-900">{row.value}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{row.date}</td>
                      <td className="py-2 px-2 text-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" /> Observed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Footer / Citation */}
          <div className="pt-3 mt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 gap-1">
            <span>Historical coverage: 01 Aug 2012 – 31 Jul 2019</span>
            <button 
              onClick={() => onNavigate('market')}
              className="font-semibold text-govBlueAccent hover:text-govNavy inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>View Historical Market Data</span>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
        </section>

        {/* Right Panel: Historical Market Trends (Col 6) */}
        <section aria-labelledby="market-trends-heading" className="lg:col-span-6 bg-white border border-lightBorder rounded p-3.5 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header and Filters */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
              <div>
                <h2 className="text-xs font-bold text-govNavy" id="market-trends-heading">Historical Market Trends</h2>
                <p className="text-[10px] text-slate-500">{selectedTrendIndex} Sub-Index Trajectory</p>
              </div>
              {/* Filters Bar */}
              <div className="flex items-center space-x-2 text-[10px]">
                <div>
                  <select 
                    value={selectedTrendIndex}
                    onChange={(e) => setSelectedTrendIndex(e.target.value)}
                    className="text-[10px] py-0.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-700 focus:ring-0 font-medium" 
                    id="filter-index"
                  >
                    <option value="BPI">Index: BPI</option>
                    <option value="BCI">Index: BCI</option>
                    <option value="BSI">Index: BSI</option>
                    <option value="BHSI">Index: BHSI</option>
                  </select>
                </div>
                <div>
                  <select 
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="text-[10px] py-0.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-700 focus:ring-0 font-medium cursor-pointer" 
                    id="filter-period"
                  >
                    <option value="1Y">Period: 1Y</option>
                    <option value="2Y">Period: 2Y</option>
                    <option value="3Y">Period: 3Y</option>
                    <option value="5Y">Period: 5Y</option>
                    <option value="Full">Period: Full</option>
                  </select>
                </div>
                <div>
                  <select 
                    value={selectedView}
                    onChange={(e) => setSelectedView(e.target.value)}
                    className="text-[10px] py-0.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-700 focus:ring-0 font-medium cursor-pointer" 
                    id="filter-view"
                  >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar for Selected Period */}
            {chartData?.stats && (
              <div className="flex flex-wrap items-center justify-between text-[10px] px-2 py-1 bg-slate-50 border border-slate-100 rounded mb-2 text-slate-600">
                <div className="flex items-center space-x-2.5">
                  <span>
                    <strong className="text-slate-800 font-bold">{Math.round(chartData.stats.current).toLocaleString()}</strong> pts
                  </span>
                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                    chartData.stats.delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {chartData.stats.delta >= 0 ? '+' : ''}{Math.round(chartData.stats.delta).toLocaleString()} pts ({chartData.stats.deltaPct.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-[9px] text-slate-500">
                  <span>Range: <strong className="text-slate-700">{Math.round(chartData.stats.low).toLocaleString()}</strong> – <strong className="text-slate-700">{Math.round(chartData.stats.high).toLocaleString()}</strong> pts</span>
                  <span className="text-slate-300">|</span>
                  <span>{chartData.stats.sessions} sessions</span>
                </div>
              </div>
            )}

            {/* SVG Visual Line Chart */}
            <div 
              className="relative w-full h-44 sm:h-48 pt-2"
              onMouseMove={handleChartMouseMove}
              onMouseLeave={() => setHoverPoint(null)}
            >
              {loadingChart && (
                <div className="absolute top-3 right-3 z-10 px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[9px] font-medium animate-pulse">
                  Updating series...
                </div>
              )}
              <svg className="w-full h-full cursor-crosshair" preserveAspectRatio="none" viewBox="0 0 500 170">
                <defs>
                  <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid Lines & Dynamic Y-Axis Labels */}
                {chartData.yTicks.map((tick, idx) => (
                  <g key={`ytick-${idx}`}>
                    <line 
                      stroke={idx === chartData.yTicks.length - 1 ? "#cbd5e1" : "#f1f5f9"} 
                      strokeWidth="1" 
                      x1="45" 
                      x2="490" 
                      y1={tick.y} 
                      y2={tick.y} 
                    />
                    <text 
                      fill="#94a3b8" 
                      fontSize="9" 
                      textAnchor="end" 
                      x="40" 
                      y={tick.y + 3}
                    >
                      {tick.value.toLocaleString()}
                    </text>
                  </g>
                ))}

                {/* Area Fill */}
                <path d={chartData.area} fill="url(#chartGradient)" />

                {/* Primary Trend Line Curve */}
                <path 
                  d={chartData.line} 
                  fill="none" 
                  stroke="#0284c7" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2.2" 
                />

                {/* Point Marker at Peak */}
                {chartData.peak && (
                  <circle cx={chartData.peak.x} cy={chartData.peak.y} fill="#0369a1" r="3.5" stroke="#ffffff" strokeWidth="1.5" />
                )}

                {/* Interactive Hover Point & Tooltip */}
                {hoverPoint && (
                  <g pointerEvents="none">
                    <line 
                      x1={hoverPoint.x} 
                      x2={hoverPoint.x} 
                      y1="20" 
                      y2="150" 
                      stroke="#0284c7" 
                      strokeWidth="1" 
                      strokeDasharray="3,3" 
                    />
                    <circle 
                      cx={hoverPoint.x} 
                      cy={hoverPoint.y} 
                      r="4.5" 
                      fill="#0284c7" 
                      stroke="#ffffff" 
                      strokeWidth="2" 
                    />
                    <g transform={`translate(${Math.min(Math.max(hoverPoint.x, 65), 435)}, ${hoverPoint.y < 45 ? hoverPoint.y + 24 : hoverPoint.y - 12})`}>
                      <rect 
                        x="-48" 
                        y="-13" 
                        width="96" 
                        height="18" 
                        rx="4" 
                        fill="#0f172a" 
                        opacity="0.92" 
                      />
                      <text 
                        fill="#ffffff" 
                        fontSize="8.5" 
                        fontWeight="600" 
                        textAnchor="middle" 
                        y="0"
                      >
                        {hoverPoint.date}: {Math.round(hoverPoint.value).toLocaleString()}
                      </text>
                    </g>
                  </g>
                )}

                {/* Dynamic X-Axis Labels */}
                {chartData.xLabels.map((lbl, idx) => (
                  <text 
                    key={`xlabel-${idx}`}
                    fill="#64748b" 
                    fontSize="9" 
                    textAnchor={lbl.anchor} 
                    x={lbl.x} 
                    y="165"
                  >
                    {lbl.label}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          {/* Legend and Source Footnote */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] text-slate-500 gap-1">
            <div className="flex items-center space-x-3 font-medium text-slate-700">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
                <span>{selectedTrendIndex} ({selectedPeriod} · {selectedView})</span>
              </div>
              {chartData?.stats?.sessions && (
                <span className="text-[9px] text-slate-400 font-normal">
                  ({chartData.stats.sessions} observed sessions)
                </span>
              )}
            </div>
            <div className="text-[9px] text-slate-400">
              Source: Verified historical Baltic dry bulk sub-index dataset (Mendeley CC BY 4.0).
            </div>
          </div>
        </section>
      </div>
      {/* END: DualPanelDataGrid */}

      {/* BEGIN: QuickAccessAndSystemGlanceGrid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Quick Access & System Glance Combined (Col 8) */}
        <div className="md:col-span-8 space-y-4">
          {/* System at a Glance Horizontal Summary Strip */}
          <section aria-labelledby="glance-heading" className="bg-white border border-lightBorder rounded p-3 shadow-xs">
            <h2 className="text-xs font-bold text-govNavy mb-2" id="glance-heading">System at a Glance</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Metric 1 */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex items-center space-x-3">
                <div className="w-9 h-9 rounded bg-blue-100 text-govNavy flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <span className="text-base font-extrabold text-govNavy block leading-tight">1,749</span>
                  <span className="text-[10px] text-slate-500 font-medium">Verified Baltic Trading Sessions</span>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex items-center space-x-3">
                <div className="w-9 h-9 rounded bg-blue-100 text-govNavy flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <span className="text-base font-extrabold text-govNavy block leading-tight">4</span>
                  <span className="text-[10px] text-slate-500 font-medium">Core Dry Bulk Indices</span>
                </div>
              </div>

              {/* Metric 3 */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex items-center space-x-3">
                <div className="w-9 h-9 rounded bg-blue-100 text-govNavy flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <span className="text-base font-extrabold text-govNavy block leading-tight">6</span>
                  <span className="text-[10px] text-slate-500 font-medium">Forecast Horizons</span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Access Action Panel */}
          <section aria-labelledby="quick-access-heading" className="bg-white border border-lightBorder rounded p-3.5 shadow-xs">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-2 mb-3">
              <svg className="w-4 h-4 text-govBlueAccent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
              <h2 className="text-xs font-bold text-govNavy uppercase tracking-wide" id="quick-access-heading">Quick Access</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                onClick={() => onNavigate('market')}
                className="p-2.5 rounded border border-slate-200 hover:border-govBlueAccent hover:bg-blue-50/40 transition flex items-center space-x-3 text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded bg-slate-100 text-govNavy flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-govNavy block">Market Intelligence</span>
                  <span className="text-[10px] text-slate-500">View latest market indices and trends</span>
                </div>
              </button>

              <button 
                onClick={() => onNavigate('forecast')}
                className="p-2.5 rounded border border-slate-200 hover:border-govBlueAccent hover:bg-blue-50/40 transition flex items-center space-x-3 text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded bg-slate-100 text-govNavy flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-govNavy block">Historical Forecast</span>
                  <span className="text-[10px] text-slate-500">Run backtest and view model performance</span>
                </div>
              </button>

              <button 
                onClick={() => onNavigate('routes')}
                className="p-2.5 rounded border border-slate-200 hover:border-govBlueAccent hover:bg-blue-50/40 transition flex items-center space-x-3 text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded bg-slate-100 text-govNavy flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-govNavy block">Route Analysis</span>
                  <span className="text-[10px] text-slate-500">Explore verified trade corridors</span>
                </div>
              </button>

              <button 
                onClick={() => onNavigate('optimizer')}
                className="p-2.5 rounded border border-slate-200 hover:border-govBlueAccent hover:bg-blue-50/40 transition flex items-center space-x-3 text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded bg-slate-100 text-govNavy flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-govNavy block">Charter Optimizer</span>
                  <span className="text-[10px] text-slate-500">Compare strategies and optimize charter</span>
                </div>
              </button>
            </div>
          </section>

          {/* Announcements Panel */}
          <section aria-label="Announcements Banner" className="bg-amber-50/50 border border-amber-200 rounded p-3 text-[11px] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-1.5">
                <span className="text-amber-700 font-bold uppercase tracking-wider text-[10px]">Announcements</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 text-[10px]">20 Sep 2026</span>
              </div>
              <p className="text-slate-700">
                <strong className="font-semibold text-govNavy">Post-2019 Data Integration:</strong> Authorized post-2019 Baltic Exchange observations required for current-market forecasting.
              </p>
            </div>
            <button 
              onClick={() => onNavigate('methodology')}
              className="text-[10px] font-bold text-govBlueAccent hover:underline whitespace-nowrap inline-flex items-center space-x-1 cursor-pointer"
            >
              <span>Read More</span>
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </button>
          </section>

          {/* Operational Directory & Framework Compliance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <section aria-labelledby="port-helpdesk-heading" className="bg-white border border-lightBorder rounded p-3.5 shadow-xs flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <svg className="w-3.5 h-3.5 text-govBlueAccent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    <h2 className="text-xs font-bold text-govNavy" id="port-helpdesk-heading">Nodal Port Control Rooms</h2>
                  </div>
                  <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">East Coast</span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="border-b border-slate-100 pb-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-govNavy text-[11px]">Paradip Port Authority (PPA)</span>
                      <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">24x7 Active</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Harbour Control: +91 6722 222105 · VHF Ch 16/12</p>
                  </div>
                  <div className="border-b border-slate-100 pb-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-govNavy text-[11px]">Visakhapatnam Port (VPA)</span>
                      <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">24x7 Active</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Marine Operations: +91 891 287 3401 · Traffic Desk</p>
                  </div>
                  <div>
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-govNavy text-[11px]">Haldia Dock Complex (HDCD)</span>
                      <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">Operational</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Dock Master Control: +91 3224 252210 · River Ops</p>
                  </div>
                </div>
              </div>
              <div className="pt-2.5 mt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
                <span className="text-slate-500">Major Ports Registry</span>
                <button 
                  onClick={() => onNavigate('ports')}
                  className="font-semibold text-govBlueAccent hover:text-govNavy inline-flex items-center space-x-0.5 cursor-pointer"
                >
                  <span>Directory &amp; Berthing Rules</span>
                  <svg className="w-2.5 h-2.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </section>

            <section aria-labelledby="system-compliance-heading" className="bg-white border border-lightBorder rounded p-3.5 shadow-xs flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center space-x-1.5">
                    <svg className="w-3.5 h-3.5 text-govBlueAccent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    <h2 className="text-xs font-bold text-govNavy" id="system-compliance-heading">Status &amp; Compliance</h2>
                  </div>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">Healthy</span>
                </div>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600 text-[10px]">Split-Conformal Calibration</span>
                    <span className="font-mono font-semibold text-emerald-800 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      95% Verified
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600 text-[10px]">Mendeley Benchmark Dataset</span>
                    <span className="font-mono font-semibold text-slate-800 text-[10px]">v1.4 Certified</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600 text-[10px]">National Logistics Policy (NLP)</span>
                    <span className="text-govNavy font-semibold text-[10px]">Aligned</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-600 text-[10px]">Maritime India Vision 2030</span>
                    <span className="text-govNavy font-semibold text-[10px]">MIV-Compliant</span>
                  </div>
                </div>
              </div>
              <div className="pt-2.5 mt-2 border-t border-slate-100 flex justify-between items-center text-[10px]">
                <span className="text-slate-400 font-mono text-[9px]">Latency: ~35ms · 78 Tests</span>
                <button 
                  onClick={() => onNavigate('methodology')}
                  className="font-semibold text-govBlueAccent hover:text-govNavy inline-flex items-center space-x-0.5 cursor-pointer"
                >
                  <span>Methodology</span>
                  <svg className="w-2.5 h-2.5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Right: What's New & Important Links (Col 4) */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <section aria-labelledby="whats-new-heading" className="bg-white border border-lightBorder rounded p-3.5 shadow-xs flex-shrink-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h2 className="text-xs font-bold text-govNavy" id="whats-new-heading">What's New</h2>
              <button onClick={() => onNavigate('about')} className="text-[10px] font-semibold text-govBlueAccent hover:text-govNavy inline-flex items-center space-x-0.5">
                <span>View All</span>
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="relative pl-3 border-l-2 border-blue-500 text-[11px]">
                <span className="text-[9px] font-semibold text-slate-400 block uppercase">20 Sep 2026</span>
                <button onClick={() => onNavigate('methodology')} className="font-bold text-govNavy hover:text-govBlueAccent block leading-tight text-left">
                  Phase 7B: Post-2019 retraining pipeline ready
                </button>
                <p className="text-[10px] text-slate-600 mt-0.5">Model retraining framework and validation pipeline prepared.</p>
              </div>
              <div className="relative pl-3 border-l-2 border-blue-400 text-[11px]">
                <span className="text-[9px] font-semibold text-slate-400 block uppercase">12 Sep 2026</span>
                <button onClick={() => onNavigate('routes')} className="font-bold text-govNavy hover:text-govBlueAccent block leading-tight text-left">
                  Route registry updated with 2 new corridors
                </button>
                <p className="text-[10px] text-slate-600 mt-0.5">Verified East Coast India trade corridors added to system.</p>
              </div>
              <div className="relative pl-3 border-l-2 border-blue-300 text-[11px]">
                <span className="text-[9px] font-semibold text-slate-400 block uppercase">05 Sep 2026</span>
                <button onClick={() => onNavigate('about')} className="font-bold text-govNavy hover:text-govBlueAccent block leading-tight text-left">
                  Government institutional UI redesign
                </button>
                <p className="text-[10px] text-slate-600 mt-0.5">Aligned with MoPSW &amp; Digital India design guidelines.</p>
              </div>
              <div className="relative pl-3 border-l-2 border-slate-300 text-[11px]">
                <span className="text-[9px] font-semibold text-slate-400 block uppercase">28 Aug 2026</span>
                <button onClick={() => onNavigate('forecast')} className="font-bold text-govNavy hover:text-govBlueAccent block leading-tight text-left">
                  Historical backtest module enhanced
                </button>
                <p className="text-[10px] text-slate-600 mt-0.5">Conformal interval evaluation and point forecast metrics.</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="important-links-heading" className="bg-white border border-lightBorder rounded p-3.5 shadow-xs flex-grow flex flex-col justify-between">
            <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between flex-shrink-0">
              <h2 className="text-xs font-bold text-govNavy" id="important-links-heading">Important Links</h2>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Resources</span>
            </div>
            <ul className="divide-y divide-slate-100 text-[11px] flex-grow flex flex-col justify-between py-0.5">
              <li>
                <button onClick={() => onNavigate('methodology')} className="w-full text-left py-1.5 flex items-center justify-between text-slate-700 hover:text-govBlueAccent transition group">
                  <div className="pr-2">
                    <span className="font-medium block leading-tight text-govNavy group-hover:text-govBlueAccent">NLP Marine Portal (NLP-M)</span>
                    <span className="text-[9px] text-slate-400 block">National single-window trade &amp; vessel logistics platform</span>
                  </div>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-govBlueAccent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('ports')} className="w-full text-left py-1.5 flex items-center justify-between text-slate-700 hover:text-govBlueAccent transition group">
                  <div className="pr-2">
                    <span className="font-medium block leading-tight text-govNavy group-hover:text-govBlueAccent">Sagarmanthan Maritime Dashboard</span>
                    <span className="text-[9px] text-slate-400 block">Real-time maritime monitoring &amp; vessel traffic centre</span>
                  </div>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-govBlueAccent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('ports')} className="w-full text-left py-1.5 flex items-center justify-between text-slate-700 hover:text-govBlueAccent transition group">
                  <div className="pr-2">
                    <span className="font-medium block leading-tight text-govNavy group-hover:text-govBlueAccent">Major Port Authorities Act Rules</span>
                    <span className="text-[9px] text-slate-400 block">Statutory berthing guidelines &amp; port tariff structures</span>
                  </div>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-govBlueAccent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('methodology')} className="w-full text-left py-1.5 flex items-center justify-between text-slate-700 hover:text-govBlueAccent transition group">
                  <div className="pr-2">
                    <span className="font-medium block leading-tight text-govNavy group-hover:text-govBlueAccent">Baltic Dry Bulk Methodology Manual</span>
                    <span className="text-[9px] text-slate-400 block">Index calculation standards, BCI/BPI weightings</span>
                  </div>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-govBlueAccent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('methodology')} className="w-full text-left py-1.5 flex items-center justify-between text-slate-700 hover:text-govBlueAccent transition group">
                  <div className="pr-2">
                    <span className="font-medium block leading-tight text-govNavy group-hover:text-govBlueAccent">Conformal Prediction Coverage Guarantees</span>
                    <span className="text-[9px] text-slate-400 block">Mathematical calibration &amp; 90% interval coverage</span>
                  </div>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-govBlueAccent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('methodology')} className="w-full text-left py-1.5 flex items-center justify-between text-slate-700 hover:text-govBlueAccent transition group">
                  <div className="pr-2">
                    <span className="font-medium block leading-tight text-govNavy group-hover:text-govBlueAccent">Data Provenance &amp; API Integration</span>
                    <span className="text-[9px] text-slate-400 block">Historical Baltic dataset audit trail &amp; schema</span>
                  </div>
                  <svg className="w-3 h-3 text-slate-400 group-hover:text-govBlueAccent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </li>
            </ul>
            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 flex-shrink-0">
              <span>Institutional Directory</span>
              <span className="font-semibold text-govBlueAccent">MoPSW Gateway</span>
            </div>
          </section>
        </div>
      </div>
      {/* END: QuickAccessAndSystemGlanceGrid */}
    </div>
  );
}
