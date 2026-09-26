// Percentage-based market model (2026-09-18 redesign).
//
// Replaces the fixed 12-rung dollar ladder (`priceTrack.ts`) with live prices
// that move by basis points. The old model stored a *step index* in
// `s.prices[code]` and mapped it through `LADDER[]`; prices are now the dollar
// amount itself, so every read is direct and every write goes through
// `applyPriceMove` in engine/stockState.ts.
//
// Why a $25 grid rather than exact cents: this is a physical board game first.
// If the transaction price and the displayed price diverge, players can't
// settle a trade by hand. Prices are therefore always whole multiples of $25 —
// the displayed price IS the price, with no hidden remainder.

import type { Risk } from './types';

/** 100 bp = 1%. All percentage moves are expressed in basis points. */
export const BP_PER_UNIT = 10_000;

/** Every price is a whole multiple of this. Displayed price == traded price. */
export const PRICE_GRID = 25;

/** Hard floor. A company can fall to but never below this. */
export const PRICE_FLOOR = 100;

/**
 * Price at which an upward trade-driven crossing queues a global Market Event.
 *
 * Under the old ladder this was the top rung and also a hard cap. It is now a
 * one-way *threshold* only: prices may exceed it, and the trigger re-arms only
 * after a company falls back below (see `stockState.ts`). There is deliberately
 * no hard ceiling — capping the top rung is what made high-risk companies stall
 * out, and the redesign's simulation pass reports observed maximum prices so a
 * cap can be reintroduced with evidence if one turns out to be needed.
 */
export const CEILING_TRIGGER = 5_000;

/** Round a raw dollar amount onto the $25 grid. */
export function roundToGrid(dollars: number): number {
  return Math.round(dollars / PRICE_GRID) * PRICE_GRID;
}

/**
 * Apply a basis-point move to a price, honouring the grid and the floor.
 *
 * A non-zero move always shifts at least one grid step in its own direction.
 * Without that rule a −500 bp move on a $100 company is −$5, which rounds to
 * $0 and leaves the price frozen — the exact "frozen price" failure the
 * redesign brief calls out. The cost is that moves below ~$500 overshoot their
 * nominal percentage (a 5% move on $100 lands as $25, i.e. 25%); this only
 * affects the bottom of the range and self-corrects as the price recovers.
 */
export function applyBasisPoints(price: number, bp: number): number {
  if (bp === 0) return price;
  const moved = roundToGrid(price + (price * bp) / BP_PER_UNIT);
  const next = moved === price ? price + (bp > 0 ? PRICE_GRID : -PRICE_GRID) : moved;
  return Math.max(PRICE_FLOOR, next);
}

/** Percentage change between two prices, for logs and the ticker. */
export function pctChange(before: number, after: number): number {
  return before === 0 ? 0 : ((after - before) / before) * 100;
}

/**
 * Named cause of a price move. Required on every call to `applyPriceMove` —
 * the future upgrade/shield system must distinguish a market-driven decline
 * (protected) from a player's own sale or card choice (never protected), and
 * that intent cannot be recovered from a bare delta.
 */
export type PriceMoveSource =
  | 'weakDemand'
  | 'strongDemand'
  | 'roundMarket'
  | 'rateShock'
  | 'marketEvent'
  | 'fedCard'
  | 'bullRun'
  | 'bearRun'
  | 'bankSale'
  | 'voluntarySale'
  | 'cyberattackChoice'
  | 'regulatoryChoice'
  | 'investorDay'
  | 'ipoGrowth';

/** Player-facing name for each price-move source (logs, tooltips). */
export const PRICE_MOVE_SOURCE_LABEL: Record<PriceMoveSource, string> = {
  weakDemand: 'Weak Demand', strongDemand: 'Strong Demand', roundMarket: 'round-end market move',
  rateShock: 'Bank Rate move',
  marketEvent: 'Market Event', fedCard: 'Fed card', bullRun: 'Bull Run', bearRun: 'Bear Run',
  bankSale: 'bank sale', voluntarySale: 'sale', cyberattackChoice: 'Cyberattack penalty',
  regulatoryChoice: 'Regulatory penalty', investorDay: 'Investor Day', ipoGrowth: 'IPO growth investment',
};

/**
 * Sources a company upgrade's downside protection (and the Market Protection
 * shield) may reduce. Declines a player brings on themselves — selling into
 * the market, or picking their own company as a card's target — are excluded
 * by design. Read by engine/development.ts (the optional Company Upgrades
 * rule); defined here so the source list and the protection rule stay in one
 * place.
 */
export const SHIELDABLE_SOURCES: ReadonlySet<PriceMoveSource> = new Set<PriceMoveSource>([
  'weakDemand', 'roundMarket', 'rateShock', 'marketEvent', 'fedCard', 'bearRun',
]);

/**
 * Starting basis-point values, named so they can be tuned from simulation
 * output rather than hunted down inline. One old ladder step maps to 500 bp
 * and two steps to 1,000 bp, per the redesign brief's initial mapping.
 */
/** The three sizes a round-end market move can take (2026-09-19 round-end
    market rules): one is drawn at random each time. */
export const ROUND_MARKET_BP = [250, 500, 750] as const;

export const MOVE_BP = {
  weakDemand: -500,
  strongDemand: 500,
  meterStandard: 500,
  meterAmplified: 1_000,
  cardStep: 500,
  bankSale: -500,
  investorDay: 500,
  // An IPO grown on Investor Day moves half as far: IPOs already have their
  // own growth investments and milestone payouts (2026-09-20).
  investorDayIpo: 250,
} as const;

/**
 * Bull/Bear Run movement by risk tier. Low-risk companies now sit out a Run
 * entirely in both directions. Under the ladder a Bear Run *raised* low-risk
 * prices by a step (a flight-to-safety rule); the redesign brief specifies
 * 0 / −1,000 / −2,000 bp, so that rise is intentionally gone.
 */
export const RUN_BP: Record<Risk, number> = { Low: 0, Med: 1_000, High: 2_000 };

/** Signed Run move for a risk tier. The `|| 0` keeps a zero tier as +0 rather
    than JavaScript's -0, which is not Object.is-equal to 0 and would surface
    in the UI as "-0.0%". */
export function runBasisPoints(risk: Risk, regime: 'bull' | 'bear'): number {
  return (regime === 'bull' ? RUN_BP[risk] : -RUN_BP[risk]) || 0;
}

/** Revealed IPOs move with the market at the standard one-step magnitude. */
export const IPO_RUN_BP = MOVE_BP.cardStep;

/**
 * Haircut when selling shares back to the bank (rulebook §11).
 *
 * The ladder paid "one rung below market", which was wildly uneven — a 60%
 * haircut at $250 but 20% at $5,000, purely an artifact of uneven rung
 * spacing. No single percentage reproduces that curve, so this is the one
 * conversion in the redesign that required a judgment call: 20% matches the
 * old haircut across the mid and upper range where most sales actually happen,
 * and removes the punitive cliff at the bottom.
 */
export const SELL_BACK_HAIRCUT_BP = 2_000;
