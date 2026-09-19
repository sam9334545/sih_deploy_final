import React, { useState } from 'react';

export default function TopUtilityBar() {
  const [fontSize, setFontSize] = useState('normal');
  const [lang, setLang] = useState('en');

  return (
    <aside aria-label="Official Government Header Bar" className="bg-govNavyDark text-slate-200 border-b border-blue-950 px-4 py-1 text-[11px]">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
        {/* Left: Emblem & Ministry Title */}
        <div className="flex items-center space-x-2">
          {/* Ashoka Chakra Motif SVG */}
          <svg className="w-4 h-4 text-amber-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" fill="currentColor" r="3" />
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span className="font-medium text-white tracking-wide">Government of India</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300 font-medium">Ministry of Ports, Shipping &amp; Waterways</span>
        </div>

        {/* Right: Accessibility & Language Controls */}
        <div className="flex items-center space-x-3 text-slate-300">
          <a className="hover:text-white transition-colors text-[10px]" href="#main-content">
            Skip to Main Content
          </a>
          <span className="text-slate-500">|</span>
          <span className="hover:text-white transition-colors text-[10px] cursor-pointer">
            Screen Reader Access
          </span>
          <span className="text-slate-500">|</span>

          {/* Text Resizer */}
          <div className="flex items-center space-x-1 font-semibold text-[10px]">
            <button 
              onClick={() => { setFontSize('small'); document.documentElement.style.fontSize = '13px'; }}
              className={`hover:text-white px-0.5 ${fontSize === 'small' ? 'text-amber-300 underline' : ''}`}
              title="Decrease text size" 
              type="button"
            >
              A-
            </button>
            <button 
              onClick={() => { setFontSize('normal'); document.documentElement.style.fontSize = '14px'; }}
              className={`hover:text-white px-0.5 ${fontSize === 'normal' ? 'text-amber-300 underline' : ''}`}
              title="Normal text size" 
              type="button"
            >
              A
            </button>
            <button 
              onClick={() => { setFontSize('large'); document.documentElement.style.fontSize = '15px'; }}
              className={`hover:text-white px-0.5 ${fontSize === 'large' ? 'text-amber-300 underline' : ''}`}
              title="Increase text size" 
              type="button"
            >
              A+
            </button>
          </div>
          <span className="text-slate-500">|</span>

          {/* Languages */}
          <div className="flex items-center space-x-1 text-[10px]">
            <button 
              onClick={() => setLang('hi')} 
              className={`hover:text-white font-medium ${lang === 'hi' ? 'text-amber-300 font-bold' : ''}`}
            >
              हिन्दी
            </button>
            <span className="text-slate-500">|</span>
            <button 
              onClick={() => setLang('en')} 
              className={`hover:text-white font-medium ${lang === 'en' ? 'text-white font-bold' : ''}`}
            >
              English
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
