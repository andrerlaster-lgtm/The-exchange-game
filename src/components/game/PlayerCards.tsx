import { isDiversified, marketStanceMeta, netWorth } from '../../engine';
import { PIECE_BY_KEY } from '../../data';
import { useGameState } from '../../store';

export default function PlayerCards() {
  const s = useGameState();
  return (
    <div className="card-box" style={{
      display: 'flex', flexDirection: 'column', gap: 7,
      padding: 11,
      background: 'var(--surface)',
      border: '1px solid rgba(154,111,30,0.34)',
      boxShadow: 'var(--panel-shadow)',
    }}>
      <span className="slabel" style={{ color: 'var(--text)', letterSpacing: '0.08em' }}>Players</span>
      {s.players.map((p, i) => {
        const active = i === s.cur;
        const nw = netWorth(s, p);
        const div = isDiversified(s, p);
        const stance = marketStanceMeta(p.marketStance);
        const emoji = PIECE_BY_KEY[p.piece]?.emoji ?? '●';
        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: active ? '10px 9px' : '8px 9px',
            borderRadius: 9,
            background: active
              ? `linear-gradient(105deg, ${p.color}30 0%, rgba(201,162,79,0.18) 100%)`
              : 'rgba(74,48,25,0.09)',
            border: active
              ? `1px solid ${p.color}a0`
              : '1px solid rgba(74,48,25,0.20)',
            borderLeft: `3px solid ${p.color}${active ? 'd0' : '80'}`,
            boxShadow: active
              ? `0 0 18px ${p.color}35, inset 0 1px 0 rgba(255,255,255,0.35)`
              : 'inset 0 1px 0 rgba(255,255,255,0.2)',
            transition: 'all 0.25s',
          }}>
            {/* Piece token */}
            <div style={{
              width: active ? 24 : 20,
              height: active ? 24 : 20,
              borderRadius: '50%',
              background: active
                ? `radial-gradient(circle at 35% 35%, ${p.color}66, ${p.color}32)`
                : `${p.color}30`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: active ? 13 : 11,
              boxShadow: active ? `0 0 10px ${p.color}88` : 'none',
              border: active ? `1.5px solid ${p.color}a0` : `1px solid ${p.color}70`,
              transition: 'all 0.25s',
            }}>{emoji}</div>
            <span style={{
              flex: 1, minWidth: 42, fontSize: active ? 13 : 12,
              fontWeight: active ? 700 : 600,
              color: 'var(--text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'all 0.25s',
            }}>{p.name}</span>
            {div && <span style={{
              fontSize: 9, color: 'var(--green)', fontWeight: 800,
              background: 'rgba(34,197,94,0.16)', padding: '2px 5px',
              borderRadius: 3, border: '1px solid rgba(34,197,94,0.25)',
            }}>DIV</span>}
            <span title={`${stance.label} position for the next Bull or Bear Run`} style={{
              fontSize: 9, color: stance.color, fontWeight: 800,
              background: `${stance.color}18`, padding: '2px 5px',
              borderRadius: 3, border: `1px solid ${stance.color}38`,
            }}>{stance.glyph}</span>
            {s.circuitBreakerHolder === i && <span title="Circuit Breaker — may protect one owned company from a negative Market Event or Bear Run" style={{
              fontSize: 9, color: 'var(--gold)', fontWeight: 800,
              background: 'rgba(212,165,53,0.16)', padding: '2px 5px',
              borderRadius: 3, border: '1px solid rgba(212,165,53,0.28)',
            }}>⚡ CB</span>}
            <span className="mono" style={{
              fontSize: active ? 12 : 11,
              color: active ? 'var(--green)' : 'var(--text)',
              fontWeight: active ? 700 : 600,
              transition: 'all 0.25s',
            }}>${nw.toLocaleString()}</span>
            <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace', minWidth: 20, textAlign: 'right', opacity: 0.9 }}>
              #{p.pos}
            </span>
          </div>
        );
      })}
    </div>
  );
}
