import { importantMarketSignals, playerSignalExposure, roundMarketForecast } from '../../engine';
import type { MarketSignal } from '../../engine';
import { useGameState } from '../../store';
import { STANCE_META, ImpactChips } from '../shared/MarketSignalBits';
import MarketRegimeBadge from './MarketRegimeBadge';
import { IPO_RUN_BP, MOVE_BP, RUN_BP } from '../../data';
import { moveSize } from '../../utils/formatMoney';

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

const PRICE_MOVEMENT_GUIDE = [
  {
    title: 'Round-end market',
    text: 'Your roll moves your piece — and both dice go into the round\'s tally. When every player has taken a turn, the first dice are totalled and wrapped to six to pick the market bloc, and the second dice averaged to set the move: below 3.5 is Bearish, above is Bullish, and the further from 3.5 the round strayed, the bigger the move — 2.5%, 5% or 7.5%. Revealed IPOs in that bloc move with it. No single roll decides anything, and the running tally is shown above all round.',
  },
  {
    title: 'Market Event & Fed cards',
    text: 'The drawn card names the sectors, risk groups, or companies that move, and by how much (for example 5% = 500 bp) — and nothing else. A card never stirs an extra random sector.',
  },
  {
    title: 'The Bank Rate',
    text: 'Fed rate cards and the Rate Decision space move the Bank Rate, and that change moves Finance one way and Real Estate and High-Risk companies the other, at 10 bp of price per 1 bp of rate. The full arithmetic is in the rates bar above the board.',
  },
  {
    title: 'Bull & Bear Runs',
    text: `High-Risk stocks move ${moveSize(RUN_BP.High)}, Medium-Risk stocks ${moveSize(RUN_BP.Med)}, Low-Risk stocks stay steady, and revealed IPOs ${moveSize(IPO_RUN_BP)}. A Bull Run moves them up; a Bear Run moves them down.`,
  },
  {
    title: 'Weak Demand',
    text: `Two skips on the same untouched company lower its price ${moveSize(MOVE_BP.weakDemand)}. Its markers remain until the drop happens or somebody buys the company.`,
  },
  {
    title: 'Strong Demand & Payout Claims',
    text: `A Payout Claim does not raise the price by itself. Two qualifying opponent landings on the same Sold-Out company create Strong Demand and raise that company ${moveSize(MOVE_BP.strongDemand)}.`,
  },
  {
    title: 'Buying, selling & private trades',
    text: `Buying a company or outstanding shares does not move its price. Selling 3 or more shares to the bank lowers it ${moveSize(MOVE_BP.bankSale)}. Private player-to-player trades do not move market prices.`,
  },
] as const;

function PriceMovementGuide() {
  return (
    <details style={{
      marginBottom: 9, borderRadius: 8,
      background: 'rgba(212,165,53,0.055)', border: '1px solid rgba(212,165,53,0.18)',
    }}>
      <summary style={{
        cursor: 'pointer', padding: '8px 10px', color: 'var(--text)',
        fontSize: 10.5, fontWeight: 900, letterSpacing: 0.65,
      }}>
        HOW STOCK PRICES MOVE · OPEN GUIDE
      </summary>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6,
        padding: '0 9px 9px',
      }}>
        {PRICE_MOVEMENT_GUIDE.map((item) => (
          <div key={item.title} style={{
            padding: '7px 8px', borderRadius: 6,
            background: 'rgba(74,48,25,0.04)', border: '1px solid rgba(74,48,25,0.08)',
          }}>
            <div style={{ color: 'var(--text)', fontSize: 10, fontWeight: 900 }}>{item.title}</div>
            <div style={{ color: 'var(--muted)', fontSize: 9.5, lineHeight: 1.4, marginTop: 3 }}>{item.text}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function MarketIntelligence() {
  const s = useGameState();
  const latestFed = s.marketSignals.find((signal) => signal.kind === 'fed');
  const fedHistory = s.marketSignals.filter((signal) => signal.kind === 'fed').slice(0, 3);
  const latestRoundMove = s.marketSignals.find((signal) =>
    signal.kind === 'market' && signal.title.startsWith('Round-End Market'));
  const important = importantMarketSignals(s).slice(0, 6);
  const stance = latestFed?.stance ? STANCE_META[latestFed.stance] : STANCE_META.neutral;
  const roundForecast = roundMarketForecast(s);

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

      {s.opts.roundMarket && (
        <div style={{
          marginBottom: 9, padding: '9px 10px', borderRadius: 8,
          background: 'rgba(30, 74, 112, 0.06)', border: '1px solid rgba(30, 74, 112, 0.17)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.9, color: 'var(--muted)' }}>ROUND-END MARKET — NEXT RESOLUTION</div>
              <div style={{ color: 'var(--text)', fontSize: 11, fontWeight: 800, marginTop: 3 }}>{roundForecast.headline}</div>
            </div>
            <MarketRegimeBadge round={s.marketRound} variant="ticker" />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 10, lineHeight: 1.35, marginTop: 5 }}>
            {roundForecast.detail}
          </div>
          {latestRoundMove && (
            <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(30, 74, 112, 0.12)' }}>
              <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: 'var(--muted)' }}>LAST ROUND-END MOVE</div>
              <div style={{ color: 'var(--text)', fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>{latestRoundMove.summary}</div>
              <ImpactChips impacts={latestRoundMove.impacts} style={{ marginTop: 5 }} />
            </div>
          )}
        </div>
      )}

      <PriceMovementGuide />

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
