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
    footer_copyright: 'Ministry of Ports, Shipping & Waterways. Developed for Smart India Hackathon (SIH26006).',

    // Home Page Hero
    hero_ministry_pill: 'SIH26006 · Ministry of Ports, Shipping & Waterways',
    hero_headline: "Smarter Charter Decisions for India's Maritime Trade",
    hero_subtitle: "Forecast freight markets, evaluate routes and vessel feasibility, and compare charter strategies under uncertainty.",
    hero_cta_plan: "Start Charter Planning",
    hero_cta_forecast: "Explore Freight Forecast",
    hero_cta_market: "View Market Intelligence",
    hero_feat_ports: "14 Reference Ports",
    hero_feat_corridors: "6 Global Corridors",
    hero_feat_forecast: "LightGBM v2 ML Forecast",
    hero_feat_conformal: "Conformal 80% Bounds",
    
    // Home Visual Card
    card_ministry: "Government of India · Ministry of Ports, Shipping & Waterways",
    card_logistics_title: "East Coast Maritime Trade Logistics",
    card_logistics_sub: "Dry Bulk Shipping Network & Port Connectivity — Bay of Bengal Corridor",
    card_commercial_tag: "Commercial Bulk Logistics",
    card_fleet_opt: "Capesize & Panamax Dry-Bulk Fleet Optimization",
    card_east_coast_nodes: "East Coast Nodes",
    card_operational_hub: "Operational Hub",
    
    // Lineage Section
    lineage_title: "Data Lineage & Methodology Boundaries",
    lineage_subtitle: "Dual-Horizon Baltic Dry Index Model Portfolio with Split-Conformal Calibration",
    lineage_tag_observed: "Historical Training Cutoff: 31 July 2019",
    lineage_tag_synthetic: "Synthetic Realism Extension: August 2019 – Present",
    lineage_tag_telemetry: "Port Waiting Telemetry: Simulated Demonstration",

    // Pillars Section
    pillars_heading: "Three Pillars of Sovereign Charter Analytics",
    pillars_subheading: "An authoritative decision-support architecture bridging econometric models, terminal engineering constraints, and stochastic risk optimization.",
    pillar1_title: "Deterministic & Explainable",
    pillar1_desc: "Every recommendation is backed by auditable bunker arithmetic, voyage distance tables, canal fee schedules, and transparent demurrage calculations.",
    pillar2_title: "Multi-Horizon Probabilistic ML",
    pillar2_desc: "72 LightGBM quantile models across 4 Baltic vessel classes (Capesize, Panamax, Supramax, Handysize) with split-conformal coverage at 80% confidence.",
    pillar3_title: "Monte Carlo Risk-Adjusted Ranking",
    pillar3_desc: "Simulate Spot vs. COA vs. Time Charter strategies over 200–5,000 draws to quantify landed cost, CVaR-90 tail risk, and delivery breach exposure.",

    // Workflow Section
    workflow_heading: "End-to-End Decision Workflow",
    workflow_subheading: "A 7-stage analytical pipeline taking raw voyage intent through to risk-ranked charter recommendations.",
    wf_step1_title: "Cargo Requirement",
    wf_step1_desc: "Tonnage, commodity specification & destination laycan arrival window.",
    wf_step2_title: "Freight Forecast",
    wf_step2_desc: "Baltic forward index projection with conformalized prediction intervals.",
    wf_step3_title: "Port & Vessel Constraints",
    wf_step3_desc: "Berth draft, LOA, beam, tidal allowance & handling rate boundaries.",
    wf_step4_title: "Feasible Charter Options",
    wf_step4_desc: "Class suitability (Handysize, Supramax, Panamax, Capesize) & parcel split.",
    wf_step5_title: "Monte Carlo Simulation",
    wf_step5_desc: "Stochastic draws across freight variance, bunker shift & waiting detention.",
    wf_step6_title: "Risk-Adjusted Economics",
    wf_step6_desc: "Expected cost, CVaR-90 tail risk, and penalty for arrival delay.",
    wf_step7_title: "Decision Support",
    wf_step7_desc: "Authoritative ranking with full explainability & sensitivity analysis.",

    // Core Services
    services_heading: "Six Core Intelligence Modules",
    services_subheading: "Interactive analytical workspaces tailored for maritime chartering superintendents and procurement analysts.",

    // Corridors Section
    corridors_heading: "Global Import Corridors & Focus Discharge Ports",
    corridors_subheading: "Authoritative origin registry and destination terminal constraints configured in the SIH26006 procurement engine.",
    corridors_origins_title: "Supported Global Load Ports (Origins)",
    corridors_ports_title: "Primary Indian Discharge Ports",

    // Final CTA
    cta_banner_title: "Ready to Evaluate Charter Strategies?",
    cta_banner_desc: "Open the Executive Dashboard to monitor market signals or launch the Charter Planner to evaluate procurement strategies.",
    cta_banner_open_dash: "Open Executive Dashboard",
    cta_banner_launch_planner: "Launch Charter Planner"
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
    footer_copyright: 'पत्तन, पोत परिवहन और जलमार्ग मंत्रालय। स्मार्ट इंडिया हैकथॉन (SIH26006) हेतु विकसित।',

    // Home Page Hero
    hero_ministry_pill: 'SIH26006 · पत्तन, पोत परिवहन और जलमार्ग मंत्रालय',
    hero_headline: "भारत के समुद्री व्यापार हेतु कुशल एवं सशक्त चार्टर निर्णय प्रणाली",
    hero_subtitle: "भाड़ा बाजार का सटीक पूर्वानुमान लगाएं, समुद्री मार्गों और पोत व्यवहार्यता का मूल्यांकन करें, तथा अनिश्चितता के दौर में सर्वोत्तम चार्टर रणनीतियों की तुलना करें।",
    hero_cta_plan: "चार्टर योजना प्रारंभ करें",
    hero_cta_forecast: "भाड़ा पूर्वानुमान देखें",
    hero_cta_market: "बाजार आसूचना देखें",
    hero_feat_ports: "14 संदर्भ बंदरगाह",
    hero_feat_corridors: "6 वैश्विक गलियारे",
    hero_feat_forecast: "LightGBM v2 एमएल पूर्वानुमान",
    hero_feat_conformal: "80% कॉन्फ़ॉर्मल अंतराल",
    
    // Home Visual Card
    card_ministry: "भारत सरकार · पत्तन, पोत परिवहन और जलमार्ग मंत्रालय",
    card_logistics_title: "पूर्वी तट समुद्री व्यापार रसद",
    card_logistics_sub: "थोक माल पोत परिवहन नेटवर्क एवं बंदरगाह कनेक्टिविटी — बंगाल की खाड़ी गलियारा",
    card_commercial_tag: "व्यावसायिक थोक माल रसद",
    card_fleet_opt: "केपसाइज एवं पैनामैक्स थोक बेड़ा अनुकूलन",
    card_east_coast_nodes: "पूर्वी तट नोड्स",
    card_operational_hub: "परिचालन केंद्र",

    // Lineage Section
    lineage_title: "डेटा वंशावली एवं कार्यप्रणाली सीमाएं",
    lineage_subtitle: "द्वि-क्षितिज बाल्टिक ड्राई इंडेक्स मॉडल पोर्टफोलियो (विभाजित-कॉन्फ़ॉर्मल अंशांकन सहित)",
    lineage_tag_observed: "ऐतिहासिक प्रशिक्षण कटऑफ: 31 जुलाई 2019",
    lineage_tag_synthetic: "सिंथेटिक यथार्थवाद विस्तार: अगस्त 2019 – वर्तमान",
    lineage_tag_telemetry: "बंदरगाह प्रतीक्षा टेलीमेट्री: सिमुलेटेड प्रदर्शन",

    // Pillars Section
    pillars_heading: "संप्रभु चार्टर विश्लेषण के तीन प्रमुख स्तंभ",
    pillars_subheading: "अर्थमितीय मॉडल, टर्मिनल इंजीनियरिंग बाधाओं और सांख्यिकीय जोखिम अनुकूलन को एकीकृत करने वाला प्रामाणिक निर्णय-समर्थन ढांचा।",
    pillar1_title: "निश्चयात्मक एवं पूर्णतः व्याख्यात्मक",
    pillar1_desc: "प्रत्येक अनुशंसा पारदर्शी बंकर गणना, समुद्री दूरी तालिकाओं, नहर शुल्क और स्पष्ट विलंब शुल्क (Demurrage) विश्लेषण द्वारा समर्थित है।",
    pillar2_title: "बहु-क्षितिज संभाव्य मशीन लर्निंग",
    pillar2_desc: "80% विश्वास स्तर पर 4 बाल्टिक पोत श्रेणियों (Capesize, Panamax, Supramax, Handysize) के लिए 72 LightGBM क्वांटाइल मॉडल।",
    pillar3_title: "मोंटे कार्लो जोखिम-समायोजित रैंकिंग",
    pillar3_desc: "स्पॉट, सीओए (COA) और टाइम चार्टर रणनीतियों पर 200 से 5,000 सिमुलेशन चलाएं और CVaR-90 टेल रिस्क व डिलीवरी विलंब का विश्लेषण करें।",

    // Workflow Section
    workflow_heading: "शुरुआत से अंत तक निर्णय कार्यप्रवाह",
    workflow_subheading: "कार्गो की प्रारंभिक आवश्यकता से लेकर जोखिम-समायोजित चार्टर सिफारिश तक 7-चरणीय विश्लेषणात्मक पाइपलाइन।",
    wf_step1_title: "कार्गो आवश्यकता",
    wf_step1_desc: "टन भार, वस्तु विनिर्देश एवं गंतव्य लेकैन (Laycan) आगमन खिड़की।",
    wf_step2_title: "भाड़ा पूर्वानुमान",
    wf_step2_desc: "कॉन्फ़ॉर्मल पूर्वानुमान अंतरालों के साथ बाल्टिक फॉरवर्ड इंडेक्स प्रक्षेपण।",
    wf_step3_title: "बंदरगाह एवं पोत सीमाएं",
    wf_step3_desc: "बर्थ ड्राफ्ट, लंबाई (LOA), बीम, ज्वारीय छूट एवं हैंडलिंग दर सीमाएं।",
    wf_step4_title: "व्यवहार्य चार्टर विकल्प",
    wf_step4_desc: "पोत वर्ग उपयुक्तता (Handysize, Supramax, Panamax, Capesize) एवं पार्सल विभाजन।",
    wf_step5_title: "मोंटे कार्लो सिमुलेशन",
    wf_step5_desc: "भाड़ा विचरण, बंकर ईंधन उतार-चढ़ाव और बंदरगाह प्रतीक्षा समय पर संभाव्य ड्रा।",
    wf_step6_title: "जोखिम-समायोजित अर्थशास्त्र",
    wf_step6_desc: "अपेक्षित लागत, CVaR-90 चरम जोखिम, और आगमन विलंब दंड का मूल्यांकन।",
    wf_step7_title: "निर्णय समर्थन एवं रैंकिंग",
    wf_step7_desc: "पूर्ण व्याख्यात्मकता और संवेदनशीलता विश्लेषण के साथ प्रामाणिक रैंकिंग।",

    // Core Services
    services_heading: "छह प्रमुख निर्णय-समर्थन मॉड्यूल",
    services_subheading: "चार्टरिंग अधीक्षकों और अधिप्राप्ति विश्लेषकों हेतु डिज़ाइन किए गए संवादात्मक विश्लेषणात्मक कार्यक्षेत्र।",

    // Corridors Section
    corridors_heading: "वैश्विक आयात गलियारे एवं प्रमुख डिस्चार्ज बंदरगाह",
    corridors_subheading: "SIH26006 अधिप्राप्ति इंजन में कॉन्फ़िगर की गई प्रामाणिक मूल पोर्ट रजिस्ट्री और गंतव्य टर्मिनल सीमाएं।",
    corridors_origins_title: "समर्थित वैश्विक लोडिंग पोर्ट (स्रोत)",
    corridors_ports_title: "प्रमुख भारतीय डिस्चार्ज बंदरगाह",

    // Final CTA
    cta_banner_title: "क्या आप चार्टर रणनीतियों का मूल्यांकन करने के लिए तैयार हैं?",
    cta_banner_desc: "बाजार संकेतों की निगरानी हेतु कार्यकारी डैशबोर्ड खोलें या अधिप्राप्ति योजना हेतु चार्टर योजनाकार प्रारंभ करें।",
    cta_banner_open_dash: "कार्यकारी डैशबोर्ड खोलें",
    cta_banner_launch_planner: "चार्टर योजनाकार प्रारंभ करें"
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
