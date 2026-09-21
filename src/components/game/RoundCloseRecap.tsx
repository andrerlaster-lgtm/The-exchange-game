import { useGameState } from '../../store';
import { pctBp } from '../../utils/formatMoney';

function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}$${Math.abs(amount).toLocaleString()}`;
}

/** The market's receipt: what the last theme moved, and the selected player's
    exact holding-value result at the instant it closed. */
export default function RoundCloseRecap({ playerIndex, compact = false }: { playerIndex: number; compact?: boolean }) {
  const s = useGameState();
  const recap = s.roundCloseRecap;
  if (!recap) return null;

  const personal = recap.playerImpacts.find((impact) => impact.playerIndex === playerIndex);
  const rises = recap.impacts.filter((impact) => impact.pct > 0);
  const falls = recap.impacts.filter((impact) => impact.pct < 0);
  const amount = personal?.amount ?? 0;
  const tone = amount > 0 ? 'var(--green)' : amount < 0 ? 'var(--red)' : 'var(--muted)';

  if (compact) {
    return (
      <section aria-label="Your Round Close Impact" style={{
        padding: '8px 10px', borderRadius: 8,
        background: 'rgba(212,165,53,0.06)', border: '1px solid rgba(212,165,53,0.24)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: 'var(--muted)' }}>LAST ROUND IMPACT</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>LAP {recap.lap}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 800 }}>{recap.theme}</span>
          <span style={{ color: tone, fontWeight: 900, fontSize: 14 }}>{signedMoney(amount)}</span>
        </div>
        <div style={{ color: 'var(--text)', fontSize: 10, lineHeight: 1.4, marginTop: 3 }}>
          {personal?.helped.length ? `Helped: ${personal.helped.join(', ')}.` : ''}
          {personal?.helped.length && personal?.hurt.length ? ' ' : ''}
          {personal?.hurt.length ? `Hurt: ${personal.hurt.join(', ')}.` : ''}
          {!personal?.helped.length && !personal?.hurt.length ? 'None of your holdings moved with this theme.' : ''}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Round Close Recap" style={{
      padding: '9px 10px', borderRadius: 8,
      background: 'rgba(212,165,53,0.07)', border: '1px solid rgba(212,165,53,0.28)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: 'var(--muted)' }}>ROUND CLOSE RECAP · LAP {recap.lap}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>{recap.theme}</div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{rises.length} up · {falls.length} down</div>
      </div>

      {recap.impacts.length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 10.5, lineHeight: 1.4, marginTop: 6 }}>No public companies were affected by this theme.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
          {recap.impacts.map((impact) => (
            <span key={impact.code} style={{
              borderRadius: 4, padding: '3px 6px', fontSize: 9, fontWeight: 800,
              color: impact.pct > 0 ? '#15803d' : '#b91c1c',
              background: impact.pct > 0 ? 'rgba(34,197,94,0.11)' : 'rgba(239,68,68,0.10)',
            }}>{impact.pct > 0 ? '▲' : '▼'} {impact.code} {pctBp(impact.pct)}</span>
          ))}
        </div>
      )}

      <div style={{ marginTop: 8, paddingTop: 7, borderTop: '1px solid rgba(74,48,25,0.13)' }}>
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.8, color: 'var(--muted)' }}>YOUR PORTFOLIO IMPACT</div>
        <div style={{ color: tone, fontWeight: 900, fontSize: 14, marginTop: 2 }}>{signedMoney(amount)}</div>
        <div style={{ color: 'var(--text)', fontSize: 10, lineHeight: 1.4, marginTop: 2 }}>
          {personal?.helped.length ? `Helped: ${personal.helped.join(', ')}.` : ''}
          {personal?.helped.length && personal?.hurt.length ? ' ' : ''}
          {personal?.hurt.length ? `Hurt: ${personal.hurt.join(', ')}.` : ''}
          {!personal?.helped.length && !personal?.hurt.length ? 'None of your holdings moved with this theme.' : ''}
        </div>
      </div>
    </section>
  );
}
