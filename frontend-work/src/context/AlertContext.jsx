import React, { createContext, useContext, useState, useEffect } from 'react';

const AlertContext = createContext();

export const ALERT_SCENARIOS = {
  normal: {
    id: 'normal',
    label: 'Normal Operations (0 Alerts)',
    hiLabel: 'सामान्य परिचालन (0 अलर्ट)',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
    overallRisk: 'LOW',
    hiOverallRisk: 'निम्न (LOW)',
    mainDriver: 'Stable ocean weather and baseline port waiting queues within 12-month medians.',
    hiMainDriver: 'स्थिर समुद्री मौसम और 12-महीने के मध्यमान के भीतर सामान्य बंदरगाह प्रतीक्षा कतारें।',
    alerts: []
  },
  cyclone: {
    id: 'cyclone',
    label: 'Cyclone & Severe Weather Warning (3 Alerts)',
    hiLabel: 'चक्रवात एवं गंभीर मौसम चेतावनी (3 अलर्ट)',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    overallRisk: 'HIGH',
    hiOverallRisk: 'उच्च (HIGH)',
    mainDriver: 'Severe cyclonic storm in Bay of Bengal with outer anchorage swell >4.5m.',
    hiMainDriver: 'बंगाल की खाड़ी में तीव्र चक्रवाती तूफान एवं आउटर एंकरेज में >4.5 मीटर समुद्री लहरें।',
    alerts: [
      {
        id: 'alt-cyc-1',
        code: 'WX_BOB_CYCLONE_01',
        severity: 'high',
        category: 'Weather & Navigation',
        hiCategory: 'मौसम एवं नेविगेशन',
        title: 'Bay of Bengal Severe Cyclonic Storm Warning (IMD Bulletin #4)',
        hiTitle: 'बंगाल की खाड़ी में तीव्र चक्रवाती तूफान की चेतावनी (आईएमडी बुलेटिन #4)',
        portId: 'INPRT',
        vesselClass: 'Panamax',
        message: 'Severe cyclonic depression 280km SSE of Paradip. Significant wave height >4.5m with gale wind gusts (42-48 kts). Paradip and Dhamra outer anchorage lightering suspended for 48-72h.',
        hiMessage: 'पारादीप के 280 किमी दक्षिण-दक्षिणपूर्व में तीव्र चक्रवाती तूफान। लहरों की ऊंचाई >4.5 मीटर और 42-48 समुद्री मील तेज हवाएं। पारादीप एवं धामरा आउटर एंकरेज परिचालन 48-72 घंटे के लिए स्थगित।',
        impact: 'Demurrage risk +$33,000 / 48h laycan delay',
        hiImpact: 'डेमरेज जोखिम +$33,000 / 48 घंटे लैकेन देरी',
        mitigation: 'Activate contingency laycan buffer; divert en-route Supramax to Gangavaram (INGGV) southern shelter berth.',
        hiMitigation: 'आकस्मिक लैकेन बफर सक्रिय करें; रास्ते में मौजूद जहाजों को गंगावरम (INGGV) सुरक्षित बर्थ की ओर मोड़ें।',
        timestamp: '12 mins ago'
      },
      {
        id: 'alt-cyc-2',
        code: 'PORT_BERTH_HALT_CB01',
        severity: 'medium',
        category: 'Port Operations',
        hiCategory: 'बंदरगाह परिचालन',
        title: 'Paradip CB-01 & CB-02 Mechanical Berth Operational Curtailment',
        hiTitle: 'पारादीप CB-01 और CB-02 यांत्रिक बर्थ परिचालन प्रतिबंध',
        portId: 'INPRT',
        vesselClass: 'Capesize',
        message: 'Port Marine Department advisory: Wind gusts exceeding 32 knots enforce automatic stacker/loader crane lockdown on mechanized berths CB-01 and CB-02.',
        hiMessage: 'पोर्ट मरीन एडवाइजरी: 32 समुद्री मील से अधिक हवा की गति के कारण CB-01/CB-02 बर्थ पर लोडर क्रेन संचालन स्वतः बंद।',
        impact: 'Discharge handling rate drops from 40k tpd to 0 tpd during gust peaks',
        hiImpact: 'हवा के झोंकों के दौरान डिस्चार्ज दर 40,000 टीपीडी से घटकर 0 टीपीडी',
        mitigation: 'Pre-order 2 additional harbor tugs and double forward/aft mooring lines to prevent surge damage.',
        hiMitigation: '2 अतिरिक्त हार्बर टग पूर्व-आरक्षित करें और मूरिंग लाइनों को दोगुना मजबूत करें।',
        timestamp: '35 mins ago'
      },
      {
        id: 'alt-cyc-3',
        code: 'ROUTE_DETOUR_SINGAPORE',
        severity: 'medium',
        category: 'Route Economics',
        hiCategory: 'मार्ग अर्थशास्त्र',
        title: 'Malacca Strait – East Coast India Weather Routing Deviation',
        hiTitle: 'मलक्का जलडमरूमध्य - भारत पूर्वी तट मौसम मार्ग विचलन',
        portId: 'INVTZ',
        vesselClass: 'Panamax',
        message: 'Laden bulkers departing Singapore bunkering hub advised to transit via southern Rhumb Line corridor south of Sri Lanka (+1.6 steaming days) to avoid storm vortex.',
        hiMessage: 'सिंगापुर बंकरिंग हब से प्रस्थान करने वाले जहाजों को तूफान से बचने हेतु श्रीलंका के दक्षिण से गुजरने की सलाह (+1.6 दिन)।',
        impact: 'Extra fuel consumption ~+$18,500 VLSFO (32 mt)',
        hiImpact: 'अतिरिक्त ईंधन खपत ~+$18,500 VLSFO (32 मीट्रिक टन)',
        mitigation: 'Recalibrate TCE netback equations with 13.0 knot eco-speed profile to preserve voyage margin.',
        hiMitigation: 'यात्रा मार्जिन सुरक्षित रखने हेतु 13.0 समुद्री मील इको-स्पीड प्रोफाइल के साथ TCE की पुनर्गणना करें।',
        timestamp: '1 hour ago'
      }
    ]
  },
  congestion: {
    id: 'congestion',
    label: 'Port Congestion & Berth Chokepoint Spike (3 Alerts)',
    hiLabel: 'बंदरगाह भीड़भाड़ एवं बर्थ चोकपॉइंट संकट (3 अलर्ट)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    overallRisk: 'HIGH',
    hiOverallRisk: 'उच्च (HIGH)',
    mainDriver: 'Pre-berthing queue pressure at East Coast coal berths running at 3.1× historical median.',
    hiMainDriver: 'पूर्वी तट कोयला बर्थ पर प्री-बर्थिंग कतार दबाव ऐतिहासिक मध्यमान के 3.1 गुना पर संचालित।',
    alerts: [
      {
        id: 'alt-cong-1',
        code: 'PORT_QUEUE_SURGE_HAL',
        severity: 'high',
        category: 'Port Congestion',
        hiCategory: 'बंदरगाह भीड़भाड़',
        title: 'Haldia & Paradip Coal Waiting Queue Critical Spike (6.4 Days Median)',
        hiTitle: 'हल्दिया एवं पारादीप कोयला प्रतीक्षा कतार में भारी उछाल (6.4 दिन मध्यमान)',
        portId: 'INHAL',
        vesselClass: 'Supramax',
        message: 'Pre-berthing waiting time at Haldia Dock Complex (INHAL) and Paradip reached 6.4 days. 16 bulk carriers currently queued in roadstead anchorage with railway wagon clearance backlogs.',
        hiMessage: 'हल्दिया डॉक कॉम्प्लेक्स (INHAL) और पारादीप में प्री-बर्थिंग प्रतीक्षा समय 6.4 दिन पहुंचा। 16 बल्क कैरियर वर्तमान में सड़क मार्ग/रेलवे रेक निकासी की कमी के कारण कतार में हैं।',
        impact: 'Demurrage exposure $17,500/day per fixture (cumulative >$112,000)',
        hiImpact: 'प्रति जहाज $17,500/दिन डेमरेज जोखिम (कुल >$112,000)',
        mitigation: 'Execute parcel split to Visakhapatnam (INVTZ) or enforce MILP co-loading optimization.',
        hiMitigation: 'विशाखापट्टनम (INVTZ) में पार्सल विभाजन निष्पादित करें अथवा MILP सह-लोडिंग अनुकूलन लागू करें।',
        timestamp: '18 mins ago'
      },
      {
        id: 'alt-cong-2',
        code: 'DRAFT_RESTRICTION_DHA',
        severity: 'medium',
        category: 'Navigational Constraint',
        hiCategory: 'नौवहन बाधा',
        title: 'Dhamra & Haldia Siltation / Neap Tide Draft Limitation (14.1m Max)',
        hiTitle: 'धामरा एवं हल्दिया गाद / कम ज्वार ड्राफ्ट प्रतिबंध (14.1 मी अधिकतम)',
        portId: 'INDHA',
        vesselClass: 'Capesize',
        message: 'Neap tide cycle and post-monsoon siltation restrict permissible arrival draft to 14.1m at Dhamra inner basin. Fully laden Capesize vessels (>16.5m draft) prohibited from direct berthing.',
        hiMessage: 'कम ज्वार चक्र और गाद के कारण धामरा इनर बेसिन में अधिकतम आगमन ड्राफ्ट 14.1 मीटर तक सीमित। पूरी तरह लदे केपसाइज जहाजों का सीधा प्रवेश प्रतिबंधित।',
        impact: 'Requires 35,000 mt offshore transshipment / lighterage (+$4.80/mt)',
        hiImpact: '35,000 मीट्रिक टन ऑफशोर ट्रांसशिपमेंट आवश्यक (+$4.80/टन)',
        mitigation: 'Substitute with 2× Panamax gearless (74,000 dwt) vessels or lighter at Sandheads deep anchorage.',
        hiMitigation: '2× पानामैक्स जहाजों (74,000 dwt) से प्रतिस्थापित करें अथवा सैंडहेड्स में लाइटरिंग करें।',
        timestamp: '42 mins ago'
      },
      {
        id: 'alt-cong-3',
        code: 'EQUIPMENT_RECLAIMER_DELAY',
        severity: 'low',
        category: 'Terminal Infrastructure',
        hiCategory: 'टर्मिनल अवसंरचना',
        title: 'Paradip Stacker-Reclaimer SR-02 Scheduled Overhaul',
        hiTitle: 'पारादीप स्टैकर-रिक्लेमर SR-02 निर्धारित ओवरहाल',
        portId: 'INPRT',
        vesselClass: 'Panamax',
        message: 'Berth 14 unloading speed throttled by 25% during 96-hour preventive conveyor belt replacement.',
        hiMessage: '96 घंटे के निवारक कन्वेयर बेल्ट प्रतिस्थापन के दौरान बर्थ 14 की अनलोडिंग गति 25% कम।',
        impact: 'Vessel port stay extended +18 to +24 hours',
        hiImpact: 'जहाज के बंदरगाह ठहराव में +18 से +24 घंटे का विस्तार',
        mitigation: 'Prioritize self-unloading or grab-equipped geared Supramax carriers.',
        hiMitigation: 'स्व-अनलोडिंग या क्रेन-युक्त गियर्ड सुप्रामाक्स जहाजों को प्राथमिकता दें।',
        timestamp: '2 hours ago'
      }
    ]
  },
  volatility: {
    id: 'volatility',
    label: 'Baltic Freight Market Shock & Tonnage Squeeze (3 Alerts)',
    hiLabel: 'बाल्टिक भाड़ा बाजार झटका एवं जहाजों की कमी (3 अलर्ट)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    overallRisk: 'HIGH',
    hiOverallRisk: 'उच्च (HIGH)',
    mainDriver: 'Baltic Panamax 20-day realised volatility at 94th percentile with severe Indian Ocean supply squeeze.',
    hiMainDriver: 'बाल्टिक पानामैक्स 20-दिवसीय अस्थिरता 94वें पर्सेंटाइल पर और हिंद महासागर में जहाजों की भारी तंगी।',
    alerts: [
      {
        id: 'alt-vol-1',
        code: 'BPI_VOLATILITY_SURGE',
        severity: 'high',
        category: 'Market Risk',
        hiCategory: 'बाजार जोखिम',
        title: 'Baltic Panamax Index (BPI) Realised Volatility Spike (94th Percentile)',
        hiTitle: 'बाल्टिक पानामैक्स इंडेक्स (BPI) अस्थिरता उछाल (94वां पर्सेंटाइल)',
        portId: 'INPRT',
        vesselClass: 'Panamax',
        message: 'BPI daily variance jumped +18.4% across 5 trading sessions. Atlantic-Pacific arbitrage dislocation creating extreme day-to-day rate oscillations ($15,200 to $21,400/day).',
        hiMessage: '5 कारोबारी सत्रों में BPI दैनिक भिन्नता +18.4% बढ़ी। अटलांटिक-प्रशांत मध्यस्थता विसंगति से अत्यधिक दैनिक उतार-चढ़ाव ($15,200 से $21,400/दिन)।',
        impact: 'Spot procurement cost variance ±$2.80/mt; high budget risk',
        hiImpact: 'स्पॉट खरीद लागत भिन्नता ±$2.80/टन; उच्च बजट जोखिम',
        mitigation: 'Shift charter strategy from 100% Spot to 3-Month Period Index-Linked Contract with Cap/Floor Collar hedge.',
        hiMitigation: 'चार्टर रणनीति को 100% स्पॉट से बदलकर कैप/फ्लोर कॉलर हेज के साथ 3-महीने के इंडेक्स-लिंक्ड अनुबंध में बदलें।',
        timestamp: '22 mins ago'
      },
      {
        id: 'alt-vol-2',
        code: 'SUPPLY_TONNAGE_SQUEEZE',
        severity: 'medium',
        category: 'Fleet Availability',
        hiCategory: 'बेड़ा उपलब्धता',
        title: 'Indian Ocean Open Tonnage Squeeze (Supply Proxy z = -1.88)',
        hiTitle: 'हिंद महासागर में उपलब्ध जहाजों की तंगी (सप्लाई प्रॉक्सी z = -1.88)',
        portId: 'INVTZ',
        vesselClass: 'Panamax',
        message: 'Available prompt Panamax ballast tonnage in Singapore/Malacca basin dropped 38% month-over-month due to strong grain liftings from South America.',
        hiMessage: 'दक्षिण अमेरिका से मजबूत अनाज लदान के कारण सिंगापुर/मलक्का में उपलब्ध पानामैक्स बैलास्ट जहाजों में 38% गिरावट।',
        impact: 'Owners demanding +$2,400/day ballast repositioning premium',
        hiImpact: 'जहाज मालिक +$2,400/दिन बैलास्ट रीपोजिशनिंग प्रीमियम मांग रहे हैं',
        mitigation: 'Lock in forward laycan 21-28 days in advance to capture repositioning tonnage before market tightens further.',
        hiMitigation: 'बाजार और तंग होने से पहले 21-28 दिन अग्रिम लैकेन तय करके जहाजों को लॉक करें।',
        timestamp: '55 mins ago'
      },
      {
        id: 'alt-vol-3',
        code: 'BUNKER_VLSFO_SPIKE',
        severity: 'low',
        category: 'Bunker Economics',
        hiCategory: 'बंकर अर्थशास्त्र',
        title: 'Singapore VLSFO Bunker Fuel Price Surge ($584.50/mt)',
        hiTitle: 'सिंगापुर VLSFO बंकर ईंधन मूल्य वृद्धि ($584.50/मीट्रिक टन)',
        portId: 'INGGV',
        vesselClass: 'Supramax',
        message: 'Singapore 0.5% VLSFO benchmark rose +$34.50/mt following crude benchmark escalation and refinery maintenance outages in East Asia.',
        hiMessage: 'कच्चे तेल में तेजी और पूर्वी एशिया रिफाइनरी रखरखाव के बाद सिंगापुर VLSFO बेंचमार्क में +$34.50/मीट्रिक टन की वृद्धि।',
        impact: 'Adds +$0.82/mt to landed voyage freight cost',
        hiImpact: 'लैंडेड यात्रा भाड़ा लागत में +$0.82/टन का इजाफा',
        mitigation: 'Evaluate bunkering at Colombo Port (save $12/mt) and enforce vessel eco-speed protocol (12.5 kts).',
        hiMitigation: 'कोलंबो पोर्ट पर बंकरिंग का मूल्यांकन करें ($12/टन की बचत) और 12.5 समुद्री मील इको-स्पीड लागू करें।',
        timestamp: '3 hours ago'
      }
    ]
  },
  multi_crisis: {
    id: 'multi_crisis',
    label: 'Multi-Hazard Maritime Crisis Ensemble (5 Alerts)',
    hiLabel: 'बहु-संकट समुद्री आपातकालीन संयोजन (5 अलर्ट)',
    badgeColor: 'bg-rose-600 text-white border-rose-700',
    overallRisk: 'HIGH',
    hiOverallRisk: 'गंभीर (CRITICAL)',
    mainDriver: 'Compounded Bay of Bengal cyclone depression, severe Haldia queue congestion, and Baltic freight rate volatility spike.',
    hiMainDriver: 'बंगाल की खाड़ी में चक्रवाती तूफान, हल्दिया में गंभीर कतार भीड़भाड़ और बाल्टिक भाड़ा दरों में तीव्र उछाल का संयुक्त प्रभाव।',
    alerts: [
      {
        id: 'alt-mc-1',
        code: 'WX_BOB_CYCLONE_01',
        severity: 'high',
        category: 'Weather & Navigation',
        hiCategory: 'मौसम एवं नेविगेशन',
        title: 'Bay of Bengal Severe Cyclonic Storm Warning (IMD Bulletin #4)',
        hiTitle: 'बंगाल की खाड़ी में तीव्र चक्रवाती तूफान की चेतावनी (आईएमडी बुलेटिन #4)',
        portId: 'INPRT',
        vesselClass: 'Panamax',
        message: 'Severe cyclonic depression 280km SSE of Paradip. Significant wave height >4.5m with gale wind gusts (42-48 kts). Paradip and Dhamra outer anchorage lightering suspended for 48-72h.',
        hiMessage: 'पारादीप के 280 किमी दक्षिण-दक्षिणपूर्व में तीव्र चक्रवाती तूफान। लहरों की ऊंचाई >4.5 मीटर और 42-48 समुद्री मील तेज हवाएं। पारादीप एवं धामरा आउटर एंकरेज परिचालन 48-72 घंटे के लिए स्थगित।',
        impact: 'Demurrage risk +$33,000 / 48h laycan delay',
        hiImpact: 'डेमरेज जोखिम +$33,000 / 48 घंटे लैकेन देरी',
        mitigation: 'Activate contingency laycan buffer; divert en-route Supramax to Gangavaram (INGGV) southern shelter berth.',
        hiMitigation: 'आकस्मिक लैकेन बफर सक्रिय करें; रास्ते में मौजूद जहाजों को गंगावरम (INGGV) सुरक्षित बर्थ की ओर मोड़ें।',
        timestamp: '12 mins ago'
      },
      {
        id: 'alt-mc-2',
        code: 'PORT_QUEUE_SURGE_HAL',
        severity: 'high',
        category: 'Port Congestion',
        hiCategory: 'बंदरगाह भीड़भाड़',
        title: 'Haldia & Paradip Coal Waiting Queue Critical Spike (6.4 Days)',
        hiTitle: 'हल्दिया एवं पारादीप कोयला प्रतीक्षा कतार में भारी उछाल (6.4 दिन)',
        portId: 'INHAL',
        vesselClass: 'Supramax',
        message: 'Pre-berthing waiting time at Haldia Dock Complex (INHAL) and Paradip reached 6.4 days. 16 bulk carriers currently queued in roadstead anchorage with railway wagon clearance backlogs.',
        hiMessage: 'हल्दिया डॉक कॉम्प्लेक्स (INHAL) और पारादीप में प्री-बर्थिंग प्रतीक्षा समय 6.4 दिन पहुंचा। 16 बल्क कैरियर वर्तमान में सड़क मार्ग/रेलवे रेक निकासी की कमी के कारण कतार में हैं।',
        impact: 'Demurrage exposure $17,500/day per fixture (cumulative >$112,000)',
        hiImpact: 'प्रति जहाज $17,500/दिन डेमरेज जोखिम (कुल >$112,000)',
        mitigation: 'Execute parcel split to Visakhapatnam (INVTZ) or enforce MILP co-loading optimization.',
        hiMitigation: 'विशाखापट्टनम (INVTZ) में पार्सल विभाजन निष्पादित करें अथवा MILP सह-लोडिंग अनुकूलन लागू करें।',
        timestamp: '18 mins ago'
      },
      {
        id: 'alt-mc-3',
        code: 'BPI_VOLATILITY_SURGE',
        severity: 'high',
        category: 'Market Risk',
        hiCategory: 'बाजार जोखिम',
        title: 'Baltic Panamax Index (BPI) Realised Volatility Spike (94th Percentile)',
        hiTitle: 'बाल्टिक पानामैक्स इंडेक्स (BPI) अस्थिरता उछाल (94वां पर्सेंटाइल)',
        portId: 'INPRT',
        vesselClass: 'Panamax',
        message: 'BPI daily variance jumped +18.4% across 5 trading sessions. Atlantic-Pacific arbitrage dislocation creating extreme day-to-day rate oscillations ($15,200 to $21,400/day).',
        hiMessage: '5 कारोबारी सत्रों में BPI दैनिक भिन्नता +18.4% बढ़ी। अटलांटिक-प्रशांत मध्यस्थता विसंगति से अत्यधिक दैनिक उतार-चढ़ाव ($15,200 से $21,400/दिन)।',
        impact: 'Spot procurement cost variance ±$2.80/mt; high budget risk',
        hiImpact: 'स्पॉट खरीद लागत भिन्नता ±$2.80/टन; उच्च बजट जोखिम',
        mitigation: 'Shift charter strategy from 100% Spot to 3-Month Period Index-Linked Contract with Cap/Floor Collar hedge.',
        hiMitigation: 'चार्टर रणनीति को 100% स्पॉट से बदलकर कैप/फ्लोर कॉलर हेज के साथ 3-महीने के इंडेक्स-लिंक्ड अनुबंध में बदलें।',
        timestamp: '22 mins ago'
      },
      {
        id: 'alt-mc-4',
        code: 'DRAFT_RESTRICTION_DHA',
        severity: 'medium',
        category: 'Navigational Constraint',
        hiCategory: 'नौवहन बाधा',
        title: 'Dhamra & Haldia Siltation / Neap Tide Draft Limitation (14.1m Max)',
        hiTitle: 'धामरा एवं हल्दिया गाद / कम ज्वार ड्राफ्ट प्रतिबंध (14.1 मी अधिकतम)',
        portId: 'INDHA',
        vesselClass: 'Capesize',
        message: 'Neap tide cycle and post-monsoon siltation restrict permissible arrival draft to 14.1m at Dhamra inner basin. Fully laden Capesize vessels (>16.5m draft) prohibited from direct berthing.',
        hiMessage: 'कम ज्वार चक्र और गाद के कारण धामरा इनर बेसिन में अधिकतम आगमन ड्राफ्ट 14.1 मीटर तक सीमित। पूरी तरह लदे केपसाइज जहाजों का सीधा प्रवेश प्रतिबंधित।',
        impact: 'Requires 35,000 mt offshore transshipment / lighterage (+$4.80/mt)',
        hiImpact: '35,000 मीट्रिक टन ऑफशोर ट्रांसशिपमेंट आवश्यक (+$4.80/टन)',
        mitigation: 'Substitute with 2× Panamax gearless (74,000 dwt) vessels or lighter at Sandheads deep anchorage.',
        hiMitigation: '2× पानामैक्स जहाजों (74,000 dwt) से प्रतिस्थापित करें अथवा सैंडहेड्स में लाइटरिंग करें।',
        timestamp: '42 mins ago'
      },
      {
        id: 'alt-mc-5',
        code: 'SUPPLY_TONNAGE_SQUEEZE',
        severity: 'medium',
        category: 'Fleet Availability',
        hiCategory: 'बेड़ा उपलब्धता',
        title: 'Indian Ocean Open Tonnage Squeeze (Supply Proxy z = -1.88)',
        hiTitle: 'हिंद महासागर में उपलब्ध जहाजों की तंगी (सप्लाई प्रॉक्सी z = -1.88)',
        portId: 'INVTZ',
        vesselClass: 'Panamax',
        message: 'Available prompt Panamax ballast tonnage in Singapore/Malacca basin dropped 38% month-over-month due to strong grain liftings from South America.',
        hiMessage: 'दक्षिण अमेरिका से मजबूत अनाज लदान के कारण सिंगापुर/मलक्का में उपलब्ध पानामैक्स बैलास्ट जहाजों में 38% गिरावट।',
        impact: 'Owners demanding +$2,400/day ballast repositioning premium',
        hiImpact: 'जहाज मालिक +$2,400/दिन बैलास्ट रीपोजिशनिंग प्रीमियम मांग रहे हैं',
        mitigation: 'Lock in forward laycan 21-28 days in advance to capture repositioning tonnage before market tightens further.',
        hiMitigation: 'बाजार और तंग होने से पहले 21-28 दिन अग्रिम लैकेन तय करके जहाजों को लॉक करें।',
        timestamp: '55 mins ago'
      }
    ]
  }
};

export function AlertProvider({ children }) {
  // Default to 'cyclone' scenario so there's immediately something realistic and vibrant to showcase,
  // while allowing instant 1-click switching to 'normal', 'congestion', 'volatility', or 'multi_crisis'.
  const [selectedScenarioKey, setSelectedScenarioKey] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sih_alert_scenario');
      if (saved && ALERT_SCENARIOS[saved]) return saved;
    }
    return 'cyclone';
  });

  const [dismissedAlertIds, setDismissedAlertIds] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sih_alert_scenario', selectedScenarioKey);
    }
  }, [selectedScenarioKey]);

  const activeScenario = ALERT_SCENARIOS[selectedScenarioKey] || ALERT_SCENARIOS.cyclone;

  const rawAlerts = activeScenario.alerts || [];
  const activeAlerts = rawAlerts.filter(a => !dismissedAlertIds.includes(a.id));
  const alertCount = activeAlerts.length;

  const setScenario = (key) => {
    if (ALERT_SCENARIOS[key]) {
      setSelectedScenarioKey(key);
      setDismissedAlertIds([]); // Reset dismissed alerts on scenario change
    }
  };

  const dismissAlert = (alertId) => {
    setDismissedAlertIds(prev => [...prev, alertId]);
  };

  const resetAlerts = () => {
    setDismissedAlertIds([]);
  };

  return (
    <AlertContext.Provider
      value={{
        selectedScenarioKey,
        setScenario,
        activeScenario,
        alerts: activeAlerts,
        allScenarioAlerts: rawAlerts,
        alertCount,
        hasActiveAlerts: alertCount > 0,
        dismissAlert,
        resetAlerts,
        scenarios: ALERT_SCENARIOS
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
}
