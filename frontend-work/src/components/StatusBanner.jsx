import React from 'react';

export default function StatusBanner({ onNavigate }) {
  return (
    <section aria-label="System Notice" className="bg-bannerBg border border-bannerBorder rounded-md p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
      <div className="flex items-start sm:items-center space-x-2.5">
        {/* Info Circle Icon */}
        <div className="text-govBlueAccent mt-0.5 sm:mt-0 flex-shrink-0">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" fillRule="evenodd" />
          </svg>
        </div>
        <div className="text-[11px] leading-snug">
          <strong className="text-govNavy font-bold">Important Information:</strong>
          <span className="text-slate-700 ml-1">
            Data Status: Historical market data currently available through 31 July 2019 (1,749 verified trading sessions). Current-market forecasting will be enabled after authorized post-2019 Baltic Exchange observations are integrated.
          </span>
        </div>
      </div>
      <button 
        onClick={() => onNavigate('methodology')} 
        className="text-[11px] font-semibold text-govBlueAccent hover:text-govNavy whitespace-nowrap inline-flex items-center space-x-1 flex-shrink-0 pl-7 sm:pl-0 cursor-pointer"
      >
        <span>View Data Status</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </button>
    </section>
  );
}
