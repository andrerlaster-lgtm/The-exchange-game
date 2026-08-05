import { importantMarketSignals, playerSignalExposure } from '../../engine';
import type { MarketSignal } from '../../engine';
import { useGameState } from '../../store';

const STANCE = {
  hawkish: { label: 'Hawkish', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  dovish: { label: 'Dovish', color: '#16a34a', bg: 'rgba(34,197,94,0.13)' },
  neutral: { label: 'Neutral', color: '#7c7263', bg: 'rgba(124,114,99,0.12)' },
  mixed: { label: 'Mixed', color: '#b7791f', bg: 'rgba(245,158,11,0.14)' },
};

const KIND_LABEL: Record<MarketSignal['kind'], string> = {
  fed: 'FED',
  market: 'MARKET EVENT',
  soldout: 'SOLD OUT',
  claim: 'PAYOUT CLAIM',
  weakDemand: 'WEAK DEMAND',
  ipo: 'IPO',
  close: 'MARKET CLOSE',
  milestone: 'PORTFOLIO MILESTONE',
};

function ImpactLine({ signal }: { signal: MarketSignal }) {
  const up = signal.impacts.filter((impact) => impact.d > 0).map((impact) => `${impact.code} +${impact.d}`);
  const down = signal.impacts.filter((impact) => impact.d < 0).map((impact) => `${impact.code} ${impact.d}`);
  if (!up.length && !down.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
      {up.length > 0 && <span style={impactStyle('#15803d', 'rgba(34,197,94,0.11)')}>▲ {up.join(' · ')}</span>}
      {down.length > 0 && <span style={impactStyle('#b91c1c', 'rgba(239,68,68,0.10)')}>▼ {down.join(' · ')}</span>}
    </div>
  );
}

function impactStyle(color: string, background: string): React.CSSProperties {
  return {
    color, background, borderRadius: 5, padding: '3px 7px',
    fontSize: 9, fontWeight: 800, lineHeight: 1.35,
  };
}

export default function MarketIntelligence() {
  const s = useGameState();
  const latestFed = s.marketSignals.find((signal) => signal.kind === 'fed');
  const fedHistory = s.marketSignals.filter((signal) => signal.kind === 'fed').slice(0, 3);
  const important = importantMarketSignals(s).slice(0, 6);
  const stance = latestFed?.stance ? STANCE[latestFed.stance] : STANCE.neutral;

  return (
    <section className="card-box" aria-label="Market Intelligence" style={{ padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div>
          <div className="slabel">Market Intelligence</div>
          <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>Fed Watch + events worth acting on</div>
        </div>
        <span style={{
          borderRadius: 999, padding: '3px 8px',
          background: stance.bg, color: stance.color,
          fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase',
        }}>{latestFed ? stance.label : 'Waiting on Fed'}</span>
      </div>

      {!latestFed ? (
        <div style={{
          padding: '11px 12px', borderRadius: 7,
          border: '1px dashed rgba(74,48,25,0.18)',
          color: 'var(--muted)', fontSize: 11,
        }}>
          No Fed decision yet. When a Fed card is drawn, its market meaning and affected companies will stay here.
        </div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(220px, 0.7fr)', gap: 8,
          padding: 9, borderRadius: 8,
          border: `1px solid ${stance.color}33`, background: stance.bg,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text)', fontSize: 13 }}>{latestFed.title}</strong>
              <span style={{ color: 'var(--muted)', fontSize: 9 }}>Lap {latestFed.lap}</span>
            </div>
            <div style={{ color: 'var(--text)', fontSize: 10.5, lineHeight: 1.4, marginTop: 3 }}>{latestFed.summary}</div>
            {latestFed.insight && (
              <div style={{ color: stance.color, fontSize: 10.5, lineHeight: 1.4, fontWeight: 700, marginTop: 5 }}>
                What it means: {latestFed.insight}
              </div>
            )}
            <ImpactLine signal={latestFed} />
          </div>
          <div style={{ borderLeft: '1px solid rgba(74,48,25,0.12)', paddingLeft: 9 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--muted)', letterSpacing: 0.8 }}>YOUR EXPOSURE</div>
            <div style={{ color: 'var(--text)', fontSize: 10.5, lineHeight: 1.4, marginTop: 4 }}>
              {playerSignalExposure(s, latestFed)}
            </div>
            {fedHistory.length > 1 && (
              <div style={{ marginTop: 7 }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--muted)', letterSpacing: 0.8 }}>LAST 3 FED DECISIONS</div>
                {fedHistory.map((signal) => (
                  <div key={signal.id} style={{ fontSize: 9.5, color: 'var(--text)', marginTop: 3 }}>
                    <span style={{ color: signal.stance ? STANCE[signal.stance].color : 'var(--muted)' }}>●</span>{' '}
                    {signal.title} <span style={{ color: 'var(--muted)' }}>· L{signal.lap}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 9 }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.9, color: 'var(--muted)', marginBottom: 5 }}>
          IMPORTANT EVENTS
        </div>
        {important.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 10.5 }}>Major market events will appear here. Routine turns stay out of this feed.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 5 }}>
            {important.map((signal) => (
              <div key={signal.id} style={{
                minWidth: 0, borderRadius: 6, padding: '6px 8px',
                background: 'rgba(74,48,25,0.045)', border: '1px solid rgba(74,48,25,0.08)',
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 8, color: signal.kind === 'fed' ? '#b7791f' : 'var(--muted)', fontWeight: 900, letterSpacing: 0.6 }}>
                    {KIND_LABEL[signal.kind]}
                  </span>
                </div>
                <div style={{ color: 'var(--text)', fontSize: 10.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {signal.title}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 9, lineHeight: 1.3, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {signal.summary}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
