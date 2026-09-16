// Sector Control: owning both companies in a Sector Control pair (see
// SECTOR_PAIRS in data/stocks.ts) collects a flat rent toll whenever anyone
// lands on either company's space — a Monopoly-style color-set bonus,
// independent of the broader 8-category Sector Portfolio/diversification
// system. IPO and ETF shares never count toward ownership.

import { SECTOR_PAIRS } from '../data';
import type { SectorPairId } from '../data/types';
import type { GameState } from './types';

/**
 * The sole player who owns at least 1 share of BOTH companies in a pair,
 * with no other player holding a share of either — or null if the pair is
 * unowned, or split across more than one player (Contested; no rent either
 * way, same fallback as a sold-out claim tied between owners).
 */
export function sectorPairOwner(s: GameState, pair: SectorPairId): number | null {
  const codes = SECTOR_PAIRS[pair].codes;
  const holders = new Set<number>();
  s.players.forEach((p, i) => {
    if (codes.some((c) => (p.shares[c] ?? 0) > 0)) holders.add(i);
  });
  if (holders.size !== 1) return null;
  const only = [...holders][0]!;
  const p = s.players[only];
  return codes.every((c) => (p.shares[c] ?? 0) > 0) ? only : null;
}

/** Every Sector Control pair the given player exclusively controls right now. */
export function controlledSectorPairs(s: GameState, playerIndex: number): SectorPairId[] {
  return (Object.keys(SECTOR_PAIRS) as SectorPairId[]).filter(
    (pair) => sectorPairOwner(s, pair) === playerIndex,
  );
}
