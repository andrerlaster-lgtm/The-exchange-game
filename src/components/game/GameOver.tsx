import { useEffect, useState } from 'react';
import { buildSessionDebrief, debriefShareText, getRankedPlayers } from '../../engine';
import { useDispatch, useGameState } from '../../store';

const DEBRIEF_TEXT = '#f0e8d8';
const DEBRIEF_MUTED = '#a99b88';
const DEBRIEF_GOLD = '#d4a535';
const DEBRIEF_GREEN = '#4ade80';
const DEBRIEF_RED = '#f87171';

export default function GameOver() {
  const s = useGameState();
  const dispatch = useDispatch();
  const ranked = getRankedPlayers(s);
  const debrief = buildSessionDebrief(s);
  const [copied, setCopied] = useState(false);
  const gainLossMode = s.opts.scoringMode === 'gainLoss';

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
  }, []);

  async function copyDebrief() {
    try {
      await navigator.clipboard.writeText(debriefShareText(s));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div style={styles.eyebrow}>The Exchange · Post-Mortem</div>
          <h1 style={styles.title}>Session Debrief</h1>
          <p style={styles.subtitle}>
            Market closed after lap {debrief.summary.lapsReached}. The trades are final. The excuses remain highly liquid.
          </p>
          <div style={styles.sessionMeta}>
            <span>{debrief.summary.players} players</span>
            <span>•</span>
            <span>{gainLossMode ? 'Gain / Loss Mode' : 'Net Worth Mode'}</span>
            <span>•</span>
            <span>{debrief.summary.marketEvents} market signals</span>
          </div>
        </header>

        <section aria-label="Session summary" style={styles.summaryGrid}>
          <SummaryCard
            icon="🧾"
            label="Outstanding at Bell"
            value={money(debrief.summary.outstandingFees)}
            note={debrief.summary.outstandingFees > 0 ? 'Deducted from final scores' : 'The bank found nobody to chase'}
            danger={debrief.summary.outstandingFees > 0}
          />
          <SummaryCard
            icon="⏱"
            label="Interest Still Owed"
            value={money(debrief.summary.interestStillOwed)}
            note="5% each debtor turn · $100 minimum"
            danger={debrief.summary.interestStillOwed > 0}
          />
          <SummaryCard
            icon="🏢"
            label="Companies Cornered"
            value={debrief.summary.companiesCornered.toString()}
            note={`${debrief.summary.companiesUntouched} never bought`}
          />
          <SummaryCard
            icon="↕"
            label="Biggest Swing"
            value={signedMoney(debrief.summary.biggestSwing)}
            note={debrief.summary.biggestSwingPlayer}
            tone={gainColor(debrief.summary.biggestSwing)}
          />
        </section>

        <section style={styles.panel} aria-labelledby="final-standings-title">
          <SectionHeading id="final-standings-title" kicker="The Closing Bell" title="Final Standings" />
          <div style={{ display: 'grid', gap: 7 }}>
            {ranked.map((player, index) => (
              <div key={player.playerIdx} style={{
                ...styles.standingRow,
                ...(index === 0 ? styles.winnerRow : {}),
              }}>
                <span className="mono" style={{ color: index === 0 ? DEBRIEF_GOLD : DEBRIEF_MUTED, width: 28 }}>#{index + 1}</span>
                <span aria-hidden="true" style={{ ...styles.token, background: player.color, boxShadow: `0 0 10px ${player.color}77` }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: index === 0 ? DEBRIEF_GOLD : DEBRIEF_TEXT, fontWeight: 800 }}>
                    {player.name}{index === 0 ? ' ★' : ''}
                  </div>
                  <div style={styles.mutedLine}>
                    Cash {money(player.cash)} · Stocks {money(player.stocksValue)}
                    {player.margin > 0 ? ` · Margin −${money(player.margin)}` : ''}
                    {player.feeDebt > 0 ? ` · Fees −${money(player.feeDebt)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 900, color: gainLossMode ? gainColor(player.marketGain) : index === 0 ? DEBRIEF_GREEN : DEBRIEF_TEXT }}>
                    {gainLossMode ? signedMoney(player.marketGain) : money(player.nw)}
                  </div>
                  <div style={styles.tinyLabel}>{gainLossMode ? 'MARKET GAIN' : 'NET WORTH'}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ ...styles.mutedLine, textAlign: 'center', margin: '14px 0 0' }}>
            {gainLossMode
              ? 'Market Gain = Net Worth − Starting Cash − Salary Collected'
              : 'Net Worth = Cash + Stock Value + ETF Value − Margin − Outstanding Fees'}
          </p>
        </section>

        <section aria-labelledby="post-mortem-title">
          <SectionHeading id="post-mortem-title" kicker="No Analysts Were Spared" title="Player Post-Mortems" />
          <div style={styles.playerGrid}>
            {ranked.map((player) => {
              const card = debrief.players.find((entry) => entry.playerIdx === player.playerIdx)!;
              return (
                <article key={player.playerIdx} style={{ ...styles.playerCard, borderTopColor: player.color }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span aria-hidden="true" style={{ ...styles.token, width: 12, height: 12, background: player.color }} />
                    <span style={{ fontWeight: 850, color: DEBRIEF_TEXT }}>{player.name}</span>
                    <span className="mono" style={{ marginLeft: 'auto', color: gainColor(player.marketGain), fontWeight: 800 }}>
                      {signedMoney(player.marketGain)}
                    </span>
                  </div>
                  <h3 style={styles.jokeTitle}>{card.title}</h3>
                  <p style={styles.verdict}>{card.verdict}</p>
                  <div style={styles.cardStats}>
                    <Stat label="Sectors" value={card.sectors.toString()} />
                    <Stat label="Claims" value={card.controlledCompanies.toString()} />
                    <Stat label="Top Bet" value={card.largestHolding ?? 'CASH'} />
                    <Stat label="Focus" value={card.concentrationPct > 0 ? `${card.concentrationPct}%` : '—'} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section style={styles.panel} aria-labelledby="tape-title">
          <SectionHeading id="tape-title" kicker="The Receipts" title="The Tape" />
          <div style={{ display: 'grid', gap: 0 }}>
            {debrief.tape.map((entry, index) => (
              <div key={`${entry.lap}-${index}-${entry.text}`} style={styles.tapeRow}>
                <span className="mono" style={styles.lapPill}>LAP {entry.lap}</span>
                <span aria-hidden="true" style={{ color: tapeColor(entry.tone), fontSize: 13 }}>
                  {entry.tone === 'up' ? '▲' : entry.tone === 'down' ? '▼' : '◆'}
                </span>
                <span style={{ color: DEBRIEF_TEXT, lineHeight: 1.45 }}>{entry.text}</span>
              </div>
            ))}
          </div>
        </section>

        <div style={styles.actions}>
          <button onClick={() => dispatch({ t: 'newGame' })} style={{ flex: 1, minWidth: 150, padding: '12px 18px' }}>
            Change Setup
          </button>
          <button onClick={copyDebrief} style={{ flex: 1, minWidth: 170, padding: '12px 18px' }}>
            {copied ? 'Copied ✓' : 'Copy the Damage'}
          </button>
          <button className="primary" onClick={() => dispatch({ t: 'startGame' })} style={{ flex: 1.4, minWidth: 180, padding: '12px 18px', fontSize: 15 }}>
            Run It Back
          </button>
        </div>
        <div aria-live="polite" style={styles.copyStatus}>{copied ? 'Session debrief copied to your clipboard.' : ''}</div>
      </div>
    </main>
  );
}

function SectionHeading({ id, kicker, title }: { id: string; kicker: string; title: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={styles.eyebrow}>{kicker}</div>
      <h2 id={id} style={{ fontSize: 21, margin: '4px 0 0', color: DEBRIEF_TEXT }}>{title}</h2>
    </div>
  );
}

function SummaryCard({ icon, label, value, note, danger = false, tone }: {
  icon: string;
  label: string;
  value: string;
  note: string;
  danger?: boolean;
  tone?: string;
}) {
  return (
    <article style={styles.summaryCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>{icon}</span>
        <span style={styles.tinyLabel}>{label}</span>
      </div>
      <div className="mono" style={{ fontSize: 25, fontWeight: 900, color: tone ?? (danger ? DEBRIEF_RED : DEBRIEF_GOLD), marginTop: 12 }}>{value}</div>
      <div style={{ ...styles.mutedLine, marginTop: 5 }}>{note}</div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={styles.tinyLabel}>{label}</div>
      <div className="mono" style={{ marginTop: 4, fontWeight: 800, color: DEBRIEF_TEXT }}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    overflowY: 'auto' as const,
    padding: '54px 16px 38px',
    background: 'radial-gradient(ellipse 90% 45% at 50% 0%, #2f2110 0%, #18130b 48%, var(--bg) 76%)',
  },
  shell: {
    width: 'min(1120px, 100%)',
    margin: '0 auto',
    display: 'grid',
    gap: 20,
  },
  eyebrow: {
    color: 'rgba(212,165,53,0.72)',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 2.5,
    textTransform: 'uppercase' as const,
  },
  title: {
    margin: '7px 0 10px',
    color: '#f0e8d8',
    fontSize: 'clamp(34px, 6vw, 58px)',
    lineHeight: 0.98,
    letterSpacing: -1.5,
  },
  subtitle: {
    margin: '0 auto',
    maxWidth: 690,
    color: DEBRIEF_MUTED,
    fontSize: 13,
    lineHeight: 1.6,
  },
  sessionMeta: {
    marginTop: 13,
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    gap: 9,
    color: 'rgba(212,165,53,0.6)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: 11,
  },
  summaryCard: {
    padding: '16px 17px',
    borderRadius: 11,
    border: '1px solid rgba(212,165,53,0.16)',
    background: 'linear-gradient(145deg, rgba(38,30,19,0.96), rgba(19,17,13,0.96))',
    boxShadow: 'var(--panel-shadow)',
  },
  panel: {
    padding: '20px',
    borderRadius: 13,
    border: '1px solid rgba(212,165,53,0.16)',
    background: 'rgba(21,18,13,0.91)',
    boxShadow: 'var(--panel-shadow)',
  },
  standingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 11px',
    borderRadius: 8,
    border: '1px solid rgba(212,165,53,0.08)',
    background: 'rgba(255,255,255,0.015)',
  },
  winnerRow: {
    borderColor: 'rgba(212,165,53,0.35)',
    background: 'linear-gradient(100deg, rgba(212,165,53,0.10), rgba(255,255,255,0.01))',
  },
  token: {
    width: 13,
    height: 13,
    borderRadius: '50%',
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.35)',
  },
  tinyLabel: {
    color: DEBRIEF_MUTED,
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  mutedLine: {
    color: DEBRIEF_MUTED,
    fontSize: 10,
    lineHeight: 1.5,
  },
  playerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))',
    gap: 12,
  },
  playerCard: {
    padding: '17px',
    borderRadius: 11,
    border: '1px solid rgba(212,165,53,0.14)',
    borderTop: '3px solid',
    background: 'linear-gradient(150deg, rgba(34,28,19,0.96), rgba(18,16,13,0.97))',
    boxShadow: 'var(--panel-shadow)',
  },
  jokeTitle: {
    margin: '18px 0 7px',
    color: DEBRIEF_GOLD,
    fontSize: 18,
    lineHeight: 1.15,
  },
  verdict: {
    minHeight: 61,
    margin: 0,
    color: DEBRIEF_MUTED,
    fontSize: 12,
    lineHeight: 1.55,
  },
  cardStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 8,
    paddingTop: 13,
    marginTop: 14,
    borderTop: '1px solid rgba(212,165,53,0.12)',
  },
  tapeRow: {
    display: 'grid',
    gridTemplateColumns: '60px 18px 1fr',
    alignItems: 'start',
    gap: 9,
    padding: '10px 0',
    borderBottom: '1px solid rgba(212,165,53,0.08)',
    fontSize: 11,
  },
  lapPill: {
    color: 'rgba(212,165,53,0.9)',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.6,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 10,
    justifyContent: 'center',
  },
  copyStatus: {
    minHeight: 16,
    textAlign: 'center' as const,
    color: DEBRIEF_GREEN,
    fontSize: 10,
  },
};

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function signedMoney(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '$0';
  return `${rounded > 0 ? '+' : '−'}$${Math.abs(rounded).toLocaleString()}`;
}

function gainColor(value: number): string {
  return value > 0 ? DEBRIEF_GREEN : value < 0 ? DEBRIEF_RED : DEBRIEF_MUTED;
}

function tapeColor(tone: 'up' | 'down' | 'neutral'): string {
  return tone === 'up' ? DEBRIEF_GREEN : tone === 'down' ? DEBRIEF_RED : DEBRIEF_GOLD;
}
