// Company development (upgrades) on the percentage market — 2026-09-19.
//
// A Controller can invest in a regular company they control for a bigger
// Payout Claim, a small flat Market Open bonus, and reduced downside from
// external market declines. Values are the plan's starting numbers, kept here
// as named constants so the simulation can tune them without hunting.

export type DevelopmentLevel = 0 | 1 | 2 | 3;

export interface UpgradeLevelDef {
  level: 1 | 2 | 3;
  numeral: 'Ⅰ' | 'Ⅱ' | 'Ⅲ';
  cost: number;            // cost of THIS level
  totalInvested: number;   // cumulative spend once this level is reached
  claimBonus: number;      // total flat Payout Claim bonus at this level
  marketOpenBonus: number; // total flat Market Open bonus at this level
  downsidePct: number;     // share of each eligible external decline removed at this level
}

// Downside protection is PROPORTIONAL (2026-09-19 rebalance). The first pass
// subtracted a flat 200/400/600 bp; Level III's 600 bp exceeded every standard
// 500 bp decline, so Weak Demand, normal Meter moves, and single-step cards
// could never lower a Level III company while every rise still landed — a
// one-way ratchet that drove those companies 60-132% above opening in the
// simulation. Removing a share of each decline keeps every decline real.
//
// Claim bonuses were halved (from $750/$1,500/$2,500) after the 20-round
// simulation: at the original values, upgraded companies raised Payout Claim
// shortfalls from 1-3 to 16-29 per 24 games. Halving roughly halved that excess;
// the rest comes from upgrade spending itself, not the bonus.
//
// Market Open bonuses were raised 2.5x (from $100/$200/$300). Paired
// simulation showed upgrading cost the upgrader $4,500-7,100 of net worth at
// every player count, but a 6x bonus recovered only ~$850 of it: upgraded
// companies are usually force-sold below control (6 -> 5 shares) before they
// earn many Market Opens. The raise is deliberately moderate because careful
// human players keep upgrades far longer than the simulation bot does.
export const UPGRADE_LEVELS: readonly UpgradeLevelDef[] = [
  { level: 1, numeral: 'Ⅰ', cost: 2_000, totalInvested: 2_000, claimBonus: 400, marketOpenBonus: 250, downsidePct: 20 },
  { level: 2, numeral: 'Ⅱ', cost: 4_000, totalInvested: 6_000, claimBonus: 800, marketOpenBonus: 500, downsidePct: 40 },
  { level: 3, numeral: 'Ⅲ', cost: 5_000, totalInvested: 11_000, claimBonus: 1_250, marketOpenBonus: 750, downsidePct: 60 },
];

export const MAX_DEVELOPMENT_LEVEL = 3;

/**
 * Cash a player must still hold AFTER paying for an upgrade or a shield.
 * Simulation sweeps of claim bonus, shield price, and upgrade cost all showed
 * the extra Payout Claim shortfalls came from players spending the cash they
 * later needed for claims, not from any price. A floor sweep then showed
 * $10,000 on upgrades alone barely helped (52 shortfalls vs 16 with upgrades
 * off, 24 games per player count); $20,000 covering shields as well came
 * closest (27).
 */
export const DEVELOPMENT_MIN_CASH_AFTER = 20_000;

/** The benefits a company has at a given level (level 0 = Base, no benefits). */
export function upgradeLevel(level: DevelopmentLevel): UpgradeLevelDef | null {
  return level === 0 ? null : UPGRADE_LEVELS[level - 1];
}

/** Market Protection shield. Raised from $750 after the 20-round simulation:
    at $750 the shield was the cheapest way to keep an upgraded company
    drifting upward. A price sweep showed the price does not move Payout Claim
    shortfalls either way; it trims how often shields are bought. */
export const SHIELD_COST = 1_500;
/** A shield absorbs up to this much of the next eligible external decline. */
export const SHIELD_ABSORB_BP = 500;

/** Share of total upgrade spending refunded to the funder on control loss. */
export const DEVELOPMENT_REFUND_RATE = 0.4;

export function developmentRefund(totalInvested: number): number {
  return Math.round(totalInvested * DEVELOPMENT_REFUND_RATE);
}
