import { useState } from 'react';
import { getRankedPlayers } from '../../engine';
import { useGameState } from '../../store';

export default function Leaderboard() {
  const s = useGameState();
  const ranked = getRankedPlayers(s);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="slabel">Standings</span>
      {ranked.map((p) => {
        const isActive = p.playerIdx === s.cur;
        const isLeader = p.rank === 0;
        const isExpanded = expanded === p.playerIdx;
        const delta = p.rankDelta;
        const deltaGlyph = delta === null ? '' : delta > 0 ? '▲' : delta < 0 ? '▼' : '—';
        const deltaColor = delta === null ? 'transparent'
          : delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--muted)';

        return (
          <div key={p.playerIdx} style={{ borderRadius: 7, overflow: 'hidden' }}>
            <div
              onClick={() => setExpanded(isExpanded ? null : p.playerIdx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 10px',
                cursor: 'pointer',
                background: isActive
                  ? `linear-gradient(105deg, ${p.color}20, rgba(201,162,79,0.08))`
                  : isLeader ? 'linear-gradient(105deg, rgba(240,197,61,0.08), rgba(240,197,61,0.03))' : 'rgba(74,48,25,0.04)',
                border: isActive
                  ? `1px solid ${p.color}50`
                  : isLeader ? '1px solid rgba(240,197,61,0.22)' : '1px solid rgba(74,48,25,0.06)',
                boxShadow: isLeader ? '0 0 16px rgba(240,197,61,0.08), inset 0 1px 0 rgba(240,197,61,0.06)' : 'none',
                borderRadius: 8,
                transition: 'background 0.15s',
              }}>
              {/* Rank */}
              <span className="mono" style={{
                fontSize: 10, width: 18, flexShrink: 0,
                color: isLeader ? 'var(--gold)' : 'var(--muted)',
                fontWeight: isLeader ? 700 : 400,
              }}>#{p.rank + 1}</span>

              {/* Rank delta */}
              <span style={{ fontSize: 8, color: deltaColor, width: 8, textAlign: 'center', fontWeight: 700, flexShrink: 0 }}>
                {deltaGlyph}
              </span>

              {/* Token */}
              <div style={{
                width: 12, height: 12, borderRadius: '50%',
                background: `radial-gradient(circle at 35% 35%, ${p.color}ff, ${p.color}88)`,
                flexShrink: 0,
                boxShadow: isActive ? `0 0 10px ${p.color}cc` : `0 0 5px ${p.color}66`,
                border: isActive ? '1.5px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.15)',
              }} />

              {/* Name */}
              <span style={{
                flex: 1, fontSize: 12,
                fontWeight: isLeader || isActive ? 700 : 400,
                color: isLeader ? 'var(--gold)' : 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</span>

              {isLeader && <span style={{ fontSize: 11, color: 'var(--gold)', filter: 'drop-shadow(0 0 4px rgba(240,197,61,0.6))', flexShrink: 0 }}>★</span>}
              {isActive && !isLeader && <span style={{ fontSize: 8, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>YOU</span>}

              {/* Net worth */}
              <span className="mono" style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>
                ${p.nw.toLocaleString()}
              </span>
            </div>

            {/* Breakdown */}
            {isExpanded && (
              <div style={{
                padding: '6px 10px 8px',
                background: 'rgba(74,48,25,0.09)',
                borderTop: '1px solid rgba(74,48,25,0.06)',
                display: 'flex', flexDirection: 'column', gap: 3,
              }}>
                <BRow label="Cash" value={p.cash} color="var(--green)" />
                <BRow label="Stocks" value={p.stocksValue} color="var(--accent)" />
                {p.margin > 0 && <BRow label="Margin" value={-p.margin} color="var(--red)" />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="mono" style={{ color }}>
        {value >= 0 ? '$' : '−$'}{Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}
