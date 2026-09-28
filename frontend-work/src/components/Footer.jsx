import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function Footer({ onNavigate }) {
  const { t } = useLanguage();

  return (
    <footer aria-label="Portal Footer" className="bg-govNavyDark text-slate-300 text-[11px] border-t-4 border-amber-400 mt-8">
      {/* Top Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Brand & SIH Info (Col 2) */}
        <div className="md:col-span-2 space-y-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-4 h-4 stroke-current" fill="none" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" x2="12" y1="2" y2="4" />
                <line x1="12" x2="12" y1="20" y2="22" />
                <line x1="2" x2="4" y1="12" y2="12" />
                <line x1="20" x2="22" y1="12" y2="12" />
              </svg>
            </div>
            <div>
              <span className="text-white font-bold tracking-wide block">SIH26006</span>
              <span className="text-slate-300 text-[11px] font-medium">{t('brand_title')}</span>
            </div>
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed max-w-sm">
            {t('footer_tagline')}
          </p>
          <div className="text-[10px] text-slate-400 pt-1">
            <span>{t('footer_focus_ports')} </span>
            <span className="text-slate-300 font-medium">Paradip, Visakhapatnam, Dhamra, Haldia, Gangavaram, Gopalpur</span>
          </div>
        </div>

        {/* Footer Nav 1: Platform */}
        <div>
          <h3 className="text-white font-bold text-xs mb-2">{t('footer_workflows')}</h3>
          <ul className="space-y-1.5 text-slate-400 text-[10px]">
            <li>
              <button onClick={() => onNavigate('dashboard')} className="hover:text-white transition text-left cursor-pointer">
                {t('tab_dashboard')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('planner')} className="hover:text-white transition text-left cursor-pointer">
                {t('tab_planner')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('forecast')} className="hover:text-white transition text-left cursor-pointer">
                {t('tab_forecast')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('ports')} className="hover:text-white transition text-left cursor-pointer">
                {t('tab_ports')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('vessels')} className="hover:text-white transition text-left cursor-pointer">
                {t('tab_vessels')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('simulator')} className="hover:text-white transition text-left cursor-pointer">
                {t('tab_simulator')}
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('risks')} className="hover:text-white transition text-left cursor-pointer">
                {t('tab_risks')}
              </button>
            </li>
          </ul>
        </div>

        {/* Footer Nav 2: Data & Governance */}
        <div>
          <h3 className="text-white font-bold text-xs mb-2">Data &amp; Rules</h3>
          <ul className="space-y-1.5 text-slate-400 text-[10px]">
            <li>
              <button onClick={() => onNavigate('methodology')} className="hover:text-white transition text-left">
                Data Provenance
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('methodology')} className="hover:text-white transition text-left">
                Quantile LightGBM Models
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('methodology')} className="hover:text-white transition text-left">
                Split Conformal Calibration
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('methodology')} className="hover:text-white transition text-left">
                Historical Coverage (2012–2019)
              </button>
            </li>
            <li>
              <button onClick={() => onNavigate('methodology')} className="hover:text-white transition text-left">
                Post-2019 Intake Policy
              </button>
            </li>
          </ul>
        </div>

        {/* Footer Nav 3: Project & Digital India */}
        <div className="flex flex-col justify-between">
          <div>
            <h3 className="text-white font-bold text-xs mb-2">Project</h3>
            <ul className="space-y-1.5 text-slate-400 text-[10px]">
              <li>
                <button onClick={() => onNavigate('about')} className="hover:text-white transition text-left">
                  SIH26006 Problem Statement
                </button>
              </li>
              <li>
                <a 
                  href="/docs" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="hover:text-white transition inline-flex items-center space-x-1"
                >
                  <span>API Documentation (Swagger)</span>
                </a>
              </li>
              <li>
                <button onClick={() => onNavigate('methodology')} className="hover:text-white transition text-left">
                  System Architecture
                </button>
              </li>
            </ul>
          </div>

          {/* Digital India Visual Badge */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center space-x-2">
            <div className="w-7 h-7 rounded bg-white p-1 flex items-center justify-center text-govNavy font-black text-[9px] leading-none flex-shrink-0">
              DI
            </div>
            <div className="text-[9px] text-slate-400 leading-tight">
              <span className="text-white font-semibold block">Digital India</span>
              Power To Empower
            </div>
          </div>
        </div>
      </div>

      {/* Legal Disclaimer Bar */}
      <div className="bg-govActiveNav py-3 px-4 border-t border-blue-950 text-[10px] text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-center md:text-left">
            &copy; 2026, SIH26006. This is an algorithmic decision-support platform. Forecasts are probabilistic estimates and should be interpreted with the stated data coverage, assumptions and uncertainty.
          </p>
          <div className="flex items-center space-x-3 whitespace-nowrap">
            <button onClick={() => onNavigate('about')} className="hover:text-white">Privacy</button>
            <span>|</span>
            <button onClick={() => onNavigate('about')} className="hover:text-white">Terms</button>
            <span>|</span>
            <button onClick={() => onNavigate('about')} className="hover:text-white">Accessibility</button>
            <span>|</span>
            <button onClick={() => onNavigate('about')} className="hover:text-white">Contact</button>
          </div>
        </div>
      </div>
    </footer>
  );
}
