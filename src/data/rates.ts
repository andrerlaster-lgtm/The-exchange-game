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

/** The Market Rate before any round has resolved. Equal to the starting Bank
    Rate, so a fresh game opens with a spread of zero. A finished round adds
    its own move to this: a Bullish 5% round reads 8%, a Bearish one −2%. */
export const MARKET_RATE_NEUTRAL_BP = 300;

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

/** The Bank Rate the round-end marker nudges: a Bullish round invites
    tightening, a Bearish one invites easing. */
export const METER_RATE_NUDGE_BP = 25;

/** How often that nudge happens — every other completed round, so the Fed
    cards stay the main mover of the rate. */
export const RATE_NUDGE_EVERY_N_ROUNDS = 2;

/** Rate Decision space (board 28): the landing player rolls a d6 and the Fed
    follows it — a low roll eases, a high roll tightens, the middle holds. */
export const RATE_DECISION_BY_ROLL_BP = [0, -25, -25, 0, 0, 25, 25]; // index = roll 1-6

/** Outstanding Fees and emergency company loans charge this much over the
    Bank Rate: 5% per turn at the starting 3% rate, as before. */
export const FEE_DEBT_SPREAD_BP = 200;
export const COMPANY_LOAN_SPREAD_BP = 200;

/** Player Loan premium over the Bank Rate, by the creditor's d6 roll. */
export const PLAYER_LOAN_PREMIUM_BY_ROLL_BP = [0, 100, 100, 200, 200, 300, 300]; // index = roll 1-6


// ── Dice-driven round-end market (2026-09-19) ───────────────────────────────
//
// Every movement roll in a round is tallied: the first die feeds the sector,
// the second feeds the move. Neither does anything on its own — they are read
// once, together, when the round closes.

/** The six market blocs the sector die picks from, one per face. Eight
    sectors, so the two thinnest pairs share a face with their nearest
    neighbour and move together. */
export const MARKET_BLOCS = [
  { face: 1, name: 'Tech & Communications', sectors: ['tech', 'comm'] },
  { face: 2, name: 'Consumer', sectors: ['consumer'] },
  { face: 3, name: 'Healthcare', sectors: ['health'] },
  { face: 4, name: 'Energy & Industrials', sectors: ['energy', 'industrials'] },
  { face: 5, name: 'Finance', sectors: ['finance'] },
  { face: 6, name: 'Real Estate', sectors: ['realestate'] },
] as const;

/** The move die reads against the midpoint of a d6. Exactly 3.5 holds. */
export const MOVE_DIE_MIDPOINT = 3.5;

/** Spread of a single d6 (standard deviation, √(35/12)). A round of n rolls
    has an average that typically sits this far over √n from the midpoint, so
    the bands below are measured in those units — otherwise a six-player table
    would almost never pay a big move, since more dice average out flatter. */
export const DIE_SPREAD = Math.sqrt(35 / 12);

/** How lopsided the round was, in units of its own typical wander, and what
    that pays. Scaled this way, 2.5% / 5% / 7.5% stay roughly as likely at a
    two-player table as at a six-player one. */
export const MOVE_DIE_BANDS = [
  { minZ: 1.0, bp: 750 },
  { minZ: 0.4, bp: 500 },
  { minZ: 0, bp: 250 },
] as const;
