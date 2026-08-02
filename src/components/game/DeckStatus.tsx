import { CARDS, ETF_DEFS } from '../../data';
import { useGameState } from '../../store';

interface DeckItem {
  label: string;
  glyph: string;
  color: string;
  remaining: number;
  total: number;
}

export default function DeckStatus() {
  const s = useGameState();

  // Total ETF shares owned across all players
  const etfOwned = s.players.reduce((sum, p) => {
    return sum + Object.values(p.etfShares).reduce((a, n) => a + n, 0);
  }, 0);

  const decks: DeckItem[] = [
    {
      label: 'Market Event',
      glyph: '◈',
      color: '#FF5C5C',
      remaining: s.decks.ME.length,
      total: CARDS.ME.length,
    },
    {
      label: 'Fed Rate',
      glyph: '%',
      color: '#E8B44C',
      remaining: s.decks.FED.length,
      total: CARDS.FED.length,
    },
    {
      label: 'IPO',
      glyph: '↑',
      color: '#3ED598',
      remaining: s.ipos.filter((ip) => !ip.revealed).length,
      total: s.ipos.length,
    },
    {
      label: 'ETF Funds',
      glyph: '◆',
      color: '#4DA3FF',
      remaining: ETF_DEFS.length - etfOwned,
      total: ETF_DEFS.length,
    },
  ];

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="slabel">Decks &amp; Pools</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {decks.map((d) => {
          const pct = d.total > 0 ? d.remaining / d.total : 0;
          const barColor = pct > 0.5 ? d.color : pct > 0.2 ? '#E8B44C' : '#FF5C5C';
          return (
            <div key={d.label} style={{
              padding: '7px 9px',
              borderRadius: 7,
              background: `${d.color}0d`,
              border: `1px solid ${d.color}28`,
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13, color: d.color, lineHeight: 1 }}>{d.glyph}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)', flex: 1, lineHeight: 1.2 }}>{d.label}</span>
              </div>
              {/* Progress bar */}
              <div style={{
                height: 3, borderRadius: 2,
                background: 'rgba(74,48,25,0.09)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.max(0, pct * 100)}%`,
                  height: '100%',
                  background: barColor,
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <span className="mono" style={{
                  fontSize: 16, fontWeight: 700, color: d.color, lineHeight: 1,
                }}>{d.remaining}</span>
                <span style={{ fontSize: 9, color: 'var(--muted)' }}>/ {d.total}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
