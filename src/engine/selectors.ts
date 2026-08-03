// Low-level read-only selectors. Re-export rules and scoring for a unified public surface.
// Import from this file (or engine/index.ts) rather than from rules/scoringEngine directly.

export { clampStep, ipoOf, stepOf, priceOf, sellBackPrice, eventPool, canTradeNow, canMarketSell, bankSellLimit, bankSellRemaining, blocked, shortPayout } from './rules';
export { sharesValue, netWorth, isDiversified } from './scoringEngine';
export { topOwner, recomputeClaim, claimPayout } from './soldOut';
export { completedSectors, hasSectorPortfolio, distinctSectors, diversificationTier, diversificationBonus } from './sector';
export type { DiversificationTier } from './sector';

import { CONTROL_DIVIDEND_MULTIPLIER, CONTROL_THRESHOLD_IPO, CONTROL_THRESHOLD_REGULAR, STOCK_BY_CODE, IPO_BY_CODE, etfValue, isIpoCode } from '../data';
import type { GameState, Player } from './types';

/**
 * Dividend the player will collect on their NEXT Market Open pass, based on
 * current holdings: sum of printed dividend-per-share × shares owned (regular +
 * IPO), doubled per code where the player holds a Controlling Stake. Mirrors
 * the dividend calc in payMarketOpen — forward-looking, not a historical total.
 */
export function projectedDividend(_s: GameState, p: Player): number {
  let div = 0;
  for (const code of Object.keys(p.shares)) {
    const qty = p.shares[code];
    if (qty <= 0) continue;
    const isIpo = isIpoCode(code);
    const printed = isIpo ? (IPO_BY_CODE[code]?.div ?? 0) : (STOCK_BY_CODE[code]?.div ?? 0);
    if (printed <= 0) continue;
    const threshold = isIpo ? CONTROL_THRESHOLD_IPO : CONTROL_THRESHOLD_REGULAR;
    div += printed * qty * (qty >= threshold ? CONTROL_DIVIDEND_MULTIPLIER : 1);
  }
  return div;
}

export interface StockMovementStatus {
  direction: 'up' | 'down' | 'flat';
  label: 'Up' | 'Down' | 'Flat';
  stepDifference: number;
}

export function getStockMovementStatus(code: string, s: GameState): StockMovementStatus {
  const startStep = STOCK_BY_CODE[code]?.step ?? 0;
  const currentStep = s.prices[code] ?? startStep;
  const diff = currentStep - startStep;
  if (diff > 0) return { direction: 'up', label: 'Up', stepDifference: diff };
  if (diff < 0) return { direction: 'down', label: 'Down', stepDifference: diff };
  return { direction: 'flat', label: 'Flat', stepDifference: 0 };
}

import { MARGIN_INCREMENT, MARGIN_MAX } from '../data';
import { netWorth, sharesValue } from './scoringEngine';
import { priceOf } from './rules';

export interface BuyingPower {
  cash: number;
  marginBalance: number;    // 0 if no active margin
  marginAvailable: number;  // next increment if under the cap, else 0
  buyingPower: number;      // always equals cash
}

export function getBuyingPower(playerIdx: number, s: GameState): BuyingPower {
  const p = s.players[playerIdx];
  const inPurchaseContext = !!(s.trade || s.ipoBuy);
  const marginAvailable = inPurchaseContext && p.margin < MARGIN_MAX ? MARGIN_INCREMENT : 0;
  return {
    cash: p.cash,
    marginBalance: p.margin,
    marginAvailable,
    buyingPower: p.cash,
  };
}

export type RiskBadge = 'LEVERAGED' | 'SHORT POSITION' | 'LOW CASH' | 'OVERCONCENTRATED' | 'IPO HEAVY' | 'BALANCED';

export interface RiskWarning {
  badge: RiskBadge;
  color: string;
}

export function getPortfolioRisk(playerIdx: number, s: GameState): RiskWarning {
  const p = s.players[playerIdx];

  if (p.margin > 0) return { badge: 'LEVERAGED', color: 'var(--red)' };

  const hasShort = s.shorts.some(sh => sh.owner === playerIdx);
  if (hasShort) return { badge: 'SHORT POSITION', color: 'var(--red)' };

  if (p.cash < 1000) return { badge: 'LOW CASH', color: 'var(--yellow)' };

  // Check sector concentration: any single sector > 60% of share value
  const totalSv = sharesValue(s, p);
  if (totalSv > 0) {
    const bySector: Record<string, number> = {};
    let ipoValue = 0;
    for (const code of Object.keys(p.shares)) {
      const val = p.shares[code] * priceOf(s, code);
      if (isIpoCode(code)) { ipoValue += val; continue; }
      const sec = STOCK_BY_CODE[code]?.sector ?? 'unknown';
      bySector[sec] = (bySector[sec] || 0) + val;
    }
    if (ipoValue / totalSv > 0.6) return { badge: 'IPO HEAVY', color: 'var(--yellow)' };
    for (const v of Object.values(bySector)) {
      if (v / totalSv > 0.6) return { badge: 'OVERCONCENTRATED', color: 'var(--yellow)' };
    }
  }

  return { badge: 'BALANCED', color: 'var(--green)' };
}

export interface RankedPlayer {
  playerIdx: number;
  name: string;
  color: string;
  nw: number;
  cash: number;
  stocksValue: number;
  etfsValue: number;
  margin: number;
  rank: number;           // 0-based current rank
  prevRank: number | null;
  rankDelta: number | null; // positive = moved up, negative = moved down
}

export function getRankedPlayers(s: GameState): RankedPlayer[] {
  return s.players
    .map((p, i) => {
      const sv = sharesValue(s, p);
      return {
        playerIdx: i,
        name: p.name,
        color: p.color,
        nw: netWorth(s, p),
        cash: p.cash,
        stocksValue: sv,
        etfsValue: etfValue(p.etfShares),
        margin: p.margin,
        prevRank: p.prevRank,
        rank: 0,
        rankDelta: null,
      };
    })
    // Rank by net worth; break ties by cash on hand, then by lower margin debt.
    .sort((a, b) => b.nw - a.nw || b.cash - a.cash || a.margin - b.margin)
    .map((entry, rank) => ({
      ...entry,
      rank,
      rankDelta: entry.prevRank !== null ? entry.prevRank - rank : null,
    }));
}

export function getPlayerNetWorthMovement(playerIdx: number, s: GameState): StockMovementStatus {
  const p = s.players[playerIdx];
  const nw = netWorth(s, p);
  const diff = nw - s.opts.startCash;
  if (diff > 0) return { direction: 'up', label: 'Up', stepDifference: diff };
  if (diff < 0) return { direction: 'down', label: 'Down', stepDifference: diff };
  return { direction: 'flat', label: 'Flat', stepDifference: 0 };
}
