import { useState } from 'react';
import { PLAYER_COLORS, PIECES } from '../../data';
import { DEFAULT_OPTIONS } from '../../engine';
import { useDispatch, useGameState } from '../../store';

const CASH_OPTIONS = [30_000, 40_000, 50_000];
const ROUND_OPTIONS = [5, 7, 10];

const QUICK_RULES = [
  'Roll dice, move your token, and resolve the space you land on. Doubles earn exactly 1 bonus roll after the landing is fully resolved; doubles on the bonus roll do not chain.',
  'Land on an untouched company: buy all 11 shares at its fixed tier price — Starter $5,000, Growth $7,500, or Premium $10,000 — or skip. Tier opening share prices are $500, $750, and $1,000, and the buyout adds no price increase.',
  'A company bought in full becomes Sold Out for good, and its buyer holds the Payout Claim. Everyone else who lands there pays the claim instead of opening a normal buy step; landing on your own company costs nothing.',
  'Weak Demand has no ownership protection: 2 explicit skips on an untouched company drop its price 1 step. Buying the company clears its markers.',
  'Own at least 1 share in every stock of a sector for a Sector Portfolio badge (bigger Payout Claim rent). Own regular companies across 3+ different sectors for a Diversified Portfolio bonus at Market Open (6+ sectors pays even more).',
  'Passing or landing on Market Open is payday: salary, dividends, ETF payout, and any diversification bonus, then any margin repayment. It also opens a Trading Window for private player-to-player trades.',
  'IPOs: 4 companies total, revealed one at a time at a fixed $3,000/share. Only the player who lands on an IPO space may buy, up to 2 shares.',
  'Audit Notice charges 5% of net worth, rounded to the nearest $100, with a $500 minimum. Carrying Margin raises it to 7.5% with a $750 minimum.',
  'Portfolio Tax and Audit Notice can be paid now or carried as Outstanding Fees. Debt adds 5% at the start of your turn and lowers your score until paid. A Payout Claim owed to another player still uses forced sale.',
  'Margin trading and Short Selling are advanced options, off by default.',
  'An Extended Hours card, if drawn before Market Close is triggered, delays the game end by exactly one more round.',
  'Circuit Breaker is a single held Market Event card. Play it during a later negative Market Event or Bear Run to protect 1 affected company you own from that effect’s entire price drop, or keep it for later.',
  'Market Stance: buying a company or using Margin makes you Bullish; selling 3+ shares or opening a Short makes you Bearish. The latest qualifying action sets your position for the next Bull or Bear Run, then everyone resets to Balanced.',
  'Investor Day: choose Company Growth (move 1 eligible owned company up 1 step, or collect $500 if none qualifies) or Insider Information (preview the next Market Event without drawing it).',
  'Standard Mode: build the highest net worth. Gain/Loss Mode: win with the highest Market Gain (Net Worth − Starting Cash − Salary Collected).',
  'Every stock and IPO holding tracks cost basis, unrealized gain/loss while held, and realized gain/loss when shares are sold.',
  'The game ends at Market Close — either the Market Close card is drawn or a fixed round count is reached, whichever you chose at setup.',
];

export default function SetupScreen() {
  const s = useGameState();
  const dispatch = useDispatch();
  const opts = s.opts;
  const [showRules, setShowRules] = useState(false);

  function setOpt<K extends keyof typeof DEFAULT_OPTIONS>(key: K, value: typeof DEFAULT_OPTIONS[K]) {
    dispatch({ t: 'setOpt', opt: { [key]: value } });
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '32px 0',
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #2e2010 0%, #1e1608 40%, var(--bg) 70%)',
    }}>
      <div style={{ width: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <div className="mono" style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 5,
            color: 'rgba(212,165,53,0.65)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>The Exchange</div>
          <h1 style={{
            fontSize: 36, fontWeight: 900, lineHeight: 1,
            color: '#ede8de',
            letterSpacing: -0.5,
            textShadow: '0 2px 20px rgba(212,165,53,0.2)',
          }}>Stock Market Game</h1>
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
            2–6 players · hot seat · local
          </p>
          <div style={{
            width: 56, height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(212,165,53,0.65), transparent)',
            margin: '16px auto 0',
          }} />
        </div>

        {/* Players card */}
        <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <span className="slabel">Number of Players</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  style={s.numPlayers === n
                    ? { background: 'linear-gradient(135deg, #c9903a, #a8762e)', borderColor: 'rgba(212,165,53,0.7)', color: '#1a1208', flex: 1, fontWeight: 700 }
                    : { flex: 1 }}
                  onClick={() => dispatch({ t: 'setNum', n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="slabel" style={{ marginBottom: 2 }}>Player Names &amp; Pieces</span>
            {Array.from({ length: s.numPlayers }, (_, i) => {
              const selectedPiece = s.pieces[i];
              const takenPieces = new Set(
                Array.from({ length: s.numPlayers }, (__, j) => j !== i ? s.pieces[j] : null).filter(Boolean)
              );
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Color dot + piece emoji */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `radial-gradient(circle at 35% 35%, ${PLAYER_COLORS[i]}ff, ${PLAYER_COLORS[i]}88)`,
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${PLAYER_COLORS[i]}88`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}>
                      {PIECES.find(p => p.key === selectedPiece)?.emoji ?? '?'}
                    </div>
                    <input
                      type="text"
                      value={s.names[i]}
                      placeholder={`Player ${i + 1}`}
                      style={{ flex: 1 }}
                      onChange={(e) => dispatch({ t: 'setName', i, name: e.target.value })}
                    />
                  </div>
                  {/* Piece picker */}
                  <div style={{ display: 'flex', gap: 5, paddingLeft: 38 }}>
                    {PIECES.map(piece => {
                      const active = selectedPiece === piece.key;
                      const taken = takenPieces.has(piece.key);
                      return (
                        <button
                          key={piece.key}
                          title={piece.label}
                          disabled={taken && !active}
                          onClick={() => dispatch({ t: 'setPiece', i, piece: piece.key })}
                          style={{
                            fontSize: 18, padding: '4px 7px',
                            lineHeight: 1,
                            background: active
                              ? `linear-gradient(135deg, ${PLAYER_COLORS[i]}44, ${PLAYER_COLORS[i]}22)`
                              : taken ? 'rgba(255,255,255,0.02)' : 'var(--surface)',
                            border: active
                              ? `1.5px solid ${PLAYER_COLORS[i]}aa`
                              : '1px solid var(--border)',
                            borderRadius: 7,
                            opacity: taken && !active ? 0.25 : 1,
                            cursor: taken && !active ? 'not-allowed' : 'pointer',
                            boxShadow: active ? `0 0 10px ${PLAYER_COLORS[i]}44` : 'none',
                          }}>
                          {piece.emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Options card */}
        <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="slabel">Game Options</span>

          <OptRow label="Starting Cash">
            {CASH_OPTIONS.map((v) => (
              <TBtn key={v} active={opts.startCash === v} onClick={() => setOpt('startCash', v)}>
                ${(v / 1000).toFixed(0)}k
              </TBtn>
            ))}
          </OptRow>

          <div style={{ height: 1, background: 'rgba(212,165,53,0.1)' }} />

          <OptRow label="Winning Score">
            <TBtn active={opts.scoringMode === 'netWorth'} onClick={() => setOpt('scoringMode', 'netWorth')}>
              Net Worth
            </TBtn>
            <TBtn active={opts.scoringMode === 'gainLoss'} onClick={() => setOpt('scoringMode', 'gainLoss')}>
              Gain / Loss
            </TBtn>
          </OptRow>

          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.45, padding: '0 2px' }}>
            {opts.scoringMode === 'gainLoss'
              ? 'Winner: highest Market Gain. Salary is shown but removed from the score.'
              : 'Winner: highest final net worth.'}
          </div>

          <div style={{ height: 1, background: 'rgba(212,165,53,0.1)' }} />

          <OptRow label="Companies Mode">
            <TBtn active={opts.companiesMode} onClick={() => setOpt('companiesMode', true)}>On</TBtn>
            <TBtn active={!opts.companiesMode} onClick={() => setOpt('companiesMode', false)}>Off</TBtn>
          </OptRow>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.45, padding: '0 2px' }}>
            Players become holding companies. Each keeps 60 founder shares; 40 public shares open after the first lap. A zero-value company receives one emergency bank loan up to 75% of its starting value at 5% interest.
          </div>

          <div style={{ height: 1, background: 'rgba(212,165,53,0.1)' }} />

          <OptRow label="Margin Trading">
            <TBtn active={opts.margin} onClick={() => setOpt('margin', true)}>On</TBtn>
            <TBtn active={!opts.margin} onClick={() => setOpt('margin', false)}>Off</TBtn>
          </OptRow>

          <OptRow label="Short Selling">
            <TBtn active={opts.shorts} onClick={() => setOpt('shorts', true)}>On</TBtn>
            <TBtn active={!opts.shorts} onClick={() => setOpt('shorts', false)}>Off</TBtn>
          </OptRow>

          <OptRow label="IPOs">
            <TBtn active={opts.ipos} onClick={() => setOpt('ipos', true)}>On</TBtn>
            <TBtn active={!opts.ipos} onClick={() => setOpt('ipos', false)}>Off</TBtn>
          </OptRow>

          <div style={{ height: 1, background: 'rgba(212,165,53,0.1)' }} />

          <OptRow label="Game End">
            <TBtn active={opts.closeMode === 'card'} onClick={() => setOpt('closeMode', 'card')}>
              Market Close card
            </TBtn>
            <TBtn active={opts.closeMode === 'rounds'} onClick={() => setOpt('closeMode', 'rounds')}>
              Fixed rounds
            </TBtn>
          </OptRow>

          {opts.closeMode === 'rounds' && (
            <OptRow label="Rounds">
              {ROUND_OPTIONS.map((v) => (
                <TBtn key={v} active={opts.closeRounds === v} onClick={() => setOpt('closeRounds', v)}>
                  {v}
                </TBtn>
              ))}
            </OptRow>
          )}
        </div>

        <button
          className="primary"
          style={{ padding: '13px 0', fontSize: 15, letterSpacing: 0.5, borderRadius: 8 }}
          onClick={() => dispatch({ t: 'startGame' })}>
          Start Game
        </button>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            style={{ fontSize: 12, padding: '6px 20px', color: 'var(--muted)', borderColor: 'var(--border)' }}
            onClick={() => setShowRules(true)}>
            Quick Rules
          </button>
        </div>

        <a
          href="/board-3d.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textAlign: 'center', fontSize: 11, color: 'var(--muted)',
            textDecoration: 'none', opacity: 0.7,
            letterSpacing: 1,
          }}>
          ◆ Open 3D Board Preview
        </a>
      </div>

      {/* Rules modal */}
      {showRules && (
        <div
          onClick={() => setShowRules(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--border-hi)',
              borderRadius: 12,
              padding: 28,
              display: 'flex', flexDirection: 'column', gap: 16,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="slabel" style={{ marginBottom: 0 }}>Quick Rules</span>
              <button
                onClick={() => setShowRules(false)}
                style={{ fontSize: 16, padding: '2px 8px', color: 'var(--muted)', border: 'none', background: 'none', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
            <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {QUICK_RULES.map((rule, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{rule}</li>
              ))}
            </ol>
            <div style={{ height: 1, background: 'rgba(212,165,53,0.1)' }} />
            <p style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
              Full rulebook coming soon.
            </p>
            <button className="primary" style={{ padding: '8px 0' }} onClick={() => setShowRules(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--muted)', width: 130, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function TBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={active ? {
        background: 'linear-gradient(135deg, #c9903a, #a8762e)',
        borderColor: 'rgba(212,165,53,0.7)',
        color: '#1a1208',
        fontSize: 11,
        padding: '4px 12px',
        fontWeight: 700,
        boxShadow: '0 0 14px rgba(212,165,53,0.35)',
      } : {
        fontSize: 11,
        padding: '4px 12px',
      }}>
      {children}
    </button>
  );
}
