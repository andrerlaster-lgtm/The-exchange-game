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
  downsideBp: number;      // total external-decline reduction at this level
}

export const UPGRADE_LEVELS: readonly UpgradeLevelDef[] = [
  { level: 1, numeral: 'Ⅰ', cost: 2_000, totalInvested: 2_000, claimBonus: 750, marketOpenBonus: 100, downsideBp: 200 },
  { level: 2, numeral: 'Ⅱ', cost: 4_000, totalInvested: 6_000, claimBonus: 1_500, marketOpenBonus: 200, downsideBp: 400 },
  { level: 3, numeral: 'Ⅲ', cost: 5_000, totalInvested: 11_000, claimBonus: 2_500, marketOpenBonus: 300, downsideBp: 600 },
];

export const MAX_DEVELOPMENT_LEVEL = 3;

/** The benefits a company has at a given level (level 0 = Base, no benefits). */
export function upgradeLevel(level: DevelopmentLevel): UpgradeLevelDef | null {
  return level === 0 ? null : UPGRADE_LEVELS[level - 1];
}

/** Market Protection shield. */
export const SHIELD_COST = 750;
/** A shield absorbs up to this much of the next eligible external decline. */
export const SHIELD_ABSORB_BP = 500;

/** Share of total upgrade spending refunded to the funder on control loss. */
export const DEVELOPMENT_REFUND_RATE = 0.4;

export function developmentRefund(totalInvested: number): number {
  return Math.round(totalInvested * DEVELOPMENT_REFUND_RATE);
}
