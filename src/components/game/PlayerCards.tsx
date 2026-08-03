import { isDiversified, marketStanceMeta, netWorth } from '../../engine';
import { PIECE_BY_KEY } from '../../data';
import { useGameState } from '../../store';

export default function PlayerCards() {
  const s = useGameState();
  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="slabel">Players</span>
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
            gap: 9,
            padding: active ? '9px 11px' : '7px 10px',
            borderRadius: 9,
            background: active
              ? `linear-gradient(105deg, ${p.color}22 0%, rgba(201,162,79,0.08) 100%)`
              : 'rgba(74,48,25,0.04)',
            border: active
              ? `1px solid ${p.color}60`
              : '1px solid rgba(74,48,25,0.06)',
            boxShadow: active
              ? `0 0 20px ${p.color}28, inset 0 1px 0 rgba(74,48,25,0.08)`
              : 'none',
            transition: 'all 0.25s',
          }}>
            {/* Piece token */}
            <div style={{
              width: active ? 24 : 20,
              height: active ? 24 : 20,
              borderRadius: '50%',
              background: active
                ? `radial-gradient(circle at 35% 35%, ${p.color}44, ${p.color}22)`
                : `${p.color}18`,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: active ? 13 : 11,
              boxShadow: active ? `0 0 10px ${p.color}88` : 'none',
              border: active ? `1.5px solid ${p.color}66` : `1px solid ${p.color}33`,
              transition: 'all 0.25s',
            }}>{emoji}</div>
            <span style={{
              flex: 1, fontSize: active ? 13 : 12,
              fontWeight: active ? 700 : 400,
              color: active ? 'var(--text)' : 'var(--muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'all 0.25s',
            }}>{p.name}</span>
            {div && <span style={{
              fontSize: 9, color: 'var(--green)', fontWeight: 800,
              background: 'rgba(34,197,94,0.12)', padding: '1px 5px',
              borderRadius: 3, border: '1px solid rgba(34,197,94,0.25)',
            }}>DIV</span>}
            <span title={`${stance.label} position for the next Bull or Bear Run`} style={{
              fontSize: 9, color: stance.color, fontWeight: 800,
              background: `${stance.color}12`, padding: '1px 5px',
              borderRadius: 3, border: `1px solid ${stance.color}38`,
            }}>{stance.glyph}</span>
            {s.circuitBreakerHolder === i && <span title="Circuit Breaker — may protect one owned company from a negative Market Event" style={{
              fontSize: 9, color: 'var(--gold)', fontWeight: 800,
              background: 'rgba(212,165,53,0.12)', padding: '1px 5px',
              borderRadius: 3, border: '1px solid rgba(212,165,53,0.28)',
            }}>⚡ CB</span>}
            <span className="mono" style={{
              fontSize: active ? 12 : 11,
              color: active ? 'var(--green)' : 'var(--muted)',
              fontWeight: active ? 700 : 400,
              transition: 'all 0.25s',
            }}>${nw.toLocaleString()}</span>
            <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace', minWidth: 20, textAlign: 'right', opacity: 0.7 }}>
              #{p.pos}
            </span>
          </div>
        );
      })}
    </div>
  );
}
