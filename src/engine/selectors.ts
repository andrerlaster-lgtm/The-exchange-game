// Low-level read-only selectors. Re-export rules and scoring for a unified public surface.
// Import from this file (or engine/index.ts) rather than from rules/scoringEngine directly.

export { clampPrice, ipoOf, priceOf, sellBackPrice, canFall, canRise, companyBuyoutCost, eventPool, canTradeNow, canMarketSell, bankSellLimit, bankSellRemaining, blocked, shortPayout } from './rules';
export { sharesValue, netWorth, isDiversified } from './scoringEngine';
export { holdingGainLoss, stockGainLoss, marketGain, marketReturnPct, lapReturnPct, rankingScore } from './gainLoss';
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
    const controlling = qty >= threshold;
    // Mirror payMarketOpen's own rounding exactly, so this projection never
    // promises a fractional-cent amount the real payout wouldn't produce.
    div += controlling ? Math.round(printed * qty * CONTROL_DIVIDEND_MULTIPLIER) : printed * qty;
  }
  return div;
}

export interface HoldingDividendInfo {
  printed: number;          // per-share dividend as printed on the card
  perLap: number;           // this holding's actual contribution to the next Market Open payout
  yieldPct: number;         // yield-to-current-price: perLap ÷ current market value × 100
  yieldOnCostPct: number;   // yield-to-cost: perLap ÷ original cost basis × 100 (0 if no basis tracked)
  controlThreshold: number; // 6 for a regular stock, 3 for an IPO
  isController: boolean;    // at/above the Controller threshold (rulebook: "6+ shares = Controller")
  sharesToControl: number;  // additional shares needed to reach Controller (0 once there)
}

/**
 * Per-holding breakdown of the same dividend math projectedDividend sums
 * across the whole portfolio — read-only, does not change what gets paid.
 * Reuses payMarketOpen's exact rounding (via the same Controller-multiplier
 * formula as projectedDividend) so the number shown always matches reality.
 *
 * Returns BOTH yield conventions since they answer different questions:
 * yieldPct (yield-to-current-price) is "what would I earn buying in today",
 * yieldOnCostPct (yield-to-cost) is "what am I actually earning on what I
 * paid" — the two diverge whenever the price has moved since purchase.
 */
export function holdingDividendInfo(s: GameState, p: Player, code: string): HoldingDividendInfo {
  const qty = p.shares[code] ?? 0;
  const isIpo = isIpoCode(code);
  const printed = isIpo ? (IPO_BY_CODE[code]?.div ?? 0) : (STOCK_BY_CODE[code]?.div ?? 0);
  const controlThreshold = isIpo ? CONTROL_THRESHOLD_IPO : CONTROL_THRESHOLD_REGULAR;
  const isController = qty >= controlThreshold;
  const perLap = printed <= 0 ? 0 : (isController ? Math.round(printed * qty * CONTROL_DIVIDEND_MULTIPLIER) : printed * qty);
  const marketValue = qty * priceOf(s, code);
  const costBasis = p.stockCostBasis[code] ?? 0;
  return {
    printed,
    perLap,
    yieldPct: marketValue > 0 ? (perLap / marketValue) * 100 : 0,
    yieldOnCostPct: costBasis > 0 ? (perLap / costBasis) * 100 : 0,
    controlThreshold,
    isController,
    sharesToControl: Math.max(0, controlThreshold - qty),
  };
}

export interface StockMovementStatus {
  direction: 'up' | 'down' | 'flat';
  label: 'Up' | 'Down' | 'Flat';
  // Dollars. Was named `stepDifference` under the ladder model, but
  // getPlayerNetWorthMovement below always put a dollar amount here, so the
  // "step" in the old name only ever described one of its two producers.
  difference: number;
}

// Extends the shared StockMovementStatus (also used by getPlayerNetWorthMovement
// for the unrelated net-worth up/down badge) with a real price % — stock price
// specific, since "opening price" only means something for a stock/IPO code.
export interface StockPriceMovement extends StockMovementStatus {
  pctFromOpen: number; // (current price - opening price) ÷ opening price × 100
}

export function getStockMovementStatus(code: string, s: GameState): StockPriceMovement {
  const openingPrice = STOCK_BY_CODE[code]?.base ?? 0;
  const currentPrice = s.prices[code] ?? openingPrice;
  const diff = currentPrice - openingPrice;
  const pctFromOpen = openingPrice > 0 ? (diff / openingPrice) * 100 : 0;
  if (diff > 0) return { direction: 'up', label: 'Up', difference: diff, pctFromOpen };
  if (diff < 0) return { direction: 'down', label: 'Down', difference: diff, pctFromOpen };
  return { direction: 'flat', label: 'Flat', difference: 0, pctFromOpen: 0 };
}

import { MARGIN_INCREMENT, MARGIN_MAX } from '../data';
import { netWorth, sharesValue } from './scoringEngine';
import { priceOf } from './rules';
import { marketGain, marketReturnPct, rankingScore, stockGainLoss } from './gainLoss';
import { feeDebtBalance } from './feeDebt';

export interface BuyingPower {
  cash: number;
  marginBalance: number;    // 0 if no active margin
  marginAvailable: number;  // next increment if under the cap, else 0
  buyingPower: number;      // always equals cash
}

export function getBuyingPower(playerIdx: number, s: GameState): BuyingPower {
  const p = s.players[playerIdx];
  const inPurchaseContext = !!(s.trade || s.ipoBuy || s.outstandingBuy);
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
  feeDebt: number;
  salaryCollected: number;
  marketGain: number;
  marketReturnPct: number;
  realizedStockGain: number;
  unrealizedStockGain: number;
  totalStockGain: number;
  score: number;
  rank: number;           // 0-based current rank
  prevRank: number | null;
  rankDelta: number | null; // positive = moved up, negative = moved down
}

export function getRankedPlayers(s: GameState): RankedPlayer[] {
  return s.players
    .map((p, i) => {
      const sv = sharesValue(s, p);
      const stockGl = stockGainLoss(s, p);
      return {
        playerIdx: i,
        name: p.name,
        color: p.color,
        nw: netWorth(s, p),
        cash: p.cash,
        stocksValue: sv,
        etfsValue: etfValue(p.etfShares),
        margin: p.margin,
        feeDebt: feeDebtBalance(p),
        salaryCollected: p.salaryCollected,
        marketGain: marketGain(s, p),
        marketReturnPct: marketReturnPct(s, p),
        realizedStockGain: stockGl.realized,
        unrealizedStockGain: stockGl.unrealized,
        totalStockGain: stockGl.total,
        score: rankingScore(s, p),
        prevRank: p.prevRank,
        rank: 0,
        rankDelta: null,
      };
    })
    // Standard Mode ranks net worth. Gain/Loss Mode ranks salary-adjusted
    // Market Gain. Net worth, cash, then lower margin break ties.
    .sort((a, b) => b.score - a.score || b.nw - a.nw || b.cash - a.cash || a.margin - b.margin)
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
  if (diff > 0) return { direction: 'up', label: 'Up', difference: diff };
  if (diff < 0) return { direction: 'down', label: 'Down', difference: diff };
  return { direction: 'flat', label: 'Flat', difference: 0 };
}
