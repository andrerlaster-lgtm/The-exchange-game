// Rule-checking functions: pure reads used to gate actions and compute payouts.

import {
  IPO_BY_CODE, IPO_INDEX, PRICE_FLOOR, REGULAR_SUPPLY, SELL_BACK_HAIRCUT_BP,
  STOCK_BY_CODE, applyBasisPoints, isIpoCode,
} from '../data';
import type { GameState, IpoState } from './types';
import { marketConditionBuyoutDiscount } from './marketConditions';

/** Keep a price on the right side of the floor. There is no hard ceiling —
    see CEILING_TRIGGER in data/priceModel.ts. */
export function clampPrice(x: number): number {
  return Math.max(PRICE_FLOOR, x);
}

/** Resolved IpoState for an IPO code. */
export function ipoOf(s: GameState, code: string): IpoState {
  return s.ipos[IPO_INDEX[code]];
}

/** Current dollar price for any tradable code (regular or IPO). */
export function priceOf(s: GameState, code: string): number {
  return isIpoCode(code) ? ipoOf(s, code).price : s.prices[code];
}

/** Bank sell-back price (rulebook §11): the seller receives the current market
    price less the standard bank haircut, never below the $100 floor. */
export function sellBackPrice(s: GameState, code: string): number {
  return applyBasisPoints(priceOf(s, code), -SELL_BACK_HAIRCUT_BP);
}

/** Whether a company still has room to fall. Replaces the old `step > 0`
    check; a company sitting on the $100 floor cannot absorb a decline, so
    cards that need a falling target must skip it. */
export function canFall(s: GameState, code: string): boolean {
  return priceOf(s, code) > PRICE_FLOOR;
}

/** Whether a company has room to rise. Always true — the redesign removed the
    hard ceiling, leaving $5,000 as a Market Event trigger only. Kept as a
    named predicate so the card-targeting code still reads symmetrically and
    so reintroducing a cap later is a one-line change. */
export function canRise(_s: GameState, _code: string): boolean {
  return true;
}

/**
 * Whole-company acquisition cost (landing buy-out, Opening Bell): the full
 * REGULAR_SUPPLY block priced at the company's CURRENT ladder price, not its
 * fixed starting tier price. 2026-08-23 fix — the tier price used to be
 * static regardless of price movement, so buying a company whose price had
 * fallen since it opened booked an immediate unrealized loss the instant you
 * bought it (cost basis = static tier price > market value = current price ×
 * 11), even though nothing had happened yet while actually holding it. Tying
 * the cost to the live price keeps every acquisition path in the game
 * consistent: cost basis always equals market value at the moment of
 * purchase, and Gain/Loss only moves from price changes while you hold.
 */
export function companyBuyoutCost(s: GameState, code: string): number {
  // The buyer is always the currently active player (a landing, an Opening
  // Bell resolution, or a UI price preview — every caller means "what would
  // it cost ME, right now"), so the Weak Demand Bargains discount check is
  // scoped to s.cur rather than threading a player index through every call
  // site (several are display-only previews in the UI layer).
  return marketConditionBuyoutDiscount(s, s.cur, code, REGULAR_SUPPLY * priceOf(s, code));
}

/** Candidate codes affected by market events: all regular stocks + revealed IPOs. */
export function eventPool(s: GameState): Array<{ code: string; sec: string }> {
  const arr = Object.keys(STOCK_BY_CODE).map((code) => ({
    code, sec: STOCK_BY_CODE[code].sector as string,
  }));
  for (const ip of s.ipos) {
    if (ip.revealed) arr.push({ code: ip.code, sec: IPO_BY_CODE[ip.code].sector });
  }
  return arr;
}

/** Whether the current player can trade right now. */
export function canTradeNow(s: GameState): boolean {
  const t = s.trade;
  if (!t) return false;
  if (t.actionsLeft <= 0) return false;
  return true;
}

/**
 * Whether the current player may sell owned stock back to the bank from the
 * Trading Market right now — i.e. it's their turn, they've rolled, and nothing
 * else demands attention. Unlike {@link canTradeNow} this does NOT require having
 * landed on a stock space. The per-company half-holding allowance is enforced by
 * the sell action.
 */
export function canMarketSell(s: GameState): boolean {
  return s.turnPhase === 'acted' && !blocked(s);
}

/** Maximum shares of one company the current player may sell to the bank this
    turn. The allowance is half the holding at the start of the sale cycle,
    rounded down. Adding shares later can increase that allowance. */
export function bankSellLimit(s: GameState, code: string): number {
  const owned = s.players[s.cur]?.shares[code] ?? 0;
  const alreadySold = s.bankSoldThisTurn[code] ?? 0;
  return Math.floor((owned + alreadySold) / 2);
}

/** Remaining bank-sale allowance for one company during the current turn. */
export function bankSellRemaining(s: GameState, code: string): number {
  const alreadySold = s.bankSoldThisTurn[code] ?? 0;
  return Math.max(0, bankSellLimit(s, code) - alreadySold);
}

/** Whether End Turn is blocked by an unresolved required action. */
export function blocked(s: GameState): boolean {
  if (s.rolling) return true;
  if (s.turnPhase === 'preRoll') return true;
  if (s.marginCall) return true;
  if (s.insolvency) return true; // forced-sale payment shortfall must be resolved first
  if (s.payoutShortfallChoice) return true; // debtor must choose force-sell or negotiate a loan
  if (s.loanRatePrompt) return true; // creditor must pick the loan's 1-5% rate
  if (s.regimeRollPrompt) return true; // Market Swing landing must roll for Bull/Bear before ending the turn
  if (s.landingNotice) return true; // cardless financial result must be acknowledged
  if (s.auction) return true; // Bank Auction variant — bidding must resolve before ending the turn
  if (s.pendingDraws.length > 0) return true;
  if (s.circuitBreakerPrompt) return true;
  if (s.cyberattackPrompt) return true;
  if (s.openingBellPrompt) return true;
  if (s.regulatoryInvestigationPrompt) return true;
  if (s.investorDay) return true;
  if (s.pick) return true;
  if (s.ipoChoice || s.ipoListPick || s.ipoBuy || s.outstandingBuy) return true;
  if (s.etfPick) return true;  // ETF buy/skip prompt must be answered explicitly
  if (s.companyLoanOffer) return true; // emergency company loan must be accepted
  return false;
}

/**
 * Short settlement payout by step delta (Rule 6). Profit when price falls.
 *  delta <= -2 -> +$1000 ; -1 -> +$500 ; 0 -> $0 ; +1 -> -$500 ; +2+ -> -$1000
 */
export function shortPayout(entryPrice: number, currentPrice: number): number {
  // Percentage-based conversion of the old step-delta table, preserving its
  // scale exactly: one step was ~5%, which paid $500, and the payout capped at
  // two steps (~10%) for $1,000. So $100 per 1% moved, capped at ±$1,000.
  if (entryPrice <= 0) return 0;
  const pct = ((currentPrice - entryPrice) / entryPrice) * 100;
  return Math.max(-1000, Math.min(1000, Math.round(-pct * 100 / 50) * 50));
}
