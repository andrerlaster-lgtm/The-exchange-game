import { importantMarketSignals, marketMeterForecast, playerSignalExposure } from '../../engine';
import type { MarketSignal } from '../../engine';
import { useGameState } from '../../store';
import { STANCE_META, ImpactChips } from '../shared/MarketSignalBits';
import MarketRegimeBadge from './MarketRegimeBadge';
import PriceMovementGuide from './PriceMovementGuide';

const KIND_LABEL: Record<MarketSignal['kind'], string> = {
  fed: 'FED',
  market: 'MARKET EVENT',
  regime: 'MARKET RUN',
  soldout: 'SOLD OUT',
  claim: 'PAYOUT CLAIM',
  weakDemand: 'WEAK DEMAND',
  strongDemand: 'STRONG DEMAND',
  ipo: 'IPO',
  close: 'MARKET CLOSE',
  milestone: 'PORTFOLIO MILESTONE',
};

export default function MarketIntelligence() {
  const s = useGameState();
  const latestFed = s.marketSignals.find((signal) => signal.kind === 'fed');
  const fedHistory = s.marketSignals.filter((signal) => signal.kind === 'fed').slice(0, 3);
  const latestMeterMove = s.marketSignals.find((signal) =>
    signal.kind === 'market' && signal.title.startsWith('Market Meter'));
  const important = importantMarketSignals(s).slice(0, 6);
  const stance = latestFed?.stance ? STANCE_META[latestFed.stance] : STANCE_META.neutral;
  const meterForecast = marketMeterForecast(s.meter);

  return (
    <section className="card-box" aria-label="Market Intelligence" style={{ padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div>
          <div className="slabel">Market Intelligence</div>
          <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 2 }}>Fed Watch + events worth acting on</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PriceMovementGuide />
          <span style={{
            borderRadius: 999, padding: '3px 8px',
            background: stance.bg, color: stance.color,
            fontSize: 9, fontWeight: 900, letterSpacing: 0.8, textTransform: 'uppercase',
          }}>{latestFed ? stance.label : 'Waiting on Fed'}</span>
        </div>
      </div>

      {(() => {
        // Each player can be running their own independent Market Condition
        // at once — this list is the one place the whole table's personal
        // conditions are all visible together, not just the active player's.
        const active = s.players
          .map((player, i) => ({ player, condition: s.marketConditions[i] }))
          .filter((row): row is { player: typeof s.players[number]; condition: NonNullable<typeof row.condition> } => !!row.condition);
        if (active.length === 0) return null;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
            {active.map(({ player, condition }) => (
              <div key={condition.owner} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 7,
                background: `${condition.color}18`, border: `1px solid ${condition.color}55`,
              }}>
                <span style={{ fontSize: 14, lineHeight: 1, color: condition.color, flexShrink: 0 }}>{condition.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.8, color: condition.color }}>{player.name.toUpperCase()} · </span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text)' }}>{condition.title}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--muted)' }}> — {condition.detail}</span>
                </div>
                <span style={{ fontSize: 8.5, color: 'var(--muted)', fontWeight: 700, flexShrink: 0 }}>
                  {condition.remaining} {condition.durationUnit === 'turns' ? 'turn' : 'pass'}{condition.remaining === 1 ? '' : 's'} left
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {s.opts.marketMeter && (
        <div style={{
          marginBottom: 9, padding: '9px 10px', borderRadius: 8,
          background: 'rgba(30, 74, 112, 0.06)', border: '1px solid rgba(30, 74, 112, 0.17)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.9, color: 'var(--muted)' }}>MARKET METER — NEXT ROUND</div>
              <div style={{ color: 'var(--text)', fontSize: 11, fontWeight: 800, marginTop: 3 }}>{meterForecast.headline}</div>
            </div>
            <MarketRegimeBadge meter={s.meter} variant="ticker" />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 10, lineHeight: 1.35, marginTop: 5 }}>
            Your dice roll changes the Meter — it does not pick a sector by itself. {meterForecast.detail}
          </div>
          {latestMeterMove && (
            <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(30, 74, 112, 0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: 'var(--muted)' }}>LAST METER MOVE</div>
              <div style={{ color: 'var(--text)', fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>{latestMeterMove.summary}</div>
              <ImpactChips impacts={latestMeterMove.impacts} style={{ marginTop: 5 }} />
            </div>
          )}
        </div>
      )}

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
            <ImpactChips impacts={latestFed.impacts} style={{ marginTop: 7 }} />
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
                    <span style={{ color: signal.stance ? STANCE_META[signal.stance].color : 'var(--muted)' }}>●</span>{' '}
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
