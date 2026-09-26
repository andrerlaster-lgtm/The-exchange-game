// The decision panel shown when a player lands on an untouched company.
// It is deliberately an investor brief: every figure comes from live game rules.
import type { CSSProperties } from 'react';
import { REGULAR_SUPPLY, SECTORS, STOCK_BY_CODE, stockOpportunityFor, WEAK_DEMAND_THRESHOLD } from '../../data';
import { companyBuyoutCost, priceOf } from '../../engine';
import type { Action, GameState } from '../../engine';
import FedSignalBadge from './FedSignalBadge';

interface Props { code: string; s: GameState; dispatch: (a: Action) => void; weakCount: number; canAct: boolean; }

const RISK_COPY: Record<string, string> = {
  High: 'Larger market swings', Med: 'Balanced market exposure', Low: 'More stable at market close',
};

export default function TradeTicket({ code, s, dispatch, weakCount, canAct }: Props) {
  const stock = STOCK_BY_CODE[code];
  if (!stock) return null;
  const player = s.players[s.cur];
  const sector = SECTORS[stock.sector];
  const price = priceOf(s, code);
  const buyoutCost = companyBuyoutCost(s, code);
  const opportunity = stockOpportunityFor(stock);
  const supply = s.supply[code] ?? 0;
  const canBuy = canAct && supply === REGULAR_SUPPLY && player.cash >= buyoutCost;
  const shortfall = Math.max(0, buyoutCost - player.cash);
  const hasSellableElsewhere = Object.entries(player.shares).some(([otherCode, qty]) => otherCode !== code && (qty ?? 0) > 0);
  const themeDirection = s.marketTheme?.tailwinds.includes(stock.sector) ? 'tailwind' : s.marketTheme?.headwinds.includes(stock.sector) ? 'headwind' : 'neutral';
  const movePct = stock.risk === 'Low' ? '2.5%' : stock.risk === 'High' ? '7.5%' : '5%';
  const themeText = !s.marketTheme
    ? 'No market theme is active.'
    : themeDirection === 'tailwind'
      ? `${s.marketTheme.name} favors ${sector.name}. This company would rise about ${movePct} at round close.`
      : themeDirection === 'headwind'
        ? `${s.marketTheme.name} pressures ${sector.name}. This company would fall about ${movePct} at round close.`
        : `${s.marketTheme.name} does not directly move ${sector.name} this round.`;

  return <section aria-label={`${stock.name} investment opportunity`} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `4px solid ${sector.color}`, boxShadow: 'var(--panel-shadow)', color: 'var(--text)' }}>
    <header style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center', color: '#fff', background: sector.color, fontSize: 20, fontWeight: 900 }}>{sector.glyph}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="slabel">Investment opportunity</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 2 }}><strong style={{ fontSize: 21, letterSpacing: -0.4 }}>{stock.name}</strong><span className="mono" style={{ color: 'var(--accent)', fontWeight: 800 }}>{code}</span></div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{sector.name} · {stock.tier} company · {stock.risk} risk</div>
      </div>
    </header>
    <section style={{ padding: '11px', borderRadius: 9, background: 'var(--bg)', color: '#fff', borderLeft: `4px solid ${sector.color}` }}>
      <div className="slabel" style={{ color: 'rgba(255,255,255,.64)', marginBottom: 8 }}>Investment summary</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><div style={{ color: 'rgba(255,255,255,.68)', fontSize: 10, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase' }}>Share price</div><div className="mono" style={{ fontSize: 23, fontWeight: 900, marginTop: 2 }}>${price.toLocaleString()}</div></div>
        <div style={{ borderLeft: '1px solid rgba(255,255,255,.2)', paddingLeft: 10 }}><div style={{ color: 'rgba(255,255,255,.68)', fontSize: 10, fontWeight: 800, letterSpacing: .7, textTransform: 'uppercase' }}>You receive</div><div className="mono" style={{ fontSize: 23, fontWeight: 900, marginTop: 2 }}>{REGULAR_SUPPLY} shares</div></div>
      </div>
      <div style={{ marginTop: 9, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.16)', display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}><span style={{ color: 'rgba(255,255,255,.68)' }}>Full company cost</span><strong>${buyoutCost.toLocaleString()}</strong></div>
    </section>
    <FedSignalBadge s={s} code={code} />
    <section style={{ padding: '10px 11px', borderRadius: 8, background: 'rgba(74,48,25,0.045)', border: '1px solid var(--border)' }}>
      <div className="slabel" style={{ marginBottom: 5 }}>Why consider it</div>
      <div style={{ fontWeight: 800, fontSize: 13 }}>{opportunity.title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8, fontSize: 11 }}>
        <div><span style={{ color: 'var(--muted)' }}>Market Open income</span><br /><strong>+${opportunity.dividendPerLap.toLocaleString()}</strong></div>
        <div><span style={{ color: 'var(--muted)' }}>Payout Claim as controller</span><br /><strong>up to ${opportunity.sectorPayout.toLocaleString()}</strong></div>
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 7 }}>{RISK_COPY[stock.risk]}</div>
    </section>
    <section style={{ padding: '10px 11px', borderRadius: 8, background: themeDirection === 'tailwind' ? 'var(--green-dim)' : themeDirection === 'headwind' ? 'var(--red-dim)' : 'rgba(74,48,25,0.045)', border: `1px solid ${themeDirection === 'tailwind' ? 'rgba(34,197,94,.24)' : themeDirection === 'headwind' ? 'rgba(239,68,68,.24)' : 'var(--border)'}` }}>
      <div className="slabel" style={{ marginBottom: 4 }}>This round’s market outlook</div><div style={{ fontSize: 11, lineHeight: 1.4 }}>{themeText}</div>
    </section>
    {shortfall > 0 && <div style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--red)' }}>You need ${shortfall.toLocaleString()} more cash. {hasSellableElsewhere ? 'You can sell another holding in the Trading Market before making this choice.' : 'This company is not affordable yet.'}</div>}
    {weakCount > 0 && <div style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--red)' }}>Weak Demand: {weakCount}/{WEAK_DEMAND_THRESHOLD}. Skipping again will lower this company’s price.</div>}
    <button style={primaryButton(canBuy)} disabled={!canBuy} onClick={() => dispatch({ t: 'buy', code })}>Buy company · ${buyoutCost.toLocaleString()}</button>
    <button style={{ background: 'transparent', color: 'var(--muted)', border: 'none', padding: '2px', cursor: 'pointer', fontSize: 12 }} onClick={() => dispatch({ t: 'skipStock', code })}>Skip for now</button>
  </section>;
}

function primaryButton(enabled: boolean): CSSProperties {
  return { width: '100%', padding: '11px 10px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 800, cursor: enabled ? 'pointer' : 'not-allowed', opacity: enabled ? 1 : .45, fontSize: 13 };
}
