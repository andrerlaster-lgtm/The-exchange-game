// Scoring: net worth, share value, diversification check (Rules 9, 11).

import { DIVERSIFIED_SECTORS, etfValue } from '../data';
import type { GameState, Player } from './types';
import { priceOf } from './selectors';
import { distinctSectors } from './sector';
import { feeDebtBalance } from './feeDebt';
import { totalOwedByPlayer, totalOwedToPlayer } from './playerLoans';

/** Net worth before player-company holdings; used as the non-circular price base.
    Negotiated Payout Claim loans (playerDebts) count as a liability for the
    debtor and an asset for the creditor — a real IOU on both sides. Takes the
    player's index rather than the Player object itself — the object form
    used to re-derive its own index via `s.players.indexOf(p)` on every call
    (an O(n) scan on a function called inside sorts and render loops), and
    silently returned -1 for a structural copy of a player rather than the
    live object, which dropped the loan legs with no error. Callers that
    already have the index (companyHoldingsValue, companyMode.ts) now pass it
    straight through instead of looking the object back up. */
export function operatingNetWorth(s: GameState, pi: number): number {
  const p = s.players[pi];
  return p.cash + sharesValue(s, p) + etfValue(p.etfShares) - p.margin - feeDebtBalance(p)
    - (p.companyLoanPrincipal ?? 0) - (p.companyLoanInterest ?? 0)
    - totalOwedByPlayer(s, pi) + totalOwedToPlayer(s, pi);
}

function companyHoldingsValue(s: GameState, p: Player): number {
  return Object.entries(p.companyHoldings ?? {}).reduce((sum, [ownerKey, qty]) => {
    const owner = Number(ownerKey);
    if (!Number.isInteger(owner) || !s.players[owner] || qty <= 0) return sum;
    const price = Math.max(25, Math.round(Math.max(0, operatingNetWorth(s, owner)) / 100));
    return sum + qty * price;
  }, 0);
}

/** Total dollar value of all a player's stock holdings (regular + IPO) at current prices. */
export function sharesValue(s: GameState, p: Player): number {
  let v = 0;
  for (const code of Object.keys(p.shares)) v += p.shares[code] * priceOf(s, code);
  return v;
}

/** Final / running portfolio value = cash + stock value + ETF value − margin − unpaid fees.
    Still takes the Player object (the vast majority of call sites have one
    on hand, not an index) — the single indexOf here is the one place that
    lookup happens now, instead of once per level of operatingNetWorth's own
    recursion into other players' company holdings. */
export function netWorth(s: GameState, p: Player): number {
  const pi = s.players.indexOf(p);
  return operatingNetWorth(s, pi) + companyHoldingsValue(s, p);
}

/**
 * Diversified Portfolio status (Rule 9): holdings in at least 3 distinct
 * regular-stock sectors. Margin, share quantity, IPOs, and ETFs do not affect it.
 */
export function isDiversified(_s: GameState, p: Player): boolean {
  return distinctSectors(p) >= DIVERSIFIED_SECTORS;
}
