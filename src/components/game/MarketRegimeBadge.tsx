import { useEffect, useRef, useState } from 'react';
import { marketRegimeInfo } from '../../utils/marketRegime';
import type { GameState } from '../../engine';

/**
 * The one persistent Market Condition display, reused (with layout-only
 * variants) in the top banner and the 2D board center panel. A local ref
 * tracks the previously-rendered zone purely to trigger the non-blocking
 * change pulse — this is transient UI memory, not gameplay state, so it
 * never touches GameState or save/load.
 */
export default function MarketRegimeBadge({ round, variant = 'ticker' }: { round: GameState['marketRound']; variant?: 'ticker' | 'board' }) {
  const info = marketRegimeInfo(round);
  // null until the first render establishes a baseline zone, so app load
  // never counts as a "change" — only a real Bullish/Bearish change does.
  const prevZoneRef = useRef<typeof info.zone | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (prevZoneRef.current !== null && prevZoneRef.current !== info.zone) {
      setPulseKey((k) => k + 1);
    }
    prevZoneRef.current = info.zone;
  }, [info.zone]);

  return (
    <div
      key={pulseKey}
      className={`market-regime-badge market-regime-badge--${variant}${pulseKey > 0 ? ' market-regime-badge--pulse' : ''}`}
      style={{ '--regime-color': info.color } as React.CSSProperties}
      role="status"
      aria-label={info.ariaLabel}
    >
      <span className="market-regime-glyph" aria-hidden="true">{info.glyph}</span>
      <span className="market-regime-label">{info.label}</span>
      <span className="market-regime-value">{info.detail}</span>
    </div>
  );
}
