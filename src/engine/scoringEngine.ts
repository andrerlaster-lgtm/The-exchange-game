// Scoring: net worth, share value, diversification check (Rules 9, 11).

import { STOCK_BY_CODE, etfValue, isIpoCode } from '../data';
import type { GameState, Player } from './types';
import { priceOf } from './selectors';

/** Total dollar value of all a player's stock holdings (regular + IPO) at current prices. */
export function sharesValue(s: GameState, p: Player): number {
  let v = 0;
  for (const code of Object.keys(p.shares)) v += p.shares[code] * priceOf(s, code);
  return v;
}

/** Final / running portfolio value = cash + stock value + ETF value − margin. (Rule 11) */
export function netWorth(s: GameState, p: Player): number {
  return p.cash + sharesValue(s, p) + etfValue(p.etfShares) - p.margin;
}

/**
 * Diversified Portfolio status (Rule 9): shares in at least 5 sectors, no margin.
 * IPO shares do not count toward sector diversification.
 */
export function isDiversified(_s: GameState, p: Player): boolean {
  if (p.margin > 0) return false;
  const bySector: Record<string, number> = {};
  for (const code of Object.keys(p.shares)) {
    if (isIpoCode(code)) continue;
    const sec = STOCK_BY_CODE[code].sector;
    bySector[sec] = (bySector[sec] || 0) + p.shares[code];
  }
  let qualifying = 0;
  for (const sec of Object.keys(bySector)) if (bySector[sec] >= 1) qualifying++;
  return qualifying >= 5;
}
