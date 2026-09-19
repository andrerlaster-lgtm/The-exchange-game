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
/**
 * Return on what the player holds right now: total unrealized gain divided by
 * total cost basis across current stock and IPO holdings, as a percentage —
 * the "how are my investments doing" number a brokerage account shows.
 * Holdings with no recorded basis are left out of both sides so they can't
 * distort the ratio. Realized gains are not included: they have no remaining
 * cost basis to measure against (see marketReturnPct for the whole game).
 */
export function holdingsReturnPct(s: GameState, player: Player): number {
  let basis = 0;
  let unrealized = 0;
  for (const code of Object.keys(player.shares)) {
    if ((player.shares[code] ?? 0) <= 0) continue;
    const gl = holdingGainLoss(s, player, code);
    if (gl.costBasis <= 0) continue;
    basis += gl.costBasis;
    unrealized += gl.unrealized;
  }
  return basis > 0 ? (unrealized / basis) * 100 : 0;
}

export function marketGain(s: GameState, player: Player): number {
  return netWorth(s, player) - s.opts.startCash - player.salaryCollected;
}

export function marketReturnPct(s: GameState, player: Player): number {
  return s.opts.startCash > 0 ? (marketGain(s, player) / s.opts.startCash) * 100 : 0;
}

/**
 * Per-lap geometric return — a CAGR analog using laps (the game's only
 * real recurring period) in place of years: (1 + cumulative return)^(1/laps) - 1.
 * This is portfolio-level only: a true per-holding CAGR would need each
 * lot's purchase lap, which stockCostBasis does not track (it only keeps a
 * running total, not dated lots), so this stays a whole-portfolio metric.
 */
export function lapReturnPct(s: GameState, player: Player): number {
  const laps = Math.max(1, s.lap);
  const cumulativeMultiple = Math.max(0, 1 + marketReturnPct(s, player) / 100);
  return (Math.pow(cumulativeMultiple, 1 / laps) - 1) * 100;
}

/** Active ranking score: net worth in Standard Mode, Market Gain otherwise. */
export function rankingScore(s: GameState, player: Player): number {
  return s.opts.scoringMode === 'gainLoss' ? marketGain(s, player) : netWorth(s, player);
}
