// Sold-Out / Payout Claim helpers. These run on Immer drafts and mutate state
// (recomputeClaim), so they live here rather than in the pure selectors module.

import {
  PAYOUT_TIER_CONTROL, PAYOUT_TIER_LOW, PAYOUT_TIER_MID,
  PAYOUT_TIER_CONTROL_SECTOR, PAYOUT_TIER_LOW_SECTOR, PAYOUT_TIER_MID_SECTOR,
  CONTROL_THRESHOLD_REGULAR,
} from '../data';
import { LADDER } from '../data';
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
 * Landing rent owed to the claim holder, keyed off the HOLDER's ownership tier.
 * When the holder also owns the completed Sector Portfolio for that stock's
 * sector, the boosted tier table applies (rulebook §13).
 */
export function claimPayout(holderShares: number, sectorComplete = false): number {
  if (sectorComplete) {
    if (holderShares >= CONTROL_THRESHOLD_REGULAR) return PAYOUT_TIER_CONTROL_SECTOR; // 6+  → 3000
    if (holderShares >= 3) return PAYOUT_TIER_MID_SECTOR;                             // 3-5 → 1500
    return PAYOUT_TIER_LOW_SECTOR;                                                    // 1-2 → 750
  }
  if (holderShares >= CONTROL_THRESHOLD_REGULAR) return PAYOUT_TIER_CONTROL; // 6+  → 2000
  if (holderShares >= 3) return PAYOUT_TIER_MID;                             // 3-5 → 1000
  return PAYOUT_TIER_LOW;                                                    // 1-2 → 500
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

/**
 * Final Payout Claim after the stock's market-value multiplier and the
 * landing player's shareholder discount. Payments stay in $50 increments so
 * the existing sector payouts ($750/$1,500/$3,000) remain intact.
 */
export function claimPayoutForLanding(
  holderShares: number,
  sectorComplete: boolean,
  currentStep: number,
  openingStep: number,
  landingShares: number,
): number {
  const base = claimPayout(holderShares, sectorComplete);
  const currentPrice = LADDER[Math.max(0, Math.min(LADDER.length - 1, currentStep))];
  const openingPrice = LADDER[Math.max(0, Math.min(LADDER.length - 1, openingStep))];
  const multiplier = landingValueMultiplier(currentPrice, openingPrice);
  const discount = shareholderLandingDiscount(landingShares);
  return Math.max(50, Math.round((base * multiplier * (1 - discount)) / 50) * 50);
}
