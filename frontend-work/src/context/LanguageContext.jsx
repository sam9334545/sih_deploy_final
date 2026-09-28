import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  en: {
    // Top Bar
    gov_title: 'Government of India',
    ministry_title: 'Ministry of Ports, Shipping & Waterways',
    skip_content: 'Skip to Main Content',
    screen_reader: 'Screen Reader Access',
    decrease_text: 'Decrease text size',
    normal_text: 'Normal text size',
    increase_text: 'Increase text size',
    lang_hi: 'हिन्दी',
    lang_en: 'English',

    // Screen Reader Modal
    sr_modal_title: 'Screen Reader Access & Accessibility Guide',
    sr_modal_sub: 'Compliant with Guidelines for Indian Government Websites (GIGW 3.0) & WCAG 2.1 AA',
    sr_modal_desc: "The SIH26006 Intelligent Freight Forecasting & Charter Decision-Support System is built to ensure seamless accessibility for users with disabilities, conforming to international WCAG 2.1 Level AA standards and Indian Government GIGW 3.0 accessibility directives.",
    sr_supported_readers: 'Supported Screen Reading Software',
    sr_win_narrator: 'Windows Narrator',
    sr_win_narrator_desc: 'Built-in (Windows 10/11)',
    sr_nvda: 'NVDA (NonVisual Access)',
    sr_nvda_desc: 'Free / Open-Source (Windows)',
    sr_jaws: 'JAWS',
    sr_jaws_desc: 'Commercial (Freedom Scientific)',
    sr_voiceover: 'Apple VoiceOver',
    sr_voiceover_desc: 'Built-in (macOS / iOS)',
    sr_keyboard_nav: 'Standard Keyboard Navigation',
    sr_key_tab: 'Move to next control',
    sr_key_shift_tab: 'Move to previous control',
    sr_key_enter: 'Activate button or link',
    sr_key_esc: 'Close active dialog / modal',
    sr_close_guide: 'Close Guide',

    // Brand Header
    brand_title: 'Charter Intelligence',
    brand_sub: 'Freight Forecasting & Procurement Decision Support',
    search_placeholder: 'Search ports, routes, models...',
    data_status: 'Data Status',
    data_status_val: 'Historical Development',
    about: 'About',

    // Primary Nav Tabs
    tab_home: 'Home',
    tab_dashboard: 'Executive Dashboard',
    tab_planner: 'Charter Planner',
    tab_forecast: 'Freight Forecast',
    tab_ports: 'Port Intelligence',
    tab_vessels: 'Vessel Optimizer',
    tab_simulator: 'Strategy Simulator',
    tab_risks: 'Risk & Alerts',

    // Secondary Nav
    analytics_support: 'Analytics & Support',
    secondary_surfaces: 'Secondary Analytics Surfaces',
    tab_market: 'Market Intelligence & Positioning',
    tab_routes: 'Route Voyage Analysis',
    tab_methodology: 'Data Provenance & Methodology',
    tab_about: 'About System',

    // Footer
    footer_tagline: "Intelligent Freight Forecasting & Charter Decision Support for India's maritime supply chains, raw material bulk logistics, and sovereign trade resilience.",
    footer_focus_ports: 'Primary Focus Ports:',
    footer_workflows: 'Primary Workflows',
    footer_quick_links: 'Quick Navigation',
    footer_provenance: 'Data Lineage & Provenance',
    footer_copyright: 'Ministry of Ports, Shipping & Waterways. Developed for Smart India Hackathon (SIH26006).'
  },
  hi: {
    // Top Bar
    gov_title: 'भारत सरकार',
    ministry_title: 'पत्तन, पोत परिवहन और जलमार्ग मंत्रालय',
    skip_content: 'मुख्य सामग्री पर जाएं',
    screen_reader: 'स्क्रीन रीडर पहुंच',
    decrease_text: 'फ़ॉन्ट आकार घटाएं',
    normal_text: 'सामान्य फ़ॉन्ट आकार',
    increase_text: 'फ़ॉन्ट आकार बढ़ाएं',
    lang_hi: 'हिन्दी',
    lang_en: 'English',

    // Screen Reader Modal
    sr_modal_title: 'स्क्रीन रीडर पहुंच एवं सुगमता मार्गदर्शिका',
    sr_modal_sub: 'भारत सरकार वेबसाइट दिशा-निर्देश (GIGW 3.0) एवं WCAG 2.1 AA के अनुरूप',
    sr_modal_desc: "SIH26006 इंटेलिजेंट फ्रेट फोरकास्टिंग एवं चार्टर निर्णय-समर्थन प्रणाली दिव्यांगजनों के लिए सहज सुलभता सुनिश्चित करने हेतु अंतरराष्ट्रीय WCAG 2.1 AA मानकों और भारत सरकार के GIGW 3.0 निर्देशों के तहत विकसित की गई है।",
    sr_supported_readers: 'समर्थित स्क्रीन रीडर सॉफ्टवेयर',
    sr_win_narrator: 'विंडोज़ नैरेटर (Windows Narrator)',
    sr_win_narrator_desc: 'इन-बिल्ट (Windows 10/11)',
    sr_nvda: 'एनवीडीए (NVDA NonVisual Access)',
    sr_nvda_desc: 'मुफ्त एवं ओपन-सोर्स (Windows)',
    sr_jaws: 'जॉस (JAWS)',
    sr_jaws_desc: 'व्यावसायिक (Freedom Scientific)',
    sr_voiceover: 'एप्पल वॉइसओवर (VoiceOver)',
    sr_voiceover_desc: 'इन-बिल्ट (macOS / iOS)',
    sr_keyboard_nav: 'मानक कुंजीपटल (Keyboard) नेविगेशन',
    sr_key_tab: 'अगले नियंत्रण/बटन पर जाएं',
    sr_key_shift_tab: 'पिछले नियंत्रण/बटन पर जाएं',
    sr_key_enter: 'बटन अथवा लिंक सक्रिय करें',
    sr_key_esc: 'सक्रिय संवाद / विंडो बंद करें',
    sr_close_guide: 'मार्गदर्शिका बंद करें',

    // Brand Header
    brand_title: 'चार्टर इंटेलिजेंस',
    brand_sub: 'भाड़ा पूर्वानुमान एवं अधिप्राप्ति निर्णय प्रणाली',
    search_placeholder: 'बंदरगाह, समुद्री मार्ग, मॉडल खोजें...',
    data_status: 'डेटा स्थिति',
    data_status_val: 'ऐतिहासिक विकास',
    about: 'परिचय',

    // Primary Nav Tabs
    tab_home: 'मुख्य पृष्ठ',
    tab_dashboard: 'कार्यकारी डैशबोर्ड',
    tab_planner: 'चार्टर योजनाकार',
    tab_forecast: 'भाड़ा पूर्वानुमान',
    tab_ports: 'बंदरगाह विश्लेषण',
    tab_vessels: 'पोत अनुकूलक',
    tab_simulator: 'रणनीति सिम्युलेटर',
    tab_risks: 'जोखिम एवं अलर्ट',

    // Secondary Nav
    analytics_support: 'विश्लेषण एवं सहायता',
    secondary_surfaces: 'सहायक विश्लेषण पृष्ठ',
    tab_market: 'बाजार आसूचना एवं स्थिति',
    tab_routes: 'मार्ग यात्रा विश्लेषण',
    tab_methodology: 'डेटा स्रोत एवं कार्यप्रणाली',
    tab_about: 'प्रणाली परिचय',

    // Footer
    footer_tagline: "भारत की समुद्री आपूर्ति श्रृंखला, कच्चा माल थोक रसद और संप्रभु व्यापार लचीलेपन हेतु बुद्धिमान भाड़ा पूर्वानुमान एवं चार्टर निर्णय सहायता प्रणाली।",
    footer_focus_ports: 'प्रमुख भारतीय बंदरगाह:',
    footer_workflows: 'प्राथमिक कार्यप्रवाह',
    footer_quick_links: 'त्वरित नेविगेशन',
    footer_provenance: 'डेटा वंशावली एवं स्रोत',
    footer_copyright: 'पत्तन, पोत परिवहन और जलमार्ग मंत्रालय। स्मार्ट इंडिया हैकथॉन (SIH26006) हेतु विकसित।'
  }
};

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sih_portal_lang') || 'en';
    }
    return 'en';
  });

  const setLang = (newLang) => {
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sih_portal_lang', newLang);
      document.documentElement.lang = newLang;
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const t = (key) => {
    if (translations[lang] && translations[lang][key]) {
      return translations[lang][key];
    }
    if (translations.en[key]) {
      return translations.en[key];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: 'en',
      setLang: () => {},
      t: (key) => translations.en[key] || key
    };
  }
  return context;
}
