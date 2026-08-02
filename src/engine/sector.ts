// Sector Portfolio + Diversification (Phase 4). Pure read helpers over a
// player's regular-stock holdings. IPO and ETF shares never count.

import {
  BROAD_MARKET_BONUS, BROAD_MARKET_SECTORS, DIVERSIFIED_BONUS, DIVERSIFIED_SECTORS,
  SECTOR_CODES, STOCK_BY_CODE, isIpoCode,
} from '../data';
import type { SectorId } from '../data/types';
import type { Player } from './types';

/** Sectors where the player owns at least 1 share of EVERY regular company in it. */
export function completedSectors(p: Player): SectorId[] {
  const out: SectorId[] = [];
  for (const sec of Object.keys(SECTOR_CODES) as SectorId[]) {
    if (SECTOR_CODES[sec].every((code) => (p.shares[code] ?? 0) > 0)) out.push(sec);
  }
  return out;
}

/** Whether the player holds the completed Sector Portfolio for one sector. */
export function hasSectorPortfolio(p: Player, sector: SectorId): boolean {
  return SECTOR_CODES[sector].every((code) => (p.shares[code] ?? 0) > 0);
}

/** Count of distinct sectors the player holds at least 1 regular share in. */
export function distinctSectors(p: Player): number {
  const seen = new Set<SectorId>();
  for (const code of Object.keys(p.shares)) {
    if ((p.shares[code] ?? 0) <= 0 || isIpoCode(code)) continue;
    const sec = STOCK_BY_CODE[code]?.sector;
    if (sec) seen.add(sec);
  }
  return seen.size;
}

export type DiversificationTier = 'none' | 'diversified' | 'broad';

/** Highest diversification tier the player qualifies for. */
export function diversificationTier(p: Player): DiversificationTier {
  const n = distinctSectors(p);
  if (n >= BROAD_MARKET_SECTORS) return 'broad';
  if (n >= DIVERSIFIED_SECTORS) return 'diversified';
  return 'none';
}

/** Market Open diversification bonus — only the highest tier is paid. */
export function diversificationBonus(p: Player): number {
  const tier = diversificationTier(p);
  return tier === 'broad' ? BROAD_MARKET_BONUS : tier === 'diversified' ? DIVERSIFIED_BONUS : 0;
}
