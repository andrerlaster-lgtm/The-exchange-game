// Player-focused state mutations (called on Immer drafts from actionResolver).

import {
  calcEtfPayout, distinctEtfFunds, etfDiversificationBonus, CONTROL_DIVIDEND_MULTIPLIER, CONTROL_THRESHOLD_IPO, CONTROL_THRESHOLD_REGULAR,
  IPO_BY_CODE, MARGIN_DEFAULT_PENALTY, RECOVERY_BONUS, RECOVERY_BONUS_THRESHOLD, SALARY, STOCK_BY_CODE, isIpoCode,
} from '../data';
import { money } from '../utils/formatMoney';
import { developmentMarketOpenBonus } from './development';
import type { GameState, MarketOpenIncome } from './types';
import { pushFeeEvent } from './feeLog';
import { diversificationBonus, diversificationTier } from './sector';
import { marketConditionIncome } from './marketConditions';

function addLog(s: GameState, text: string, kind: 'g' | 'r' | 'y' | 'b' | 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

/**
 * Margin call due each Market Open: half of the outstanding balance, rounded to
 * the nearest $100. Tiny remainders (≤ $100) are cleared in full to avoid dust.
 */
export function marginCallDue(balance: number): number {
  if (balance <= 0) return 0;
  let call = Math.round(balance / 2 / 100) * 100;
  if (call < 100) call = balance;
  if (balance - call <= 100) call = balance;
  return Math.min(call, balance);
}

/** Stock and IPO dividends due for one player, excluding salary/ETF/portfolio bonuses. */
export function dividendPayment(s: GameState, pi: number): { amount: number; controllingCodes: string[]; cutCodes: string[] } {
  const p = s.players[pi];
  let amount = 0;
  const controllingCodes: string[] = [];
  const cutCodes: string[] = [];
  for (const code of Object.keys(p.shares)) {
    const isIpo = isIpoCode(code);
    const printed = isIpo ? (IPO_BY_CODE[code]?.div ?? 0) : (STOCK_BY_CODE[code]?.div ?? 0);
    if (printed <= 0) continue;
    const qty = p.shares[code];
    const threshold = isIpo ? CONTROL_THRESHOLD_IPO : CONTROL_THRESHOLD_REGULAR;
    const controlling = qty >= threshold;
    if (controlling) controllingCodes.push(code);
    // The 1.5x control multiplier does not always land on a whole dollar
    // (e.g. 15/share x 1 share x 1.5 = 22.5) — round each holding's own
    // gross payment before any further adjustment (like a dividend cut),
    // so a fractional cent never hides inside an otherwise-whole-looking sum.
    const gross = controlling ? Math.round(printed * qty * CONTROL_DIVIDEND_MULTIPLIER) : printed * qty;
    const cut = (p.dividendCuts[code] ?? 0) > 0;
    amount += cut ? Math.floor(gross / 2) : gross;
    if (cut) cutCodes.push(code);
  }
  return { amount, controllingCodes, cutCodes };
}

export function payMarketOpen(s: GameState, pi: number, landedExactly = false): MarketOpenIncome {
  const p = s.players[pi];

  // Stock / IPO dividends — Controlling Stake (6+ regular shares or 3+ IPO
  // shares of one code) doubles that code's dividend payout.
  const { amount: div, controllingCodes, cutCodes } = dividendPayment(s, pi);
  cutCodes.forEach((code) => { delete p.dividendCuts[code]; });

  // ETF payout (tiered by total funds owned) + Full-Diversification bonus
  // (only paid when the player holds all 4 distinct funds, not just 4 shares
  // of one — this is what actually rewards ETF diversification).
  const etfPay = calcEtfPayout(p.etfShares);
  const etfDiverBonus = etfDiversificationBonus(p.etfShares);
  const conditionIncome = marketConditionIncome(s, pi);

  // Diversification bonus: only the highest tier qualifying is paid (rulebook §14).
  const divTier = diversificationTier(p);
  const diverBonus = diversificationBonus(p);

  // Landing exactly on Market Open (rather than merely passing over it)
  // doubles salary — the classic "land on Go" bonus.
  const salary = landedExactly ? SALARY * 2 : SALARY;

  // Recovery Bonus: checked against cash BEFORE this payout, so it reads as
  // "were you still down here walking in," not "would this payout alone
  // have covered it" — a player already sitting at $2,900 qualifies even if
  // salary would have carried them past the threshold on its own.
  const qualifiesForRecovery = p.cash < RECOVERY_BONUS_THRESHOLD;
  const recoveryBonus = qualifiesForRecovery ? RECOVERY_BONUS : 0;

  // Company development: a flat per-company bonus for companies this player
  // upgraded — deliberately outside the dividend calculation, so the Controller
  // multiplier, price performance, and Market Conditions never scale it.
  const development = developmentMarketOpenBonus(s, pi);
  const developmentBonus = development.total;

  const total = salary + div + etfPay + etfDiverBonus + diverBonus + conditionIncome.dividend + conditionIncome.etf + recoveryBonus + developmentBonus;
  p.cash += total;
  p.salaryCollected += salary;

  // Captured now, before this pass's ensureMarketCondition (called later, in
  // applyMove) can replace or expire it — this is the condition that
  // actually produced conditionIncome above, not whatever's active next.
  const conditionTitle = (conditionIncome.dividend || conditionIncome.etf) ? (s.marketConditions[pi]?.title ?? null) : null;

  const parts: string[] = [`+${money(salary)} income${landedExactly ? ' (landed exactly — double salary)' : ''}`];
  if (div) parts.push(`+${money(div)} dividends`);
  if (etfPay) parts.push(`+${money(etfPay)} ETF payout`);
  if (etfDiverBonus) parts.push(`+${money(etfDiverBonus)} ETF diversification bonus (${distinctEtfFunds(p.etfShares)} funds)`);
  if (conditionIncome.dividend) parts.push(`+${money(conditionIncome.dividend)} Dividend Windfall`);
  if (conditionIncome.etf) parts.push(`+${money(conditionIncome.etf)} ETF Inflows`);
  if (diverBonus) parts.push(`+${money(diverBonus)} ${divTier === 'broad' ? 'Broad Market' : 'Diversified'} bonus`);
  if (recoveryBonus) parts.push(`+${money(recoveryBonus)} Recovery Bonus (cash was under ${money(RECOVERY_BONUS_THRESHOLD)})`);
  if (developmentBonus) parts.push(`+${money(developmentBonus)} company development (${development.codes.join(', ')})`);
  if (controllingCodes.length > 0) parts.push(`(control bonus: ${controllingCodes.join(', ')})`);
  addLog(s, `${p.name} Market Open: ${parts.join(' ')}`, 'g');

  if (div + etfPay + etfDiverBonus + diverBonus + recoveryBonus + developmentBonus > 0) {
    s.tradeLog.unshift({ kind: 'dividend', text: `Income +${money(total)}`, amount: total, player: p.name, t: s.lap });
    if (s.tradeLog.length > 60) s.tradeLog.pop();
  }

  // Taxes & Fees: log the income received this pass.
  pushFeeEvent(s, 'income', p, total);

  // Margin call: pay down half the outstanding margin balance. Cash is applied
  // first; any shortfall forces the player to sell stock to cover (+ a flat
  // penalty), handled interactively via the marginCall state.
  let marginPaid = 0;
  let marginShortfall = 0;
  if (p.margin > 0) {
    const call = marginCallDue(p.margin);
    const fromCash = Math.min(Math.max(p.cash, 0), call);
    p.cash -= fromCash;
    p.margin -= fromCash;
    marginPaid = fromCash;
    const shortfall = call - fromCash;
    if (shortfall > 0) {
      marginShortfall = shortfall;
      s.marginCall = { player: pi, owed: shortfall };
      addLog(s, `${p.name} MARGIN CALL — short ${money(shortfall)}. Sell stock to cover (+${money(MARGIN_DEFAULT_PENALTY)} penalty).`, 'r');
      // Log the immediate cash portion now; the forced-sale remainder (+ penalty)
      // is logged separately once payMarginCall resolves it.
      if (fromCash > 0) pushFeeEvent(s, 'marginCall', p, -fromCash);
    } else {
      addLog(s, `${p.name} margin call: paid ${money(call)} (balance ${money(p.margin)})`, 'y');
      s.tradeLog.unshift({ kind: 'repay', text: `Margin call −${money(call)}`, amount: -call, player: p.name, t: s.lap });
      if (s.tradeLog.length > 60) s.tradeLog.pop();
      pushFeeEvent(s, 'marginCall', p, -call);
    }
  }

  // Market Open is payday only: dividends, ETF payout, salary, and any margin
  // call. It does NOT force a Market Event draw — those are triggered solely by
  // landing on space 19 (the Market Event space).

  return {
    salary, landedExactly, dividends: div, controllingCodes,
    etfPayout: etfPay, etfDiversificationBonus: etfDiverBonus,
    conditionDividend: conditionIncome.dividend, conditionEtf: conditionIncome.etf, conditionTitle,
    diversificationBonus: diverBonus, diversificationTier: divTier === 'none' ? null : divTier,
    recoveryBonus, developmentBonus, total,
    marginPaid, marginShortfall, marginBalanceAfter: p.margin,
  };
}

/** Immediate dividend-only payout from the Dividend Payment Market Event card. */
export function payDividendCard(s: GameState, pi: number): void {
  const p = s.players[pi];
  const { amount, controllingCodes, cutCodes } = dividendPayment(s, pi);
  cutCodes.forEach((code) => { delete p.dividendCuts[code]; });
  if (amount <= 0) {
    addLog(s, `${p.name} draws Dividend Payment but has no dividend-paying holdings.`, 'y');
    return;
  }
  p.cash += amount;
  addLog(s, `${p.name} receives ${money(amount)} in Dividend Payment${controllingCodes.length ? ` (control bonus: ${controllingCodes.join(', ')})` : ''}.`, 'g');
  s.tradeLog.unshift({ kind: 'dividend', text: `Dividend Payment +${money(amount)}`, amount, player: p.name, t: s.lap });
  if (s.tradeLog.length > 60) s.tradeLog.pop();
  pushFeeEvent(s, 'income', p, amount);
}
