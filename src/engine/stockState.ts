// Stock price mutations and short settlement (called on Immer drafts).

import { IPO_INDEX, LADDER, isIpoCode } from '../data';
import { money } from '../utils/formatMoney';
import type { GameState } from './types';
import { clampStep, shortPayout, stepOf } from './rules';

/** Ladder step index of the $5,000 ceiling. */
export const CEILING_STEP = LADDER.length - 1;

/**
 * Queue a global Market Event when a stock/IPO first reaches the $5,000 ceiling
 * on a trade-driven move. Fires only on the transition into the top step
 * (before < ceiling, after === ceiling), so buying again at the ceiling — where
 * price no longer moves — does not re-trigger. Card-driven moves are excluded
 * to avoid a Market Event queuing another one mid-resolution.
 */
function triggerCeiling(s: GameState, code: string): void {
  s.pendingDraws.push('ME');
  s.log.unshift({ text: `${code} hit the ${money(LADDER[CEILING_STEP])} ceiling — a Market Event is triggered.`, kind: 'r', t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

/** Trade-driven move (Rule 2): regular stocks only, ±1 step after buy/sell. */
export function moveTradePrice(s: GameState, code: string, d: number): void {
  const before = s.prices[code];
  s.prices[code] = clampStep(before + d);
  if (before < CEILING_STEP && s.prices[code] === CEILING_STEP) triggerCeiling(s, code);
}

/** Event-driven move: regular stocks and IPOs shift directly (no volatility amplification). */
export function moveEventPrice(s: GameState, code: string, d: number): void {
  if (isIpoCode(code)) {
    const ip = s.ipos[IPO_INDEX[code]];
    if (!ip.revealed) return;
    ip.step = clampStep(ip.step + d);
  } else {
    s.prices[code] = clampStep(s.prices[code] + d);
  }
}

/** Settle the current player's open short at the start of their next turn (Rule 6). */
export function settleShorts(s: GameState): void {
  const keep: GameState['shorts'] = [];
  for (const sh of s.shorts) {
    if (sh.owner === s.cur) {
      const delta = s.prices[sh.code] - sh.entryStep;
      const pl = shortPayout(delta);
      s.players[s.cur].cash += pl;
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
  return pool.slice().sort((a, b) => stepOf(s, a.code) - stepOf(s, b.code))[0].code;
}

/** Highest-priced code in the event pool. */
export function highestCode(s: GameState, pool: Array<{ code: string }>): string {
  return pool.slice().sort((a, b) => stepOf(s, b.code) - stepOf(s, a.code))[0].code;
}
