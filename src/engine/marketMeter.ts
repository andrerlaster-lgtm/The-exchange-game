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
 * at the moment a round completes. A Bull or Bear zone captured here always
 * resets the meter to Neutral after its (best-effort) repricing attempt —
 * 2026-08-21 Add Persistent Market Regime Display and Reset — so the market
 * can never stay trapped in one condition for the whole game, even when
 * every eligible company was already clamped and nothing actually moved.
 * Neutral rounds keep their pre-existing behavior unchanged: no reset,
 * because there is nothing to reset away from.
 */
export function repriceRoundBoundary(s: GameState, rng: Rng): void {
  if (!s.opts.marketMeter) return;
  const zone = meterZone(s.meter); // captured before any repricing or reset
  const parts: string[] = [];
  const impacts: Array<{ code: string; d: number }> = [];

  if (zone === 'bull' || zone === 'bear') {
    const dir: 1 | -1 = zone === 'bull' ? 1 : -1;
    const elig = eligibleSectors(s, dir);
    if (elig.length > 0) {
      const sec = pick(rng, elig);
      for (const code of moveSector(s, sec, dir)) impacts.push({ code, d: dir });
      if (impacts.length > 0) {
        parts.push(`${sec} ${dir === 1 ? 'up' : 'down'}`);
        recordMarketSignal(s, {
          kind: 'market',
          title: `Market Meter — ${zone === 'bull' ? 'Bullish' : 'Bearish'}`,
          summary: `Ambient market move — ${parts.join(', ')}.`,
          impacts,
        });
      }
    }
    // Reset regardless of whether the attempted repricing above actually
    // moved anything — see the function comment. No additional price move,
    // card draw, stance payout, RNG use, or Important Event; just the meter
    // snapping to 0 and an ordinary (non-curated) log line recording it.
    s.meter = 0;
    addLog(s, `${zone === 'bull' ? 'Bull Run' : 'Bear Run'} resolved; Market Meter returned to Neutral.`, 'y');
    return;
  }

  // Neutral: one eligible sector rises, a different eligible sector falls.
  const up = eligibleSectors(s, 1);
  const down = eligibleSectors(s, -1);
  if (up.length === 0 && down.length === 0) return;

  if (up.length > 0) {
    const upSec = pick(rng, up);
    const moved = moveSector(s, upSec, 1);
    if (moved.length > 0) { parts.push(`${upSec} up`); for (const code of moved) impacts.push({ code, d: 1 }); }
  }
  if (down.length > 0) {
    // Prefer a different sector than the one that just rose, per the design;
    // if it's the only sector eligible for a fall at all, allow the overlap
    // rather than silently skip a promised half of the neutral event.
    const upSecPicked = parts[0]?.split(' ')[0] as SectorId | undefined;
    const downCandidates = upSecPicked ? down.filter((sec) => sec !== upSecPicked) : down;
    const downSec = pick(rng, downCandidates.length > 0 ? downCandidates : down);
    const moved = moveSector(s, downSec, -1);
    if (moved.length > 0) { parts.push(`${downSec} down`); for (const code of moved) impacts.push({ code, d: -1 }); }
  }
  if (impacts.length === 0) return;
  recordMarketSignal(s, {
    kind: 'market',
    title: 'Market Meter — Neutral',
    summary: `Ambient market move — ${parts.join(', ')}.`,
    impacts,
  });
}
