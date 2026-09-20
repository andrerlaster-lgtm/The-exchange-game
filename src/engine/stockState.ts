// Stock price mutations and short settlement (called on Immer drafts).

import { CEILING_TRIGGER, IPO_INDEX, type PriceMoveSource, applyBasisPoints, isIpoCode } from '../data';
import { money } from '../utils/formatMoney';
import type { GameState } from './types';
import { priceOf, shortPayout } from './rules';
import { protectMove } from './development';

/** What a price move actually did, in dollars, after the grid, the floor and
    (later) upgrade protection — for logs, the ticker, and tests. */
export interface PriceMoveResult {
  before: number;
  after: number;
  delta: number;
  pct: number;
}

/**
 * Queue a global Market Event when a stock/IPO crosses the $5,000 mark upward
 * on a trade-driven move. Fires only on the upward crossing and re-arms only
 * once the company falls back below, so repeated buying above the mark does
 * not re-trigger. Card-driven moves are excluded to avoid a Market Event
 * queuing another one mid-resolution.
 */
function triggerCeiling(s: GameState, code: string): void {
  s.pendingDraws.push('ME');
  s.log.unshift({ text: `${code} crossed the ${money(CEILING_TRIGGER)} mark — a Market Event is triggered.`, kind: 'r', t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

/**
 * The single entry point for every price change in the game.
 *
 * Every caller must name its `source`. The upgrade/shield system has to tell a
 * market-driven decline (protected) from a decline a player brought on
 * themselves by selling or by picking their own company as a card's target,
 * and that intent cannot be recovered from a bare delta. Unrevealed IPOs never
 * move.
 */
export function applyPriceMove(
  s: GameState,
  code: string,
  bp: number,
  source: PriceMoveSource,
): PriceMoveResult {
  const ipo = isIpoCode(code) ? s.ipos[IPO_INDEX[code]] : null;
  if (ipo && !ipo.revealed) return { before: ipo.price, after: ipo.price, delta: 0, pct: 0 };

  const before = priceOf(s, code);
  // Upgrade resilience and Market Protection apply here and only here, so no
  // individual event resolver needs its own protection logic. Grid rounding
  // and the floor come last, inside applyBasisPoints.
  const protectedBp = protectMove(s, code, before, bp, source);
  const after = applyBasisPoints(before, protectedBp);

  if (ipo) ipo.price = after;
  else s.prices[code] = after;

  // Only a real change counts as the "last move": a decline absorbed by the
  // floor or fully by protection leaves the previous readout in place.
  if (after !== before) {
    s.lastMove ??= {};
    s.lastMove[code] = { pct: ((after - before) / before) * 100, source, lap: s.lap };
  }

  return { before, after, delta: after - before, pct: before === 0 ? 0 : ((after - before) / before) * 100 };
}

/**
 * Trade-driven move (Rule 2): regular stocks only, after a buy or sell. The
 * only mover that can queue a Market Event, and only on an upward crossing of
 * the $5,000 mark.
 */
export function moveTradePrice(s: GameState, code: string, bp: number, source: PriceMoveSource): PriceMoveResult {
  const r = applyPriceMove(s, code, bp, source);
  if (r.before < CEILING_TRIGGER && r.after >= CEILING_TRIGGER) triggerCeiling(s, code);
  return r;
}

/** Event-driven move: regular stocks and revealed IPOs shift directly. */
export function moveEventPrice(
  s: GameState, code: string, bp: number, source: PriceMoveSource = 'marketEvent',
): PriceMoveResult {
  return applyPriceMove(s, code, bp, source);
}

/**
 * Round-end market move: the one guaranteed repricing per completed round
 * (2026-09-19 round-end market rules). Deliberately never queues a Market
 * Event on crossing the $5,000 mark — it fires every non-final round by
 * design, so treating it like a trade would inflate Market Event frequency
 * far beyond what the deck was tuned for; card-driven moves skip it too.
 */
export function moveRoundMarketPrice(s: GameState, code: string, bp: number): PriceMoveResult {
  return applyPriceMove(s, code, bp, 'roundMarket');
}

/** Settle the current player's open short at the start of their next turn (Rule 6). */
export function settleShorts(s: GameState): void {
  const keep: GameState['shorts'] = [];
  for (const sh of s.shorts) {
    if (sh.owner === s.cur) {
      const pl = shortPayout(sh.entryPrice, priceOf(s, sh.code));
      s.players[s.cur].cash += pl;
      s.players[s.cur].realizedStockGain += pl;
      s.log.unshift({
        text: `${sh.ownerName} settles short ${sh.code}: ${pl >= 0 ? '+' : ''}${money(pl)}`,
        kind: pl >= 0 ? 'g' : 'r', t: s.lap,
      });
      if (s.log.length > 40) s.log.pop();
      s.tradeLog.unshift({ kind: 'settle', text: `Short ${sh.code} settled ${pl >= 0 ? '+' : ''}${money(pl)}`, amount: pl, player: sh.ownerName, t: s.lap });
      if (s.tradeLog.length > 60) s.tradeLog.pop();
    } else keep.push(sh);
  }
  s.shorts = keep;
}

/** Lowest-priced code in the event pool. */
export function lowestCode(s: GameState, pool: Array<{ code: string }>): string {
  return pool.slice().sort((a, b) => priceOf(s, a.code) - priceOf(s, b.code))[0].code;
}

/** Highest-priced code in the event pool. */
export function highestCode(s: GameState, pool: Array<{ code: string }>): string {
  return pool.slice().sort((a, b) => priceOf(s, b.code) - priceOf(s, a.code))[0].code;
}
