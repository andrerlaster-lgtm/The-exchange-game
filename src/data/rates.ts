// Bank Rate, Market Rate, and the spread between them (2026-09-19).
//
// The Bank Rate is the game's policy interest rate. Fed cards move it, and it
// sets what every loan costs: Outstanding Fees, emergency company loans,
// Margin, and (plus a rolled premium) player loans. A change in the rate also
// moves the rate-sensitive parts of the market: banks earn more when rates
// rise, while property and high-risk growth companies pay more to borrow.
//
// The Market Rate is the market's return, read from the Market Meter needle.
// Market Rate − Bank Rate is the spread: a positive spread means stocks are
// beating cash, so undirected (Neutral-zone) market moves lean up; a negative
// spread leans them down.
//
// Every rate is in basis points (100 bp = 1%) per player turn, matching how
// the game already quotes loan and fee interest.

import type { Risk, SectorId } from './types';

export const BANK_RATE_START_BP = 300;
export const BANK_RATE_MIN_BP = 100;
export const BANK_RATE_MAX_BP = 800;

/** The Market Rate at a Neutral (0) Market Meter. Equal to the starting Bank
    Rate, so a fresh game opens with a spread of zero. */
export const MARKET_RATE_NEUTRAL_BP = 300;
/** Market Rate change per Market Meter point: −3 → 0%, +3 → 6%. */
export const MARKET_RATE_PER_METER_BP = 100;

/** Price move, in bp, per 1 bp change in the Bank Rate. A +50 bp hike moves
    Finance +500 bp and Real Estate and High-Risk stocks −500 bp each; a
    company that is both Real Estate and High-Risk takes both moves. */
export const RATE_SENSITIVITY_BY_SECTOR: Partial<Record<SectorId, number>> = { finance: 10, realestate: -10 };
export const RATE_SENSITIVITY_BY_RISK: Partial<Record<Risk, number>> = { High: -10 };

/** The price moves a Bank Rate change of `rateBp` causes. */
export function rateShockMoves(rateBp: number): Array<{ sec?: SectorId; risk?: Risk; bp: number }> {
  if (rateBp === 0) return [];
  return [
    ...Object.entries(RATE_SENSITIVITY_BY_SECTOR).map(([sec, k]) => ({ sec: sec as SectorId, bp: rateBp * k! })),
    ...Object.entries(RATE_SENSITIVITY_BY_RISK).map(([risk, k]) => ({ risk: risk as Risk, bp: rateBp * k! })),
  ];
}

/** The Bank Rate the Market Meter nudges at each round boundary: a hot
    (Bullish) market invites tightening, a cold (Bearish) one invites easing.
    Neutral rounds leave it alone. */
export const METER_RATE_NUDGE_BP = 25;

/** Outstanding Fees and emergency company loans charge this much over the
    Bank Rate: 5% per turn at the starting 3% rate, as before. */
export const FEE_DEBT_SPREAD_BP = 200;
export const COMPANY_LOAN_SPREAD_BP = 200;

/** Player Loan premium over the Bank Rate, by the creditor's d6 roll. */
export const PLAYER_LOAN_PREMIUM_BY_ROLL_BP = [0, 100, 100, 200, 200, 300, 300]; // index = roll 1-6

/** Chance an undirected market move goes up, given the spread: 50% at a zero
    spread, +/-1 percentage point per 8 bp, held between 20% and 80%. */
export function spreadUpChance(spreadBp: number): number {
  return Math.min(0.8, Math.max(0.2, 0.5 + spreadBp / 800));
}
