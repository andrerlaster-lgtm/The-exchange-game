import { useGameState } from '../../store';
import type { TradeKind } from '../../engine';

const KIND_LABEL: Record<TradeKind, string> = {
  buy: 'BUY', sell: 'SELL', ipo: 'IPO',
  short: 'SHORT', settle: 'SETTL', margin: 'MARGIN', repay: 'REPAY', penalty: 'PNLTY', dividend: 'DIV',
  p2p: 'P2P', payout: 'CLAIM',
};

const KIND_COLORS: Record<TradeKind, [string, string]> = {
  buy:      ['#16502a', '#4ade80'],
  sell:     ['#5a1010', '#f87171'],
  ipo:      ['#1e1a56', '#818cf8'],
  short:    ['#5a2a08', '#fb923c'],
  settle:   ['#40320a', '#fbbf24'],
  margin:   ['#40320a', '#fbbf24'],
  repay:    ['#16502a', '#4ade80'],
  penalty:  ['#5a1010', '#f87171'],
  dividend: ['#0e3d20', '#34d399'],
  p2p:      ['#2a1656', '#a78bfa'],
  payout:   ['#4a3410', '#f0c53d'],
};

export default function TradeHistory() {
  const s = useGameState();
  const entries = s.tradeLog;

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <span className="slabel">Trade History</span>
      {entries.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>No trades yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', maxHeight: 180 }}>
          {entries.map((e, i) => {
            const [bg, fg] = KIND_COLORS[e.kind];
            const amountColor = e.amount > 0 ? '#4ade80' : e.amount < 0 ? '#f87171' : 'var(--muted)';
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '4px 7px',
                borderRadius: 5,
                background: 'rgba(74,48,25,0.05)',
                border: '1px solid rgba(74,48,25,0.06)',
              }}>
                <span className="kind-pill" style={{ background: bg, color: fg }}>
                  {KIND_LABEL[e.kind]}
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, minWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.player}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.text}
                </span>
                {e.amount !== 0 && (
                  <span className="mono" style={{ fontSize: 10, color: amountColor, flexShrink: 0, fontWeight: 600 }}>
                    {e.amount > 0 ? '+' : ''}{e.amount.toLocaleString()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
