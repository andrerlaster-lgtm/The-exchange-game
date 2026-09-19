// Bank Rate, Market Rate, and spread — the engine side of data/rates.ts.

import {
  BANK_RATE_MAX_BP, BANK_RATE_MIN_BP, BANK_RATE_START_BP, COMPANY_LOAN_SPREAD_BP, FEE_DEBT_SPREAD_BP,
  MARKET_RATE_NEUTRAL_BP, MARKET_RATE_PER_METER_BP, PLAYER_LOAN_PREMIUM_BY_ROLL_BP, spreadUpChance,
} from '../data';
import type { Rng } from '../utils/rng';
import type { GameState } from './types';
import { marketConditionWaivesLoanPremium } from './marketConditions';

/** The current Bank Rate in bp. Saves from before the rate existed read as the
    starting rate. */
export function bankRateBp(s: GameState): number {
  return s.bankRateBp ?? BANK_RATE_START_BP;
}

/** The Market Rate in bp, read from the Market Meter needle. With the meter
    off it sits at neutral. */
export function marketRateBp(s: GameState): number {
  return MARKET_RATE_NEUTRAL_BP + (s.opts.marketMeter ? s.meter : 0) * MARKET_RATE_PER_METER_BP;
}

/** Market Rate − Bank Rate. */
export function rateSpreadBp(s: GameState): number {
  return marketRateBp(s) - bankRateBp(s);
}

/** Move the Bank Rate by `bp`, held between its floor and ceiling. Returns the
    change that actually happened. */
export function changeBankRate(s: GameState, bp: number): number {
  const before = bankRateBp(s);
  const after = Math.min(BANK_RATE_MAX_BP, Math.max(BANK_RATE_MIN_BP, before + bp));
  s.bankRateBp = after;
  return after - before;
}

/** Per-turn interest, as a percent, on Outstanding Fees. */
export function feeDebtRatePct(s: GameState): number {
  return (bankRateBp(s) + FEE_DEBT_SPREAD_BP) / 100;
}

/** Per-turn interest, as a percent, on an emergency company loan. */
export function companyLoanRatePct(s: GameState): number {
  return (bankRateBp(s) + COMPANY_LOAN_SPREAD_BP) / 100;
}

/** Per-turn interest, as a percent, on Margin. */
export function marginRatePct(s: GameState): number {
  return bankRateBp(s) / 100;
}

/** Premium, in bp, a creditor's d6 roll adds over the Bank Rate. */
export function playerLoanPremiumBp(roll: number): number {
  return PLAYER_LOAN_PREMIUM_BY_ROLL_BP[Math.min(6, Math.max(1, roll))];
}

/** Direction of an undirected (Neutral-zone) market move: the spread tilts
    the odds toward up when stocks beat cash, toward down when cash wins. Uses
    one random draw, the same as the coin flip it replaces. */
export function spreadDirection(s: GameState, rng: Rng): 1 | -1 {
  return rng.next() < spreadUpChance(rateSpreadBp(s)) ? 1 : -1;
}

/** How the next Player Loan to `debtorIdx` will be priced, for the roll
    prompt: the Bank Rate plus a rolled premium, or the bare Bank Rate under
    the debtor's own Credit Tightening. */
export function playerLoanRateText(s: GameState, debtorIdx: number): string {
  const base = bankRateBp(s);
  if (marketConditionWaivesLoanPremium(s, debtorIdx)) {
    return `Credit Tightening waives the premium: the rate is the Bank Rate, ${base / 100}% per turn.`;
  }
  const lo = (base + playerLoanPremiumBp(1)) / 100;
  const hi = (base + playerLoanPremiumBp(6)) / 100;
  return `The rate is the Bank Rate (${base / 100}%) plus a premium you roll on a d6 — 1-2: +${playerLoanPremiumBp(1) / 100}%, 3-4: +${playerLoanPremiumBp(3) / 100}%, 5-6: +${playerLoanPremiumBp(5) / 100}% — so ${lo}-${hi}% per turn, fixed for the life of the loan.`;
}
