import { IPO_BY_CODE, LADDER } from '../../data';
import { useDispatch, useGameState } from '../../store';

export default function IpoPanel() {
  const s = useGameState();
  const dispatch = useDispatch();
  if (!s.ipoChoice && !s.ipoListPick && !s.ipoBuy) return null;

  return (
    <div className="card-box" style={{ borderColor: 'var(--green)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--green)' }}>IPO Market</div>

      {s.ipoListPick && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Select a listed IPO (up to 2 shares):</div>
          {s.ipos.filter((ip) => ip.revealed && ip.supply > 0).map((ip) => {
            const def = IPO_BY_CODE[ip.code];
            const price = LADDER[ip.step];
            return (
              <div key={ip.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span className="mono" style={{ color: 'var(--accent)' }}>{ip.code}</span>
                <span className="muted" style={{ flex: 1 }}>{def.name}</span>
                <span className="mono">${price.toLocaleString()}</span>
                <span className="muted">supply:{ip.supply}</span>
                <button style={{ fontSize: 11 }} onClick={() => dispatch({ t: 'pickKnownIpo', code: ip.code })}>Select</button>
              </div>
            );
          })}
          <button onClick={() => dispatch({ t: 'skipIpo' })}>Skip</button>
        </div>
      )}

      {s.ipoBuy && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {s.ipoReveal && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px', borderRadius: 6,
              background: `${s.players[s.ipoBuy.actor].color}18`,
              border: `1px solid ${s.players[s.ipoBuy.actor].color}55`,
            }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                background: s.players[s.ipoBuy.actor].color,
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: s.players[s.ipoBuy.actor].color }}>
                {s.players[s.ipoBuy.actor].name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {s.ipoBuy.actor === s.cur ? '— first option' : "'s turn to buy in"}
              </span>
            </div>
          )}
          <div style={{ fontSize: 12 }}>
            Buying <strong>{s.ipoBuy.code}</strong> @ ${s.ipoBuy.price.toLocaleString()} · {s.ipoBuy.bought}/{s.ipoBuy.max} purchased
          </div>
          {(() => {
            const actor = s.players[s.ipoBuy.actor];
            const atMax = s.ipoBuy.bought >= s.ipoBuy.max;
            const supplyOut = (s.ipos.find((ip) => ip.code === s.ipoBuy!.code)?.supply ?? 0) <= 0;
            const cantAfford = actor.cash < s.ipoBuy.price;
            const disabled = atMax || supplyOut || cantAfford;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button disabled={disabled} onClick={() => dispatch({ t: 'ipoBuyShare' })}>
                    Buy 1 Share
                  </button>
                  <button onClick={() => dispatch({ t: 'ipoBuyDone' })}>Done</button>
                </div>
                {!atMax && (cantAfford || supplyOut) && (
                  <div style={{ fontSize: 10, color: 'var(--red)' }}>
                    {supplyOut
                      ? 'No shares left in this listing.'
                      : `${actor.name} needs $${(s.ipoBuy.price - actor.cash).toLocaleString()} more — press Done to pass.`}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
