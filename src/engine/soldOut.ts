// Sold-Out / Payout Claim helpers. These run on Immer drafts and mutate state
// (recomputeClaim), so they live here rather than in the pure selectors module.

import {
  PAYOUT_TIER_CONTROL, PAYOUT_TIER_LOW, PAYOUT_TIER_MID,
  PAYOUT_TIER_CONTROL_SECTOR, PAYOUT_TIER_LOW_SECTOR, PAYOUT_TIER_MID_SECTOR,
  CONTROL_THRESHOLD_REGULAR,
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
