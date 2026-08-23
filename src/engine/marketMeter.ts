// THE MARKET METER — ambient, round-guaranteed market movement.
// 2026-08-21 Market Overhaul, Stage B. Deliberately NOT the literal downloaded
// spec (extreme-only shocks, higher-die bloc selector) — see the Stage A
// report for why: an extreme-only trigger doesn't guarantee regular
// repricing, and the higher-die selector is directionally biased. This
// design instead guarantees exactly one reprice at the end of every
// non-final round, driven by the needle's current zone rather than a rare
// boundary hit.

import { IPO_BY_CODE, LADDER, SECTOR_CODES } from '../data';
import type { SectorId } from '../data/types';
import type { Rng } from '../utils/rng';
import { moveMeterPrice } from './stockState';
import { stepOf } from './rules';
import { recordMarketSignal } from './marketSignals';
import type { GameState, LogKind } from './types';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

export const METER_MIN = -3;
export const METER_MAX = 3;

/** Ladder ceiling step index — same constant stockState's CEILING_STEP derives from. */
const CEILING_STEP = LADDER.length - 1;

export type MeterZone = 'bear' | 'neutral' | 'bull';

const ALL_SECTORS = Object.keys(SECTOR_CODES) as SectorId[];

function isAtBound(s: GameState, code: string, dir: 1 | -1): boolean {
  const step = stepOf(s, code);
  return dir === 1 ? step >= CEILING_STEP : step <= 0;
}

/**
 * Every code that participates in a sector's meter move: the regular
 * companies (always) plus any revealed IPO whose own sector matches
 * (unrevealed IPOs never participate — same rule moveEventPrice already
 * applies to card effects). SECTOR_CODES itself only lists regular stocks,
 * so this is the one place IPO participation actually happens — it is not
 * automatic just because moveMeterPrice knows how to move an IPO's step.
 */
function sectorParticipants(s: GameState, sec: SectorId): string[] {
  const revealedIpos = s.ipos.filter((ip) => ip.revealed && IPO_BY_CODE[ip.code]?.sector === sec).map((ip) => ip.code);
  return [...SECTOR_CODES[sec], ...revealedIpos];
}

/**
 * Apply a card's one-time meter sentiment. Additive and clamped, same bounds
 * as roll-driven movement — a card nudges the needle toward a mood; it never
 * invokes the round-boundary repricing routine itself (that stays exclusively
 * round-triggered, per the approved Market Overhaul contract).
 */
export function applyMeterSentiment(s: GameState, delta: number): void {
  if (!delta) return;
  s.meter = Math.max(METER_MIN, Math.min(METER_MAX, s.meter + delta));
}

/** Move the needle toward 0 by `amount`, never overshooting past neutral. */
export function moveMeterTowardNeutral(s: GameState, amount: number): void {
  if (amount <= 0 || s.meter === 0) return;
  s.meter = s.meter > 0 ? Math.max(0, s.meter - amount) : Math.min(0, s.meter + amount);
}

/** Zone read off the needle's current position. */
export function meterZone(pos: number): MeterZone {
  if (pos <= -2) return 'bear';
  if (pos >= 2) return 'bull';
  return 'neutral';
}

/** A sector is eligible for a direction if at least one of its companies
    (regular or revealed IPO) isn't already clamped at that direction's bound. */
export function eligibleSectors(s: GameState, dir: 1 | -1): SectorId[] {
  return ALL_SECTORS.filter((sec) =>
    sectorParticipants(s, sec).some((code) => !isAtBound(s, code, dir)));
}

/** Move every participant in a sector (regular companies + revealed IPOs)
    one step in the given direction, each individually clamped. Mirrors the
    existing card-effect sector handler in marketSignals.ts's effectImpacts
    for the regular-stock part, so "a sector moves" means the same thing
    everywhere in this codebase. */
function moveSector(s: GameState, sec: SectorId, dir: 1 | -1): string[] {
  const moved: string[] = [];
  for (const code of sectorParticipants(s, sec)) {
    const before = stepOf(s, code);
    moveMeterPrice(s, code, dir);
    if (stepOf(s, code) !== before) moved.push(code);
  }
  return moved;
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(0, arr.length - 1)];
}

/** Advance the needle on a completed roll. Reads dice the engine already
    rolled — makes no new rng calls, so seeded games stay reproducible. */
export function advanceMeterOnRoll(s: GameState, a: number, b: number): void {
  if (!s.opts.marketMeter) return;
  const sum = a + b;
  if (sum === 7) return; // 7 holds
  s.meter = Math.max(METER_MIN, Math.min(METER_MAX, s.meter + (sum >= 8 ? 1 : -1)));
}

/**
 * Guaranteed once-per-non-final-round reprice, driven by the needle's zone
 * at the moment a round completes.
 *
 * EXACTLY ONE sector moves, in every zone. The needle decides only the
 * DIRECTION of that move, never how much of the market gets touched
 * (2026-08-22). Neutral previously moved two sectors — one up and one down —
 * which made the supposedly calm state churn twice as many companies as a
 * Bull or Bear round, the opposite of what the labels imply.
 *
 * A Bull or Bear zone captured here also resets the meter to Neutral after
 * its (best-effort) repricing attempt — 2026-08-21 Add Persistent Market
 * Regime Display and Reset — so the market can never stay trapped in one
 * condition for the whole game, even when every eligible company was already
 * clamped and nothing actually moved. Neutral does not reset: there is
 * nothing to reset away from.
 */
export function repriceRoundBoundary(s: GameState, rng: Rng): void {
  if (!s.opts.marketMeter) return;
  const zone = meterZone(s.meter); // captured before any repricing or reset

  // Neutral has no directional bias, so it flips a coin. Bull and Bear are
  // fixed: a Bull round must never push a sector down, nor a Bear round up.
  let dir: 1 | -1 = zone === 'bull' ? 1 : zone === 'bear' ? -1 : (rng.int(0, 1) === 0 ? 1 : -1);

  let elig = eligibleSectors(s, dir);
  // Only Neutral may flip: its direction was arbitrary to begin with, so if
  // that side of the market is fully clamped it should still deliver the
  // round's guaranteed move rather than silently no-op. Bull/Bear keep their
  // direction and simply do nothing if it is exhausted.
  if (elig.length === 0 && zone === 'neutral') {
    dir = dir === 1 ? -1 : 1;
    elig = eligibleSectors(s, dir);
  }

  if (elig.length > 0) {
    const sec = pick(rng, elig);
    const impacts: Array<{ code: string; d: number }> = [];
    for (const code of moveSector(s, sec, dir)) impacts.push({ code, d: dir });
    if (impacts.length > 0) {
      recordMarketSignal(s, {
        kind: 'market',
        title: `Market Meter — ${zone === 'bull' ? 'Bullish' : zone === 'bear' ? 'Bearish' : 'Neutral'}`,
        summary: `Ambient market move — ${sec} ${dir === 1 ? 'up' : 'down'}.`,
        impacts,
      });
    }
  }

  if (zone === 'bull' || zone === 'bear') {
    // Reset regardless of whether the attempted repricing above actually
    // moved anything. No additional price move, card draw, stance payout,
    // RNG use, or Important Event; just the meter snapping to 0 and an
    // ordinary (non-curated) log line recording it.
    s.meter = 0;
    // "Bullish/Bearish round", never "Bull Run"/"Bear Run" — those name the
    // board spaces at 16/26, a separate mechanic. Keeping the words distinct
    // stops the activity log from using one phrase for two different events.
    addLog(s, `${zone === 'bull' ? 'Bullish' : 'Bearish'} round resolved — Market Meter returned to Neutral.`, 'y');
  }
}
