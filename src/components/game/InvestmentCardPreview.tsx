// Local preview surface for reviewing the fund and IPO offer layouts without
// needing to wait for a board landing. It is only shown by ?preview=cards.
import { ETF_BY_CODE, ETF_PRICE, IPO_BY_CODE, IPO_FIXED_PRICE } from '../../data';
import { IpoCard } from '../cards/IpoPanel';

export default function InvestmentCardPreview() {
  const fund = ETF_BY_CODE.GRW;
  const ipo = IPO_BY_CODE.NDRV;

  return <div style={{ position: 'fixed', inset: 0, zIndex: 400, overflowY: 'auto', padding: '28px 12px', background: 'rgba(20,14,8,.82)' }}>
    <main style={{ width: 'min(440px, 100%)', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header className="card-box" style={{ textAlign: 'center' }}>
        <div className="slabel" style={{ textAlign: 'left' }}>Preview mode</div>
        <strong style={{ fontSize: 19 }}>Investment purchase cards</strong>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 5 }}>These are the cards players see when they land on a Fund or IPO space.</div>
      </header>

      <section aria-label={`${fund.name} fund opportunity`} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `4px solid ${fund.color}`, boxShadow: 'var(--panel-shadow)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 42, height: 42, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, background: fund.color, color: '#fff', fontSize: 20, fontWeight: 900 }}>{fund.glyph}</div><div><div className="slabel">Fund investment opportunity</div><strong style={{ display: 'block', fontSize: 21, marginTop: 2 }}>{fund.name}</strong><span className="mono" style={{ color: fund.color, fontWeight: 800, fontSize: 12 }}>{fund.code} · fixed-price fund</span></div></header>
        <section style={{ padding: 11, borderRadius: 9, background: 'var(--bg)', color: '#fff', borderLeft: `4px solid ${fund.color}` }}><div className="slabel" style={{ color: 'rgba(255,255,255,.64)', marginBottom: 8 }}>Investment summary</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><div><div style={{ color: 'rgba(255,255,255,.68)', fontSize: 10, fontWeight: 800, letterSpacing: .7 }}>PRICE PER SHARE</div><div className="mono" style={{ fontSize: 23, fontWeight: 900, marginTop: 2 }}>${ETF_PRICE.toLocaleString()}</div></div><div style={{ paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,.2)' }}><div style={{ color: 'rgba(255,255,255,.68)', fontSize: 10, fontWeight: 800, letterSpacing: .7 }}>YOU OWN AFTER BUY</div><div className="mono" style={{ fontSize: 23, fontWeight: 900, marginTop: 2 }}>1 share</div></div></div></section>
        <section style={{ padding: '10px 11px', borderRadius: 8, background: 'rgba(74,48,25,.045)', border: '1px solid var(--border)' }}><div className="slabel" style={{ marginBottom: 7 }}>What this purchase does</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}><div><span style={{ color: 'var(--muted)' }}>Adds at Market Open</span><br /><strong style={{ color: 'var(--green)' }}>+$250</strong></div><div><span style={{ color: 'var(--muted)' }}>Fund income after buy</span><br /><strong style={{ color: 'var(--green)' }}>+$250/open</strong></div></div><div style={{ color: 'var(--muted)', fontSize: 10, lineHeight: 1.4, marginTop: 8 }}>Fixed price: market themes and stock swings do not change this fund’s value. It cannot be sold or force-sold.</div></section>
        <button disabled style={{ width: '100%', padding: '11px 10px', borderRadius: 8, border: 'none', background: fund.color, color: '#fff', fontWeight: 800, fontSize: 13, opacity: .7 }}>Buy 1 fund share · $3,000</button>
      </section>

      <section className="ipo-market" style={{ position: 'static', transform: 'none', width: '100%', maxHeight: 'none', padding: 14 }}>
        <div className="ipo-market__heading"><span>IPO purchase card</span><small>Example offering</small></div>
        <IpoCard def={ipo} price={IPO_FIXED_PRICE} supply={5} pctDiff={0}>
          <button className="ipo-card__primary" disabled>Buy entire offering · ${Number(IPO_FIXED_PRICE * 5).toLocaleString()}</button>
          <button className="ipo-card__done" disabled>Skip for now</button>
        </IpoCard>
      </section>

      <a href="/" style={{ alignSelf: 'center', color: '#fff', fontSize: 13, paddingBottom: 12 }}>Back to the game</a>
    </main>
  </div>;
}
