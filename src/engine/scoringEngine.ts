// Scoring: net worth, share value, diversification check (Rules 9, 11).

import { DIVERSIFIED_SECTORS, etfValue } from '../data';
import type { GameState, Player } from './types';
import { priceOf } from './selectors';
import { distinctSectors } from './sector';
import { feeDebtBalance } from './feeDebt';
import { totalOwedByPlayer, totalOwedToPlayer } from './playerLoans';

/** Net worth before player-company holdings; used as the non-circular price base.
    Negotiated Payout Claim loans (playerDebts) count as a liability for the
    debtor and an asset for the creditor — a real IOU on both sides. */
export function operatingNetWorth(s: GameState, p: Player): number {
  const idx = s.players.indexOf(p);
  return p.cash + sharesValue(s, p) + etfValue(p.etfShares) - p.margin - feeDebtBalance(p)
    - (p.companyLoanPrincipal ?? 0) - (p.companyLoanInterest ?? 0)
    - totalOwedByPlayer(s, idx) + totalOwedToPlayer(s, idx);
}

function companyHoldingsValue(s: GameState, p: Player): number {
  return Object.entries(p.companyHoldings ?? {}).reduce((sum, [ownerKey, qty]) => {
    const owner = Number(ownerKey);
    if (!Number.isInteger(owner) || !s.players[owner] || qty <= 0) return sum;
    const price = Math.max(25, Math.round(Math.max(0, operatingNetWorth(s, s.players[owner])) / 100));
    return sum + qty * price;
  }, 0);
}

/** Total dollar value of all a player's stock holdings (regular + IPO) at current prices. */
export function sharesValue(s: GameState, p: Player): number {
  let v = 0;
  for (const code of Object.keys(p.shares)) v += p.shares[code] * priceOf(s, code);
  return v;
}

/** Final / running portfolio value = cash + stock value + ETF value − margin − unpaid fees. */
export function netWorth(s: GameState, p: Player): number {
  return operatingNetWorth(s, p) + companyHoldingsValue(s, p);
}

/**
 * Diversified Portfolio status (Rule 9): holdings in at least 3 distinct
 * regular-stock sectors. Margin, share quantity, IPOs, and ETFs do not affect it.
 */
export function isDiversified(_s: GameState, p: Player): boolean {
  return distinctSectors(p) >= DIVERSIFIED_SECTORS;
}
