// Small display bits shared by anything that renders a MarketSignal: the
// drawn-card popup (CardDisplay) and the Market Intelligence panel. Kept in
// one place so the two never drift out of sync on what "Hawkish" looks like.

import type { CSSProperties } from 'react';
import type { MarketSignalImpact } from '../../engine';

export const STANCE_META: Record<'hawkish' | 'dovish' | 'neutral' | 'mixed', { label: string; color: string; bg: string }> = {
  hawkish: { label: 'Hawkish', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  dovish: { label: 'Dovish', color: '#16a34a', bg: 'rgba(34,197,94,0.13)' },
  neutral: { label: 'Neutral', color: '#7c7263', bg: 'rgba(124,114,99,0.12)' },
  mixed: { label: 'Mixed', color: '#b7791f', bg: 'rgba(245,158,11,0.14)' },
};

function impactStyle(color: string, background: string): CSSProperties {
  return {
    color, background, borderRadius: 5, padding: '3px 7px',
    fontSize: 9, fontWeight: 800, lineHeight: 1.35,
  };
}

/** Up/down step-delta pills for a resolved set of price impacts. Renders
    nothing for an empty list (a card that had no eligible target, or whose
    entire move was shielded by Circuit Breaker). */
export function ImpactChips({ impacts, style }: { impacts: MarketSignalImpact[]; style?: CSSProperties }) {
  const up = impacts.filter((impact) => impact.d > 0).map((impact) => `${impact.code} +${impact.d}`);
  const down = impacts.filter((impact) => impact.d < 0).map((impact) => `${impact.code} ${impact.d}`);
  if (!up.length && !down.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, ...style }}>
      {up.length > 0 && <span style={impactStyle('#15803d', 'rgba(34,197,94,0.11)')}>▲ {up.join(' · ')}</span>}
      {down.length > 0 && <span style={impactStyle('#b91c1c', 'rgba(239,68,68,0.10)')}>▼ {down.join(' · ')}</span>}
    </div>
  );
}
