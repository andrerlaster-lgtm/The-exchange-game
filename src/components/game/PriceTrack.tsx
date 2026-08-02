import { LADDER, SECTORS, STOCKS } from '../../data';
import { useGameState } from '../../store';

export default function PriceTrack() {
  const s = useGameState();
  const sectorGroups: Record<string, typeof STOCKS> = {};
  for (const st of STOCKS) {
    if (!sectorGroups[st.sector]) sectorGroups[st.sector] = [];
    sectorGroups[st.sector].push(st);
  }

  return (
    <div className="card-box">
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>PRICE TRACK</div>
      <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(12, 1fr)', gap: 2, marginBottom: 6 }}>
        <div />
        {LADDER.map((price, i) => (
          <div key={i} style={{ fontSize: 9, textAlign: 'center', color: 'var(--muted)' }}>
            ${price >= 1000 ? `${price / 1000}k` : price}
          </div>
        ))}
      </div>

      {Object.entries(sectorGroups).map(([sec, stocks]) => {
        const sector = SECTORS[sec as keyof typeof SECTORS];
        return (
          <div key={sec} style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 9, color: sector.color, marginBottom: 2 }}>{sector.name}</div>
            {stocks.map((st) => (
              <div key={st.code} style={{ display: 'grid', gridTemplateColumns: '90px repeat(12, 1fr)', gap: 2, marginBottom: 2 }}>
                <div style={{ fontSize: 9, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span className="mono" style={{ color: sector.color }}>{st.code}</span>
                </div>
                {LADDER.map((_, i) => (
                  <div key={i} style={{
                    height: 14, borderRadius: 2,
                    background: i === s.prices[st.code] ? sector.color : 'var(--border)',
                    opacity: i <= s.prices[st.code] ? 1 : 0.2,
                  }} />
                ))}
              </div>
            ))}
          </div>
        );
      })}

      {s.ipos.some((ip) => ip.revealed) && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--green)', marginBottom: 2 }}>IPOs</div>
          {s.ipos.filter((ip) => ip.revealed).map((ip) => (
            <div key={ip.code} style={{ display: 'grid', gridTemplateColumns: '90px repeat(12, 1fr)', gap: 2, marginBottom: 2 }}>
              <div style={{ fontSize: 9 }}><span className="mono" style={{ color: 'var(--green)' }}>{ip.code}</span></div>
              {LADDER.map((_, i) => (
                <div key={i} style={{
                  height: 14, borderRadius: 2,
                  background: i === ip.step ? 'var(--green)' : 'var(--border)',
                  opacity: i <= ip.step ? 1 : 0.2,
                }} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
