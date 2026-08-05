// Cost-basis and gain/loss accounting for regular stocks and IPOs.

import type { GameState, Player } from './types';
import { netWorth } from './scoringEngine';
import { priceOf } from './rules';

/** Add purchase cost to a holding's total basis. */
export function addStockCostBasis(player: Player, code: string, amount: number): void {
  player.stockCostBasis[code] = (player.stockCostBasis[code] ?? 0) + amount;
}

/** Remove the proportional average basis for shares leaving a holding. */
export function removeStockCostBasis(player: Player, code: string, qty: number, ownedBefore: number): number {
  if (qty <= 0 || ownedBefore <= 0) return 0;
  const totalBasis = player.stockCostBasis[code] ?? 0;
  const removed = qty >= ownedBefore ? totalBasis : totalBasis * (qty / ownedBefore);
  const remaining = totalBasis - removed;
  if (qty >= ownedBefore || remaining <= 0.000001) delete player.stockCostBasis[code];
  else player.stockCostBasis[code] = remaining;
  return removed;
}

/** Record proceeds and move the sold shares' basis into realized gain/loss. */
export function recordStockSale(
  player: Player, code: string, qty: number, proceeds: number, ownedBefore: number,
): number {
  const removedBasis = removeStockCostBasis(player, code, qty, ownedBefore);
  const gain = proceeds - removedBasis;
  player.realizedStockGain += gain;
  return gain;
}

export interface HoldingGainLoss {
  marketValue: number;
  costBasis: number;
  unrealized: number;
  returnPct: number;
}

export function holdingGainLoss(s: GameState, player: Player, code: string): HoldingGainLoss {
  const marketValue = (player.shares[code] ?? 0) * priceOf(s, code);
  const costBasis = player.stockCostBasis[code] ?? 0;
  const unrealized = marketValue - costBasis;
  return {
    marketValue,
    costBasis,
    unrealized,
    returnPct: costBasis > 0 ? (unrealized / costBasis) * 100 : 0,
  };
}

export interface StockGainLoss {
  realized: number;
  unrealized: number;
  total: number;
}

export function stockGainLoss(s: GameState, player: Player): StockGainLoss {
  let unrealized = 0;
  for (const code of Object.keys(player.shares)) {
    if ((player.shares[code] ?? 0) > 0) unrealized += holdingGainLoss(s, player, code).unrealized;
  }
  return {
    realized: player.realizedStockGain,
    unrealized,
    total: player.realizedStockGain + unrealized,
  };
}

/** Salary-adjusted whole-game performance used by Gain/Loss Mode. */
export function marketGain(s: GameState, player: Player): number {
  return netWorth(s, player) - s.opts.startCash - player.salaryCollected;
}

export function marketReturnPct(s: GameState, player: Player): number {
  return s.opts.startCash > 0 ? (marketGain(s, player) / s.opts.startCash) * 100 : 0;
}

/** Active ranking score: net worth in Standard Mode, Market Gain otherwise. */
export function rankingScore(s: GameState, player: Player): number {
  return s.opts.scoringMode === 'gainLoss' ? marketGain(s, player) : netWorth(s, player);
}
