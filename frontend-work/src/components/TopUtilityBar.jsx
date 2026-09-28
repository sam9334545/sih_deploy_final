import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function TopUtilityBar() {
  const [fontSize, setFontSize] = useState('normal');
  const { lang, setLang, t } = useLanguage();
  const [showReaderModal, setShowReaderModal] = useState(false);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showReaderModal) {
        setShowReaderModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showReaderModal]);

  return (
    <>
      <aside aria-label="Official Government Header Bar" className="bg-govNavyDark text-slate-200 border-b border-blue-950 px-4 py-1 text-[11px]">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          {/* Left: Emblem & Ministry Title */}
          <div className="flex items-center space-x-2">
            {/* Ashoka Chakra Motif SVG */}
            <svg className="w-4 h-4 text-amber-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" fill="currentColor" r="3" />
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" stroke="currentColor" strokeWidth="1" />
            </svg>
            <span className="font-medium text-white tracking-wide">{t('gov_title')}</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-300 font-medium">{t('ministry_title')}</span>
          </div>

          {/* Right: Accessibility & Language Controls */}
          <div className="flex items-center space-x-3 text-slate-300">
            <a className="hover:text-white transition-colors text-[10px] focus:underline focus:outline-none" href="#main-content">
              {t('skip_content')}
            </a>
            <span className="text-slate-500">|</span>
            <button
              type="button"
              onClick={() => setShowReaderModal(true)}
              aria-haspopup="dialog"
              aria-expanded={showReaderModal}
              className="hover:text-white transition-colors text-[10px] cursor-pointer underline decoration-dotted underline-offset-2 focus:outline-none focus:text-white focus:ring-1 focus:ring-amber-300 rounded px-1"
              title="View screen reader compatibility and accessibility information"
            >
              {t('screen_reader')}
            </button>
            <span className="text-slate-500">|</span>

            {/* Text Resizer */}
            <div className="flex items-center space-x-1 font-semibold text-[10px]">
              <button 
                onClick={() => { setFontSize('small'); document.documentElement.style.fontSize = '13px'; }}
                className={`hover:text-white px-0.5 ${fontSize === 'small' ? 'text-amber-300 underline' : ''}`}
                title={t('decrease_text')} 
                type="button"
              >
                A-
              </button>
              <button 
                onClick={() => { setFontSize('normal'); document.documentElement.style.fontSize = '14px'; }}
                className={`hover:text-white px-0.5 ${fontSize === 'normal' ? 'text-amber-300 underline' : ''}`}
                title={t('normal_text')} 
                type="button"
              >
                A
              </button>
              <button 
                onClick={() => { setFontSize('large'); document.documentElement.style.fontSize = '15px'; }}
                className={`hover:text-white px-0.5 ${fontSize === 'large' ? 'text-amber-300 underline' : ''}`}
                title={t('increase_text')} 
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
                className={`hover:text-white px-1.5 py-0.5 rounded transition ${lang === 'hi' ? 'bg-amber-400 text-slate-900 font-bold shadow-xs' : 'text-slate-300 font-medium'}`}
              >
                हिन्दी
              </button>
              <span className="text-slate-500">|</span>
              <button 
                onClick={() => setLang('en')} 
                className={`hover:text-white px-1.5 py-0.5 rounded transition ${lang === 'en' ? 'bg-blue-800 text-white font-bold shadow-xs' : 'text-slate-300 font-medium'}`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Screen Reader Access Modal (GIGW & WCAG 2.1 AA Compliance) */}
      {showReaderModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-modal-title"
          onClick={() => setShowReaderModal(false)}
        >
          <div 
            className="bg-white text-slate-800 rounded-lg shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-govNavyDark px-6 py-4 text-white flex items-center justify-between border-b border-blue-900">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-900/60 border border-blue-700/60 flex items-center justify-center text-amber-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </div>
                <div>
                  <h3 id="accessibility-modal-title" className="text-sm font-semibold tracking-wide">
                    {t('sr_modal_title')}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    {t('sr_modal_sub')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReaderModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
                aria-label="Close accessibility guide"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs leading-relaxed">
              <p className="text-slate-600">
                {t('sr_modal_desc')}
              </p>

              {/* Supported Screen Readers Table */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-800 text-[11px] border-b border-slate-200">
                  {t('sr_supported_readers')}
                </div>
                <div className="divide-y divide-slate-200">
                  <div className="grid grid-cols-3 px-3 py-2 text-[11px] bg-white items-center">
                    <span className="font-semibold text-slate-800">{t('sr_win_narrator')}</span>
                    <span className="text-slate-600">{t('sr_win_narrator_desc')}</span>
                    <span className="text-slate-500 font-mono text-[10px]">Win + Ctrl + Enter</span>
                  </div>
                  <div className="grid grid-cols-3 px-3 py-2 text-[11px] bg-slate-50/50 items-center">
                    <span className="font-semibold text-slate-800">{t('sr_nvda')}</span>
                    <span className="text-slate-600">{t('sr_nvda_desc')}</span>
                    <span className="text-blue-700">nvaccess.org</span>
                  </div>
                  <div className="grid grid-cols-3 px-3 py-2 text-[11px] bg-white items-center">
                    <span className="font-semibold text-slate-800">{t('sr_jaws')}</span>
                    <span className="text-slate-600">{t('sr_jaws_desc')}</span>
                    <span className="text-slate-500 font-mono text-[10px]">Insert + Down Arrow</span>
                  </div>
                  <div className="grid grid-cols-3 px-3 py-2 text-[11px] bg-slate-50/50 items-center">
                    <span className="font-semibold text-slate-800">{t('sr_voiceover')}</span>
                    <span className="text-slate-600">{t('sr_voiceover_desc')}</span>
                    <span className="text-slate-500 font-mono text-[10px]">Cmd + F5</span>
                  </div>
                </div>
              </div>

              {/* Keyboard Shortcuts Guide */}
              <div className="bg-blue-50/60 border border-blue-100 rounded-md p-3.5 space-y-2">
                <div className="font-semibold text-blue-950 text-[11px] flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t('sr_keyboard_nav')}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-xs font-mono text-[10px]">Tab</kbd>
                    <span>{t('sr_key_tab')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-xs font-mono text-[10px]">Shift + Tab</kbd>
                    <span>{t('sr_key_shift_tab')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-xs font-mono text-[10px]">Enter / Space</kbd>
                    <span>{t('sr_key_enter')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded shadow-xs font-mono text-[10px]">Esc</kbd>
                    <span>{t('sr_key_esc')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">
                {t('ministry_title')}
              </span>
              <button
                type="button"
                onClick={() => setShowReaderModal(false)}
                className="px-3.5 py-1.5 bg-govNavy text-white font-medium rounded hover:bg-govNavyDark transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {t('sr_close_guide')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
