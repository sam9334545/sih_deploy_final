import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export default function DecisionWorkflowBanner({ currentStep = 'cargo', onNavigate }) {
  const { lang } = useLanguage();

  const STEPS = [
    { id: 'cargo', label: lang === 'hi' ? 'कार्गो आवश्यकता' : 'Cargo Requirement', tab: 'planner' },
    { id: 'forecast', label: lang === 'hi' ? 'भाड़ा पूर्वानुमान' : 'Freight Forecast', tab: 'forecast' },
    { id: 'constraints', label: lang === 'hi' ? 'बंदरगाह सीमाएं' : 'Port Constraints', tab: 'ports' },
    { id: 'vessels', label: lang === 'hi' ? 'पोत व्यवहार्यता' : 'Vessel Feasibility', tab: 'vessels' },
    { id: 'strategies', label: lang === 'hi' ? 'चार्टर रणनीतियां' : 'Charter Strategies', tab: 'simulator' },
    { id: 'simulation', label: lang === 'hi' ? 'मोंटे कार्लो सिमुलेशन' : 'Monte Carlo Sim', tab: 'simulator' },
    { id: 'risk', label: lang === 'hi' ? 'जोखिम-समायोजित लागत' : 'Risk-Adjusted Cost', tab: 'risks' },
    { id: 'recommendation', label: lang === 'hi' ? 'अनुशंसा' : 'Recommendation', tab: 'planner' },
    { id: 'explanation', label: lang === 'hi' ? 'यह निर्णय क्यों?' : 'Why This Decision?', tab: 'planner' },
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs overflow-x-auto select-none">
      <div className="flex items-center justify-between min-w-[760px] text-[10px]">
        {STEPS.map((step, idx) => {
          const isCurrent = step.id === currentStep;
          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => onNavigate && onNavigate(step.tab)}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded transition text-left cursor-pointer ${
                  isCurrent
                    ? 'bg-govNavy text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-govNavy hover:bg-slate-50'
                }`}
                title={`Navigate to ${step.label}`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono ${
                  isCurrent ? 'bg-amber-400 text-slate-900 font-bold' : 'bg-slate-200 text-slate-700'
                }`}>
                  {idx + 1}
                </span>
                <span className="whitespace-nowrap font-medium">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <svg className="w-3 h-3 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
