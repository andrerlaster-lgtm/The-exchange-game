// Sold-Out / Payout Claim helpers. These run on Immer drafts and mutate state
// (recomputeClaim), so they live here rather than in the pure selectors module.

import {
  PAYOUT_MULT_CONTROL, PAYOUT_MULT_LOW, PAYOUT_MULT_MID,
  PAYOUT_MULT_CONTROL_SECTOR, PAYOUT_MULT_LOW_SECTOR, PAYOUT_MULT_MID_SECTOR,
  CONTROL_THRESHOLD_REGULAR, PAYOUT_CLAIM_TOTAL_CAP,
} from '../data';
import type { GameState } from './types';

/**
 * Index of the SOLE top owner of `code` by share count, or null if there is a
 * tie for the top (Contested) or nobody owns any shares.
 */
export function topOwner(s: GameState, code: string): number | null {
  let best = -1;
  let bestQty = 0;
  let tie = false;
  s.players.forEach((p, i) => {
    const q = p.shares[code] || 0;
    if (q <= 0) return;
    if (q > bestQty) { best = i; bestQty = q; tie = false; }
    else if (q === bestQty) { tie = true; }
  });
  if (best < 0 || tie) return null;
  return best;
}

/**
 * Recompute the Payout Claim holder for an already-sold-out stock after an
 * ownership change. No-op if the stock is not sold out. Returns true if the
 * holder index actually changed (for optional handover logging).
 */
export function recomputeClaim(s: GameState, code: string): boolean {
  const rec = s.soldOut[code];
  if (!rec) return false;
  const next = topOwner(s, code);
  if (next === rec.claimHolder) return false;
  rec.claimHolder = next;
  return true;
}

/**
 * Landing rent owed to the claim holder, keyed off the HOLDER's ownership tier
 * AND the sold-out company's own opening per-share price (2026-09-18 balance
 * pass, Option 4 — see the PAYOUT_MULT_* comment in data/stocks.ts for why: a
 * flat dollar table paid Starter-tier companies roughly 2x the rent-per-
 * dollar-invested of Premium ones). When the holder also owns the completed
 * Sector Portfolio for that stock's sector, the boosted multiplier table
 * applies (rulebook §13).
 */
export function claimPayout(holderShares: number, sharePrice: number, sectorComplete = false): number {
  if (sectorComplete) {
    if (holderShares >= CONTROL_THRESHOLD_REGULAR) return PAYOUT_MULT_CONTROL_SECTOR * sharePrice; // 6+  → 6x
    if (holderShares >= 3) return PAYOUT_MULT_MID_SECTOR * sharePrice;                             // 3-5 → 3x
    return PAYOUT_MULT_LOW_SECTOR * sharePrice;                                                    // 1-2 → 1.5x
  }
  if (holderShares >= CONTROL_THRESHOLD_REGULAR) return PAYOUT_MULT_CONTROL * sharePrice; // 6+  → 4x
  if (holderShares >= 3) return PAYOUT_MULT_MID * sharePrice;                             // 3-5 → 2x
  return PAYOUT_MULT_LOW * sharePrice;                                                    // 1-2 → 1x
}

/**
 * Market-value rent multiplier for a controlled space. A stock at or below
 * its opening price keeps the normal payout; once it rises above opening,
 * rent steps up to 1.5×, then 2× when it reaches at least twice opening.
 */
export function landingValueMultiplier(currentPrice: number, openingPrice: number): number {
  if (currentPrice >= openingPrice * 2) return 2;
  if (currentPrice > openingPrice) return 1.5;
  return 1;
}

/** Landing player's shareholder discount: 10% per share, capped at 50%. */
export function shareholderLandingDiscount(sharesHeld: number): number {
  return Math.min(0.5, Math.max(0, sharesHeld) * 0.10);
}

/** Cap the complete player-to-player charge from one sold-out landing. This is
    applied only after every claim adjustment and any Sector Rent are known. */
export function capPayoutClaimTotal(claimAmount: number, sectorRent = 0): number {
  return Math.min(PAYOUT_CLAIM_TOTAL_CAP, claimAmount + sectorRent);
}

/**
 * Final Payout Claim after the stock's market-value multiplier and the
 * landing player's shareholder discount. Payments stay in $50 increments.
 * `openingPrice` (this specific company's own opening per-share price,
 * already needed for the value multiplier below) now doubles as the base
 * rent's per-share price too — see claimPayout's comment.
 */
export function claimPayoutForLanding(
  holderShares: number,
  sectorComplete: boolean,
  currentPrice: number,
  openingPrice: number,
  landingShares: number,
): number {
  const base = claimPayout(holderShares, openingPrice, sectorComplete);
  const multiplier = landingValueMultiplier(currentPrice, openingPrice);
  const discount = shareholderLandingDiscount(landingShares);
  return Math.max(50, Math.round((base * multiplier * (1 - discount)) / 50) * 50);
}
