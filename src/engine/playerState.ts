// Player-focused state mutations (called on Immer drafts from actionResolver).

import {
  calcEtfPayout, etfDiversificationBonus, CONTROL_DIVIDEND_MULTIPLIER, CONTROL_THRESHOLD_IPO, CONTROL_THRESHOLD_REGULAR,
  IPO_BY_CODE, MARGIN_DEFAULT_PENALTY, SALARY, STOCK_BY_CODE, isIpoCode,
} from '../data';
import { money } from '../utils/formatMoney';
import type { GameState } from './types';
import { pushFeeEvent } from './feeLog';
import { queueMarketOpenAuctions } from './auction';
import { diversificationBonus, diversificationTier } from './sector';

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

export function payMarketOpen(s: GameState, pi: number): void {
  const p = s.players[pi];

  // Stock / IPO dividends — Controlling Stake (6+ regular shares or 3+ IPO
  // shares of one code) doubles that code's dividend payout.
  let div = 0;
  const controllingCodes: string[] = [];
  for (const code of Object.keys(p.shares)) {
    const isIpo = isIpoCode(code);
    const printed = isIpo ? (IPO_BY_CODE[code]?.div ?? 0) : (STOCK_BY_CODE[code]?.div ?? 0);
    if (printed <= 0) continue;
    const qty = p.shares[code];
    const threshold = isIpo ? CONTROL_THRESHOLD_IPO : CONTROL_THRESHOLD_REGULAR;
    const controlling = qty >= threshold;
    if (controlling) controllingCodes.push(code);
    div += printed * qty * (controlling ? CONTROL_DIVIDEND_MULTIPLIER : 1);
  }

  // ETF payout (tiered by total funds owned) + Full-Diversification bonus
  // (only paid when the player holds all 4 distinct funds, not just 4 shares
  // of one — this is what actually rewards ETF diversification).
  const etfPay = calcEtfPayout(p.etfShares);
  const etfDiverBonus = etfDiversificationBonus(p.etfShares);

  // Diversification bonus: only the highest tier qualifying is paid (rulebook §14).
  const divTier = diversificationTier(p);
  const diverBonus = diversificationBonus(p);

  const total = SALARY + div + etfPay + etfDiverBonus + diverBonus;
  p.cash += total;
  p.salaryCollected += SALARY;

  const parts: string[] = [`+${money(SALARY)} income`];
  if (div) parts.push(`+${money(div)} dividends`);
  if (etfPay) parts.push(`+${money(etfPay)} ETF payout`);
  if (etfDiverBonus) parts.push(`+${money(etfDiverBonus)} ETF diversification bonus (all 4 funds)`);
  if (diverBonus) parts.push(`+${money(diverBonus)} ${divTier === 'broad' ? 'Broad Market' : 'Diversified'} bonus`);
  if (controllingCodes.length > 0) parts.push(`(control bonus: ${controllingCodes.join(', ')})`);
  addLog(s, `${p.name} Market Open: ${parts.join(' ')}`, 'g');

  if (div + etfPay + etfDiverBonus + diverBonus > 0) {
    s.tradeLog.unshift({ kind: 'dividend', text: `Income +${money(total)}`, amount: total, player: p.name, t: s.lap });
    if (s.tradeLog.length > 60) s.tradeLog.pop();
  }

  // Taxes & Fees: log the income received this pass.
  pushFeeEvent(s, 'income', p, total);

  // Margin call: pay down half the outstanding margin balance. Cash is applied
  // first; any shortfall forces the player to sell stock to cover (+ a flat
  // penalty), handled interactively via the marginCall state.
  if (p.margin > 0) {
    const call = marginCallDue(p.margin);
    const fromCash = Math.min(Math.max(p.cash, 0), call);
    p.cash -= fromCash;
    p.margin -= fromCash;
    const shortfall = call - fromCash;
    if (shortfall > 0) {
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

  // Bank Auctions: after payday, auction any pooled shares of sold-out stocks.
  queueMarketOpenAuctions(s);
}
