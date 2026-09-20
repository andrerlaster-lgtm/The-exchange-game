// "How rates work" — the one place in the game that shows the arithmetic
// behind the Bank Rate, the Market Rate, and every loan, with the table's own
// live numbers filled in. Opened from the rates bar above the board, so a
// question at the table can be answered without leaving the game.
//
// Every figure here is read from the same constants and helpers the engine
// uses (data/rates.ts, engine/rates.ts, the Fed deck), so the guide cannot
// drift away from the rules it explains.

import {
  BANK_RATE_MAX_BP, BANK_RATE_MIN_BP, COMPANY_LOAN_SPREAD_BP, FED_CARDS, FEE_DEBT_SPREAD_BP,
  METER_RATE_NUDGE_BP, PLAYER_LOAN_PREMIUM_BY_ROLL_BP, RATE_DECISION_BY_ROLL_BP,
  RATE_NUDGE_EVERY_N_ROUNDS, RATE_SENSITIVITY_BY_RISK, RATE_SENSITIVITY_BY_SECTOR,
  ROUND_MARKET_BP, SECTORS, applyBasisPoints, rateShockMoves,
} from '../../data';
import {
  bankRateBp, companyLoanRatePct, feeDebtRatePct, marginRatePct, marketRateBp,
  playerLoanPremiumBp, rateSpreadBp,
} from '../../engine';
import { money, moveSize } from '../../utils/formatMoney';
import { useGameState } from '../../store';

const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;
const signed = (bp: number) => `${bp > 0 ? '+' : bp < 0 ? '−' : ''}${Math.abs(bp)} bp`;
/** ×10 / ×−10, with a real minus sign rather than a hyphen. */
const times = (k: number) => `×${k < 0 ? '−' : ''}${Math.abs(k)}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="slabel" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 10.5, color: 'var(--text)', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 10,
      padding: '4px 0', borderTop: '1px solid rgba(74,48,25,0.08)',
    }}>
      <span>{left}</span>
      <span className="mono" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{right}</span>
    </div>
  );
}

export default function RatesGuide() {
  const s = useGameState();
  const bank = bankRateBp(s);
  const market = marketRateBp(s);
  const spread = rateSpreadBp(s);

  // The Fed cards that move the rate, biggest move first.
  const rateCards = FED_CARDS.filter((c) => c.rateBp)
    .sort((a, b) => Math.abs(b.rateBp!) - Math.abs(a.rateBp!));

  // A worked example of a rate shock, using a real Finance company's price.
  const financeSensitivity = RATE_SENSITIVITY_BY_SECTOR.finance ?? 0;
  const exampleRateBp = 50;
  const examplePrice = 1_000;
  const exampleMoves = rateShockMoves(exampleRateBp);

  return (
    <details style={{
      marginTop: 10, borderRadius: 8,
      background: 'rgba(154,111,30,0.05)', border: '1px solid rgba(154,111,30,0.2)',
    }}>
      <summary style={{
        cursor: 'pointer', padding: '8px 10px', color: 'var(--text)',
        fontSize: 10.5, fontWeight: 900, letterSpacing: 0.65,
      }}>
        HOW RATES WORK · OPEN GUIDE
      </summary>
      <div style={{ padding: '0 12px 12px' }}>
        <p style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.5, margin: '0 0 2px' }}>
          Rates are quoted in basis points: <strong>100 bp = 1%</strong>, per player turn. Everything below is
          live — it shows this table's own numbers right now.
        </p>

        <Section title="The Bank Rate">
          <Row left="Right now" right={`${pct(bank)} (${bank} bp)`} />
          <Row left="Always between" right={`${pct(BANK_RATE_MIN_BP)} and ${pct(BANK_RATE_MAX_BP)}`} />
          <div style={{ marginTop: 6, color: 'var(--muted)' }}>Three things move it:</div>
          {rateCards.map((card) => (
            <Row key={card.title} left={`Fed card · ${card.title}`} right={signed(card.rateBp!)} />
          ))}
          <Row
            left="Rate Decision space (28) · roll a d6"
            right={`1–2 ${signed(RATE_DECISION_BY_ROLL_BP[1])} · 3–4 hold · 5–6 ${signed(RATE_DECISION_BY_ROLL_BP[5])}`}
          />
          <Row
            left={`Round-end marker · every ${RATE_NUDGE_EVERY_N_ROUNDS === 2 ? 'other round' : `${RATE_NUDGE_EVERY_N_ROUNDS} rounds`}`}
            right={`Bullish ${signed(METER_RATE_NUDGE_BP)} · Bearish ${signed(-METER_RATE_NUDGE_BP)}`}
          />
        </Section>

        <Section title="What borrowing costs, per turn">
          <Row left={`Outstanding Fees — Bank Rate + ${FEE_DEBT_SPREAD_BP} bp`} right={`${feeDebtRatePct(s)}%`} />
          <Row left="Margin — the Bank Rate itself" right={`${marginRatePct(s)}%`} />
          <Row left={`Company loan — Bank Rate + ${COMPANY_LOAN_SPREAD_BP} bp`} right={`${companyLoanRatePct(s)}%`} />
          <Row
            left="Player loan — Bank Rate + the lender's rolled premium"
            right={`${(bank + playerLoanPremiumBp(1)) / 100}%–${(bank + playerLoanPremiumBp(6)) / 100}%`}
          />
          <div style={{ marginTop: 5, color: 'var(--muted)' }}>
            The lender rolls a d6 for that premium: 1–2 adds {PLAYER_LOAN_PREMIUM_BY_ROLL_BP[1] / 100}%,
            3–4 adds {PLAYER_LOAN_PREMIUM_BY_ROLL_BP[3] / 100}%, 5–6 adds {PLAYER_LOAN_PREMIUM_BY_ROLL_BP[5] / 100}%.
            A player loan keeps the rate it was made at; the others follow the Bank Rate as it changes.
            Interest is added at the start of the debtor&rsquo;s turn and compounds on the balance.
          </div>
        </Section>

        <Section title="How a rate change moves prices">
          <div style={{ color: 'var(--muted)', marginBottom: 4 }}>
            Ten basis points of price per 1 bp of rate. Only these groups react; everything else ignores the Fed.
          </div>
          <Row left={`${SECTORS.finance.name} — moves with the rate`} right={times(financeSensitivity)} />
          <Row left={`${SECTORS.realestate.name} — moves against it`} right={times(RATE_SENSITIVITY_BY_SECTOR.realestate ?? 0)} />
          <Row left="High-Risk companies — move against it" right={times(RATE_SENSITIVITY_BY_RISK.High ?? 0)} />
          <div style={{ marginTop: 6 }}>
            <strong>Worked example.</strong> A Rate Hike is {signed(exampleRateBp)}, so{' '}
            {exampleMoves.map((m) => `${m.sec ? SECTORS[m.sec].name : 'High-Risk'} ${signed(m.bp)}`).join(', ')}.
            A {SECTORS.finance.name} company at {money(examplePrice)} becomes{' '}
            {money(applyBasisPoints(examplePrice, exampleRateBp * financeSensitivity))} — {moveSize(exampleRateBp * financeSensitivity)},
            rounded to the $25 grid.
          </div>
          <div style={{ marginTop: 5, color: 'var(--muted)' }}>
            At the {pct(BANK_RATE_MIN_BP)} floor or {pct(BANK_RATE_MAX_BP)} ceiling the rate moves only as far as it
            can, and the price moves shrink to match. The round-end nudge never moves prices.
          </div>
        </Section>

        <Section title="The Market Rate and the spread">
          <Row left="Market Rate — 3% plus the round's move" right={pct(market)} />
          <Row left="Spread — Market Rate − Bank Rate" right={signed(spread)} />
          <div style={{ marginTop: 5, color: 'var(--muted)' }}>
            A round closes Bullish or Bearish and one sector moves{' '}
            {ROUND_MARKET_BP.map((bp) => moveSize(bp)).join(', ')}; the Market Rate is 3% plus that move on a
            Bullish round, minus it on a Bearish one. The spread is a read on the game — the market beat cash
            last round when it is positive — not a rule: the round-end direction is always an even coin flip.
          </div>
        </Section>
      </div>
    </details>
  );
}
