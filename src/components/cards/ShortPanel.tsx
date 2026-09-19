import { shortPayout } from '../../engine';
import { money } from '../../utils/formatMoney';
import { useGameState } from '../../store';

export default function ShortPanel() {
  const s = useGameState();
  if (s.shorts.length === 0) return null;

  return (
    <div className="card-box">
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>OPEN SHORTS</div>
      {s.shorts.map((sh, i) => {
        // Uses the engine's own settlement math rather than restating it — this
        // panel used to keep a hardcoded copy of the payout table.
        const current = s.prices[sh.code];
        const pnl = shortPayout(sh.entryPrice, current);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: sh.pcolor }} />
            <span className="mono" style={{ color: 'var(--accent)' }}>{sh.code}</span>
            <span className="muted">entry:{money(sh.entryPrice)}</span>
            <span className="muted">now:{money(current)}</span>
            <span style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)', marginLeft: 'auto' }}>
              {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
