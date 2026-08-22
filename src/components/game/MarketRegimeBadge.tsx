import { useEffect, useRef, useState } from 'react';
import { marketRegimeInfo, type MarketRegimeInfo } from '../../utils/marketRegime';

const SCALE_POSITIONS = [-3, -2, -1, 0, 1, 2, 3];

/** Compact −3..+3 scale — a non-color signal for the current zone, not just
    the needle position. Dots in the active zone's band are tinted; the
    current value's dot is filled and slightly larger. */
function MeterScale({ info }: { info: MarketRegimeInfo }) {
  return (
    <div className="market-regime-scale" role="presentation">
      {SCALE_POSITIONS.map((pos) => {
        const zoneOfPos = pos <= -2 ? 'bear' : pos >= 2 ? 'bull' : 'neutral';
        const active = pos === info.meter;
        return (
          <span
            key={pos}
            className={`market-regime-scale-dot ${zoneOfPos}${active ? ' active' : ''}`}
          />
        );
      })}
    </div>
  );
}

/**
 * The one persistent Market Condition display, reused (with layout-only
 * variants) in the top banner and the 2D board center panel. A local ref
 * tracks the previously-rendered zone purely to trigger the non-blocking
 * change pulse — this is transient UI memory, not gameplay state, so it
 * never touches GameState or save/load.
 */
export default function MarketRegimeBadge({ meter, variant = 'ticker' }: { meter: number; variant?: 'ticker' | 'board' }) {
  const info = marketRegimeInfo(meter);
  // null until the first render establishes a baseline zone, so app load
  // never counts as a "change" — only a real bull/neutral/bear transition does.
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
      <span className="market-regime-value">{info.meterText}</span>
      <MeterScale info={info} />
    </div>
  );
}
