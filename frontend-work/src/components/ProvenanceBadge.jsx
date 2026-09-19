import React from 'react';

const BADGE_CONFIG = {
  OBSERVED: {
    label: 'OBSERVED',
    className: 'badge-observed',
    tooltip: 'Direct verified Baltic Exchange daily observation (Mendeley 2012–2019 dataset)'
  },
  DERIVED: {
    label: 'DERIVED',
    className: 'badge-derived',
    tooltip: 'Mathematically derived by Quantile LightGBM, Conformal Calibration, or Voyage Physics'
  },
  ASSUMED: {
    label: 'ASSUMED',
    className: 'badge-assumed',
    tooltip: 'Engineering assumption (e.g. vessel operational speed, port handling rate)'
  },
  DEMO_ONLY: {
    label: 'DEMO_ONLY',
    className: 'badge-demo',
    tooltip: 'Synthetic placeholder for demonstration only (e.g. Rotterdam VLSFO unverified feed)'
  },
  NOT_AVAILABLE: {
    label: 'NOT_AVAILABLE',
    className: 'badge-na',
    tooltip: 'Genuine missing/unobserved market data. Not fabricated per Phase 6B integrity rules.'
  }
};

export default function ProvenanceBadge({ type = 'OBSERVED', text }) {
  const config = BADGE_CONFIG[type] || BADGE_CONFIG.OBSERVED;
  return (
    <span 
      className={`badge ${config.className}`} 
      title={config.tooltip}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {text || config.label}
    </span>
  );
}
