import { LADDER } from '../../data';
import { useGameState } from '../../store';

export default function ShortPanel() {
  const s = useGameState();
  if (s.shorts.length === 0) return null;

  return (
    <div className="card-box">
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>OPEN SHORTS</div>
      {s.shorts.map((sh, i) => {
        const current = s.prices[sh.code];
        const delta = current - sh.entryStep;
        const pnl = delta <= -2 ? 1000 : delta === -1 ? 500 : delta === 0 ? 0 : delta === 1 ? -500 : -1000;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: sh.pcolor }} />
            <span className="mono" style={{ color: 'var(--accent)' }}>{sh.code}</span>
            <span className="muted">entry:${LADDER[sh.entryStep]?.toLocaleString()}</span>
            <span className="muted">now:${LADDER[current]?.toLocaleString()}</span>
            <span style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 'auto' }}>
              {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
