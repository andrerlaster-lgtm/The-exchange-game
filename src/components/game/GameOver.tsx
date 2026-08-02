import { getRankedPlayers } from '../../engine';
import { useDispatch, useGameState } from '../../store';

export default function GameOver() {
  const s = useGameState();
  const dispatch = useDispatch();
  const ranked = getRankedPlayers(s);
  const winner = ranked[0];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '32px 16px',
      background: 'radial-gradient(ellipse 100% 70% at 50% 0%, #2e2010 0%, #1e1608 45%, var(--bg) 70%)',
    }}>
      <div style={{ width: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 4,
            color: 'rgba(212,165,53,0.65)', textTransform: 'uppercase', marginBottom: 10,
          }}>Market Closed</div>
          <h1 style={{
            fontSize: 34, fontWeight: 900, lineHeight: 1, letterSpacing: -0.5,
            color: '#f0e8d8',
            textShadow: '0 2px 20px rgba(212,165,53,0.2)',
          }}>Game Over</h1>
          <div style={{ width: 56, height: 2, background: 'linear-gradient(90deg, transparent, rgba(212,165,53,0.6), transparent)', margin: '14px auto 0' }} />
        </div>

        {/* Winner spotlight */}
        <div style={{
          background: `linear-gradient(135deg, ${winner.color}18 0%, rgba(212,165,53,0.06) 100%)`,
          border: `1px solid ${winner.color}50`,
          borderTop: `1px solid ${winner.color}80`,
          borderRadius: 14,
          padding: '22px 24px',
          textAlign: 'center',
          boxShadow: `0 0 40px ${winner.color}18, var(--panel-shadow)`,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: 'rgba(212,165,53,0.7)', textTransform: 'uppercase', marginBottom: 8 }}>
            🏆 Winner
          </div>
          <div style={{
            fontSize: 28, fontWeight: 900,
            color: winner.color,
            textShadow: `0 0 24px ${winner.color}66`,
            marginBottom: 6,
          }}>{winner.name}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
            Final Net Worth
          </div>
          <div className="mono" style={{
            fontSize: 36, fontWeight: 800, color: '#22c55e',
            textShadow: '0 0 20px rgba(34,197,94,0.4)',
            letterSpacing: -1,
          }}>
            ${winner.nw.toLocaleString()}
          </div>

          {/* Winner breakdown */}
          <div style={{
            display: 'grid', gridTemplateColumns: winner.etfsValue > 0 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
            gap: 10, marginTop: 18,
            padding: '14px 0 2px',
            borderTop: '1px solid rgba(212,165,53,0.12)',
          }}>
            <BreakdownCell label="Cash" value={`$${winner.cash.toLocaleString()}`} color="var(--green)" />
            <BreakdownCell label="Stocks" value={`$${winner.stocksValue.toLocaleString()}`} color="var(--blue)" />
            {winner.etfsValue > 0 && (
              <BreakdownCell label="ETFs" value={`$${winner.etfsValue.toLocaleString()}`} color="var(--accent)" />
            )}
            <BreakdownCell label="Margin" value={winner.margin > 0 ? `−$${winner.margin.toLocaleString()}` : '—'} color={winner.margin > 0 ? 'var(--red)' : 'var(--muted)'} />
          </div>
          <div style={{ fontSize: 10, color: 'rgba(212,165,53,0.45)', marginTop: 10, letterSpacing: 0.5 }}>
            Cash + Stocks{winner.etfsValue > 0 ? ' + ETFs' : ''} − Margin = ${winner.nw.toLocaleString()}
          </div>
        </div>

        {/* Final leaderboard */}
        <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <span className="slabel">Final Standings</span>
          {ranked.map((p, idx) => (
            <div key={p.playerIdx} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 8px',
              borderBottom: idx < ranked.length - 1 ? '1px solid rgba(212,165,53,0.1)' : 'none',
              background: idx === 0 ? 'linear-gradient(105deg, rgba(212,165,53,0.07), transparent)' : 'transparent',
              borderRadius: idx === 0 ? 7 : 0,
            }}>
              {/* Rank */}
              <span className="mono" style={{
                fontSize: 13, width: 26, flexShrink: 0, fontWeight: 700,
                color: idx === 0 ? 'var(--gold)' : 'var(--muted)',
              }}>#{idx + 1}</span>

              {/* Token */}
              <div style={{
                width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
                background: `radial-gradient(circle at 35% 35%, ${p.color}ff, ${p.color}88)`,
                boxShadow: idx === 0 ? `0 0 10px ${p.color}99` : `0 0 5px ${p.color}66`,
                border: '1.5px solid rgba(255,255,255,0.2)',
              }} />

              {/* Name */}
              <span style={{
                flex: 1, fontSize: 13,
                fontWeight: idx === 0 ? 700 : 400,
                color: idx === 0 ? 'var(--gold)' : 'var(--text)',
              }}>
                {p.name}
                {idx === 0 && <span style={{ marginLeft: 6, fontSize: 12 }}>★</span>}
              </span>

              {/* Breakdown */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5 }}>CASH</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--green)' }}>${p.cash.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5 }}>STOCKS</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--blue)' }}>${p.stocksValue.toLocaleString()}</div>
                </div>
                {p.etfsValue > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5 }}>ETFS</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>${p.etfsValue.toLocaleString()}</div>
                  </div>
                )}
                {p.margin > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5 }}>MARGIN</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--red)' }}>−${p.margin.toLocaleString()}</div>
                  </div>
                )}
                <div style={{ textAlign: 'right', minWidth: 72 }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 0.5 }}>NET WORTH</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: idx === 0 ? '#22c55e' : 'var(--text)' }}>
                    ${p.nw.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Formula reminder */}
        <div style={{
          textAlign: 'center', fontSize: 11, color: 'var(--muted)',
          padding: '6px 0', letterSpacing: 0.5,
        }}>
          Net Worth = Cash + Stock Value + ETF Value − Outstanding Margin
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            style={{ flex: 1, padding: '12px 0', fontSize: 13 }}
            onClick={() => dispatch({ t: 'newGame' })}>
            Back to Setup
          </button>
          <button
            className="primary"
            style={{ flex: 2, padding: '12px 0', fontSize: 15, letterSpacing: 0.5 }}
            onClick={() => dispatch({ t: 'newGame' })}>
            Play Again
          </button>
        </div>

      </div>
    </div>
  );
}

function BreakdownCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
