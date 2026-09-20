// The rates bar: Bank Rate, Market Rate, and the spread between them. Sits
// directly above the board (layout A, 2026-09-19) — the numbers that price
// every loan and tilt the market are read before a turn, not hunted for.

import { bankRateBp, feeDebtRatePct, marketRateBp, playerLoanPremiumBp, rateSpreadBp } from '../../engine';
import { spreadUpChance } from '../../data';
import { useGameState } from '../../store';

const pctOf = (bpValue: number) => `${(bpValue / 100).toFixed(2)}%`;

export default function RatesStrip() {
  const s = useGameState();
  const bank = bankRateBp(s);
  const market = marketRateBp(s);
  const spread = rateSpreadBp(s);
  const up = Math.round(spreadUpChance(spread) * 100);
  const spreadColor = spread > 0 ? 'var(--green)' : spread < 0 ? 'var(--red)' : 'var(--text)';
  const loanLow = (bank + playerLoanPremiumBp(1)) / 100;
  const loanHigh = (bank + playerLoanPremiumBp(6)) / 100;

  const cell = (label: string, value: string, sub: string, color: string, divider: boolean) => (
    <div style={{
      flex: '1 1 140px', minWidth: 0,
      paddingLeft: divider ? 12 : 0,
      borderLeft: divider ? '1px solid rgba(74,48,25,0.12)' : 'none',
    }}>
      <div className="slabel" style={{ marginBottom: 2 }}>{label}</div>
      <div className="mono display" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>{sub}</div>
    </div>
  );

  return (
    <div aria-label="Rates" className="card-box" style={{
      display: 'flex', flexWrap: 'wrap', gap: 12, padding: '11px 14px',
      borderColor: 'rgba(154,111,30,0.42)',
    }}>
      {cell('Bank rate', pctOf(bank),
        `${bank} bp · fees ${feeDebtRatePct(s)}%/turn · loans ${loanLow}–${loanHigh}%`,
        'var(--text)', false)}
      {cell('Market rate', pctOf(market),
        s.opts.marketMeter ? `${market} bp · from the Market Meter` : `${market} bp · Meter off`,
        'var(--text)', true)}
      <div style={{ flex: '1 1 140px', minWidth: 0, paddingLeft: 12, borderLeft: '1px solid rgba(74,48,25,0.12)' }}>
        <div className="slabel" style={{ marginBottom: 2 }}>Spread</div>
        <div className="mono display" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: spreadColor }}>
          {spread > 0 ? '+' : ''}{spread} bp
        </div>
        {s.opts.marketMeter ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
            <span style={{
              position: 'relative', flexGrow: 1, height: 5, borderRadius: 3,
              background: 'rgba(74,48,25,0.14)', overflow: 'hidden',
            }}>
              <span style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${up}%`, background: spreadColor,
              }} />
            </span>
            <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: spreadColor, flexShrink: 0 }}>
              {up}% up
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 2 }}>Market Rate − Bank Rate</div>
        )}
      </div>
    </div>
  );
}
