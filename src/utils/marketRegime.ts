// Shared presentation for the persistent Market Condition display (top
// banner, 2D board, 3D action center). The Market Meter's numeric value and
// zone thresholds are the ONLY source of truth (engine/marketMeter.ts's
// meterZone) — this module only maps that single value to labels, colors,
// glyphs, and accessible text, so the three surfaces can never disagree.
// 2026-08-21 — Add Persistent Market Regime Display and Reset.

import { meterZone, METER_MAX, METER_MIN, type MeterZone } from '../engine/marketMeter';

export interface MarketRegimeInfo {
  zone: MeterZone;
  // Deliberately NOT "BULL RUN"/"BEAR RUN" — those are the names of the
  // board spaces at 16/26, which are a different mechanic entirely (risk-tier
  // price moves + stance cash on landing). Using the same words for the
  // meter's zone made the banner read "BEAR RUN" while a player was landing
  // on the "BULL RUN" space. The meter is a market *mood*, so it reads as an
  // adjective; a "Run" is always the board space.
  label: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  meter: number;
  meterText: string;   // e.g. '+2', '0', '−3' (real minus sign, not a hyphen)
  color: string;        // primary accent color for the current zone
  glyph: string;        // small non-color signal so meaning never depends on color alone
  ariaLabel: string;    // announces both condition and value together
  min: number;
  max: number;
}

const ZONE_META: Record<MeterZone, { label: MarketRegimeInfo['label']; color: string; glyph: string }> = {
  bull: { label: 'BULLISH', color: '#3ed598', glyph: '▲' },
  neutral: { label: 'NEUTRAL', color: '#d4a535', glyph: '●' },
  bear: { label: 'BEARISH', color: '#ef4444', glyph: '▼' },
};

/** Format a signed meter value with a true minus sign, matching the rest of
    the UI's numeric conventions ('+2', '0', '−3' — never a bare hyphen). */
export function formatSignedMeter(meter: number): string {
  if (meter > 0) return `+${meter}`;
  if (meter < 0) return `−${Math.abs(meter)}`;
  return '0';
}

/** The single presentation model every surface (banner, 2D board, 3D action
    center) derives from — never compute zone/label/color separately. */
export function marketRegimeInfo(meter: number): MarketRegimeInfo {
  const zone = meterZone(meter);
  const meta = ZONE_META[zone];
  return {
    zone,
    label: meta.label,
    meter,
    meterText: formatSignedMeter(meter),
    color: meta.color,
    glyph: meta.glyph,
    ariaLabel: `Market condition: ${meta.label}, meter ${formatSignedMeter(meter)} of ${formatSignedMeter(METER_MIN)} to ${formatSignedMeter(METER_MAX)}`,
    min: METER_MIN,
    max: METER_MAX,
  };
}
