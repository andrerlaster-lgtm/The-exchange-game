// The rates bar: Bank Rate, Market Rate, and the spread between them. Sits
// directly above the board (layout A, 2026-09-19) — the numbers that price
// every loan and tilt the market are read before a turn, not hunted for.

import { bankRateBp, feeDebtRatePct, marketRateBp, playerLoanPremiumBp, rateSpreadBp } from '../../engine';
import { useGameState } from '../../store';
import RatesGuide from './RatesGuide';

const pctOf = (bpValue: number) => `${(bpValue / 100).toFixed(2)}%`;

export default function RatesStrip() {
  const s = useGameState();
  const bank = bankRateBp(s);
  const market = marketRateBp(s);
  const spread = rateSpreadBp(s);
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
        s.marketRound ? `${market} bp · last round's move` : `${market} bp · no round closed yet`,
        'var(--text)', true)}
      <div style={{ flex: '1 1 140px', minWidth: 0, paddingLeft: 12, borderLeft: '1px solid rgba(74,48,25,0.12)' }}>
        <div className="slabel" style={{ marginBottom: 2 }}>Spread</div>
        <div className="mono display" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, color: spreadColor }}>
          {spread > 0 ? '+' : ''}{spread} bp
        </div>
        <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>
          Market Rate − Bank Rate: what the market returned last round against what cash costs
        </div>
      </div>
      <div style={{ flexBasis: '100%' }}>
        <RatesGuide />
      </div>
    </div>
  );
}
