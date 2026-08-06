// Rule-checking functions: pure reads used to gate actions and compute payouts.

import { IPO_BY_CODE, IPO_INDEX, LADDER, STOCK_BY_CODE, isIpoCode } from '../data';
import type { GameState, IpoState } from './types';

export function clampStep(x: number): number {
  return Math.max(0, Math.min(LADDER.length - 1, x));
}

/** Resolved IpoState for an IPO code. */
export function ipoOf(s: GameState, code: string): IpoState {
  return s.ipos[IPO_INDEX[code]];
}

/** Current ladder step for any tradable code (regular or IPO). */
export function stepOf(s: GameState, code: string): number {
  return isIpoCode(code) ? ipoOf(s, code).step : s.prices[code];
}

/** Current dollar price for any tradable code. */
export function priceOf(s: GameState, code: string): number {
  return LADDER[stepOf(s, code)];
}

/** Bank sell-back price (rulebook §11): the seller receives one price step
    below the current market price — or the $100 floor when already there. */
export function sellBackPrice(s: GameState, code: string): number {
  return LADDER[Math.max(0, stepOf(s, code) - 1)];
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
 * the sell action. Bank sell-back is still closed during the Market Open window
 * (that reopens on the Trade Step).
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
  if (s.landingNotice) return true; // cardless financial result must be acknowledged
  if (s.marketOpenWindow) return true; // Market Open Trading Window must be explicitly closed
  if (s.pendingDraws.length > 0) return true;
  if (s.circuitBreakerPrompt) return true;
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
export function shortPayout(delta: number): number {
  if (delta <= -2) return 1000;
  if (delta === -1) return 500;
  if (delta === 0) return 0;
  if (delta === 1) return -500;
  return -1000;
}
