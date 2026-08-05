// Scoring: net worth, share value, diversification check (Rules 9, 11).

import { DIVERSIFIED_SECTORS, etfValue } from '../data';
import type { GameState, Player } from './types';
import { priceOf } from './selectors';
import { distinctSectors } from './sector';
import { feeDebtBalance } from './feeDebt';

/** Total dollar value of all a player's stock holdings (regular + IPO) at current prices. */
export function sharesValue(s: GameState, p: Player): number {
  let v = 0;
  for (const code of Object.keys(p.shares)) v += p.shares[code] * priceOf(s, code);
  return v;
}

/** Final / running portfolio value = cash + stock value + ETF value − margin − unpaid fees. */
export function netWorth(s: GameState, p: Player): number {
  return p.cash + sharesValue(s, p) + etfValue(p.etfShares) - p.margin - feeDebtBalance(p);
}

/**
 * Diversified Portfolio status (Rule 9): holdings in at least 3 distinct
 * regular-stock sectors. Margin, share quantity, IPOs, and ETFs do not affect it.
 */
export function isDiversified(_s: GameState, p: Player): boolean {
  return distinctSectors(p) >= DIVERSIFIED_SECTORS;
}
