// THE MARKET METER — ambient, round-guaranteed market movement.
// 2026-08-21 Market Overhaul, Stage B. Deliberately NOT the literal downloaded
// spec (extreme-only shocks, higher-die bloc selector) — see the Stage A
// report for why: an extreme-only trigger doesn't guarantee regular
// repricing, and the higher-die selector is directionally biased. This
// design instead guarantees exactly one reprice at the end of every
// non-final round, driven by the needle's current zone rather than a rare
// boundary hit.
//
// 2026-09-18 Phase 2 (Options C + A, chosen after a 4-option Phase 1
// investigation): the guaranteed lap-boundary reprice still fires on the
// exact same trigger, but now reads the needle's actual MAGNITUDE, not just
// its bull/neutral/bear zone bucket — a pinned +/-3 produces a visibly
// different outcome than a bare +/-2, where before they were identical. The
// needle also no longer hard-resets to 0 after a Bull/Bear cash-in; it decays
// by 1 toward neutral instead, so a strong trend can persist and compound
// across a few laps rather than vanishing the instant it peaks (see
// moveMeterTowardNeutral). Layered on top: a narrow (non-market-wide) Market
// Event or Fed card now also triggers one extra "ripple" reprice of its own
// when it resolves (triggerCardRipple, called from eventCardResolver's
// finalizeCard) — so the market can now move between laps too, tied to news
// actually happening in the game, not only to a full round passing.

import { IPO_BY_CODE, MOVE_BP, SECTOR_CODES } from '../data';
import type { SectorId } from '../data/types';
import type { Rng } from '../utils/rng';
import { moveSize } from '../utils/formatMoney';
import { moveMeterPrice } from './stockState';
import { canFall, canRise } from './rules';
import { recordMarketSignal } from './marketSignals';
import { spreadDirection } from './rates';
import type { GameState, LogKind } from './types';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

export const METER_MIN = -3;
export const METER_MAX = 3;


export type MeterZone = 'bear' | 'neutral' | 'bull';

/** Player-facing explanation of what the needle will do when the current
    round finishes. The affected sector is intentionally not chosen until
    that moment, so every player sees the same market move resolve together. */
export interface MarketMeterForecast {
  headline: string;
  detail: string;
}

const ALL_SECTORS = Object.keys(SECTOR_CODES) as SectorId[];

function isAtBound(s: GameState, code: string, dir: 1 | -1): boolean {
  return dir === 1 ? !canRise(s, code) : !canFall(s, code);
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

/** Explain the next round-end move without implying that a sector has already
    been selected by an individual dice roll. */
export function marketMeterForecast(meter: number): MarketMeterForecast {
  const zone = meterZone(meter);
  const magnitude = Math.abs(meter);

  if (magnitude >= 3) {
    const direction = zone === 'bull' ? 'rise' : 'fall';
    return {
      headline: `Two random sectors will ${direction} ${moveSize(MOVE_BP.meterStandard)} each.`,
      detail: 'The sectors are selected when the round ends, after every player has taken a turn.',
    };
  }
  if (magnitude === 2) {
    const direction = zone === 'bull' ? 'rise' : 'fall';
    return {
      headline: `One random sector will ${direction} ${moveSize(MOVE_BP.meterAmplified)}.`,
      detail: 'The sector is selected when the round ends, after every player has taken a turn.',
    };
  }
  return {
    headline: `One random sector will move ${moveSize(MOVE_BP.meterStandard)}.`,
    detail: 'The direction and sector are selected when the round ends, after every player has taken a turn.',
  };
}

/** A sector is eligible for a direction if at least one of its companies
    (regular or revealed IPO) isn't already clamped at that direction's bound. */
export function eligibleSectors(s: GameState, dir: 1 | -1): SectorId[] {
  return ALL_SECTORS.filter((sec) =>
    sectorParticipants(s, sec).some((code) => !isAtBound(s, code, dir)));
}

/** Move every participant in a sector (regular companies + revealed IPOs)
    `steps` steps in the given direction, each individually clamped, and
    return the REAL post-clamp delta per code — not the requested `dir*steps`.
    A code already one step from a bound moves less than the rest, and the
    signal recorded from this must reflect what actually happened, the same
    care CardDisplay's "What Actually Moved" confirmation takes for card
    effects. Mirrors the existing card-effect sector handler in
    marketSignals.ts's effectImpacts for the regular-stock part, so "a sector
    moves" means the same thing everywhere in this codebase. */
function moveSector(s: GameState, sec: SectorId, dir: 1 | -1, bp: number): Array<{ code: string; pct: number }> {
  const moved: Array<{ code: string; pct: number }> = [];
  for (const code of sectorParticipants(s, sec)) {
    const r = moveMeterPrice(s, code, dir * bp);
    if (r.delta !== 0) moved.push({ code, pct: r.pct });
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
 * AND magnitude at the moment a round completes (Option C, 2026-09-18).
 *
 * The needle decides direction (as before, 2026-08-22 — Neutral flips a coin,
 * Bull/Bear are fixed) and now ALSO decides how much of the market moves,
 * via |s.meter|:
 *   |1| (Neutral)        -> 1 sector,  1 step  (identical to the original rule)
 *   |2| (Bull/Bear entry) -> 1 sector,  2 steps  ("amplified" — the same sector
 *                            goes deeper, not more of the market)
 *   |3| (pinned)          -> 2 sectors, 1 step each ("broad" — the reaction
 *                            spreads instead of piling onto one sector)
 * Before this, a needle pinned at the hard +/-3 ceiling produced an outcome
 * indistinguishable from a bare +/-2 — the badge's actual number carried no
 * weight beyond which zone it fell in.
 */
export function repriceRoundBoundary(s: GameState, rng: Rng): void {
  if (!s.opts.marketMeter) return;
  const zone = meterZone(s.meter); // captured before any repricing or decay
  const magnitude = Math.abs(s.meter);

  // Neutral has no fixed direction: the rate spread tilts the odds (50/50 at
  // a zero spread). Bull and Bear are fixed: a Bull round must never push a
  // sector down, nor a Bear round up.
  let dir: 1 | -1 = zone === 'bull' ? 1 : zone === 'bear' ? -1 : spreadDirection(s, rng);

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
    const movedSectors = [sec];
    const bp = magnitude === 2 ? MOVE_BP.meterAmplified : MOVE_BP.meterStandard;
    const impacts = moveSector(s, sec, dir, bp);

    // Pinned at the extreme: a second, DIFFERENT sector also reacts (one step),
    // rather than piling a third step onto the first. Falls back to allowing
    // the same sector again only if literally nothing else is eligible.
    if (magnitude >= 3) {
      const rest = eligibleSectors(s, dir).filter((candidate) => candidate !== sec);
      const pool = rest.length > 0 ? rest : eligibleSectors(s, dir);
      if (pool.length > 0) {
        const sec2 = pick(rng, pool);
        movedSectors.push(sec2);
        impacts.push(...moveSector(s, sec2, dir, MOVE_BP.meterStandard));
      }
    }

    if (impacts.length > 0) {
      const magLabel = magnitude === 2 ? ' (amplified)' : magnitude >= 3 ? ' (broad)' : '';
      recordMarketSignal(s, {
        kind: 'market',
        title: `Market Meter — ${zone === 'bull' ? 'Bullish' : zone === 'bear' ? 'Bearish' : 'Neutral'}`,
        summary: `Ambient market move — ${movedSectors.join(' & ')} ${dir === 1 ? 'up' : 'down'}${magLabel}.`,
        impacts,
      });
    }
  }

  // Decays toward Neutral by 1 instead of hard-resetting to 0 (2026-09-18) —
  // a strong trend can now persist and compound across a few laps instead of
  // vanishing the instant it's cashed in once. Applied every lap regardless of
  // zone or whether the repricing above actually moved anything, same as the
  // original unconditional reset was — a lingering +/-1 in Neutral still eases
  // back rather than drifting forever between reprices. Bull/Bear keep their
  // own log line, since crossing back out of a zone (even partway) is the
  // moment that matters to a player watching the badge; Neutral's minor ease
  // isn't curated into the log, matching the original "nothing to reset away
  // from" treatment.
  if (zone === 'bull' || zone === 'bear') {
    moveMeterTowardNeutral(s, 1);
    // "Bullish/Bearish round", never "Bull Run"/"Bear Run" — those name the
    // board spaces at 16/26, a separate mechanic. Keeping the words distinct
    // stops the activity log from using one phrase for two different events.
    addLog(s, `${zone === 'bull' ? 'Bullish' : 'Bearish'} round resolved — Market Meter eases toward Neutral (now ${formatSignedMeterInternal(s.meter)}).`, 'y');
  } else {
    moveMeterTowardNeutral(s, 1);
  }
}

/** Local mirror of utils/marketRegime.ts's formatSignedMeter — this file must
    not import from src/utils (engine stays dependency-free of the UI layer),
    so the one place a log line needs a signed meter string gets its own tiny
    copy rather than a cross-layer import. */
function formatSignedMeterInternal(meter: number): string {
  if (meter > 0) return `+${meter}`;
  if (meter < 0) return `−${Math.abs(meter)}`;
  return '0';
}

/**
 * Option A — Card-Triggered Ripple (2026-09-18, layered with Option C above).
 * A narrow Market Event or Fed card — one that moves a sector, a risk tier, or
 * a single company, never the whole market at once — also stirs ONE more
 * sector when it resolves, using the exact same zone-driven direction and
 * random-sector-pick logic as the guaranteed lap-boundary reprice above (1
 * sector, 1 step — never amplified/broad; the extra move is about FREQUENCY,
 * tied to news actually happening, not about adding more magnitude on top of
 * Option C's).
 *
 * Deliberately its own trigger, independent of the lap boundary: the market
 * can now move mid-lap, between any two players' turns, wherever a qualifying
 * card happens to be drawn — which cards from eventCardResolver.ts's
 * finalizeCard should call this is decided there (whole-market 'all' cards
 * are excluded — they already touch everything, so a bonus ripple would be
 * redundant, not additive).
 */
export function triggerCardRipple(s: GameState, rng: Rng): void {
  if (!s.opts.marketMeter) return;
  const zone = meterZone(s.meter);
  let dir: 1 | -1 = zone === 'bull' ? 1 : zone === 'bear' ? -1 : spreadDirection(s, rng);
  let elig = eligibleSectors(s, dir);
  if (elig.length === 0 && zone === 'neutral') {
    dir = dir === 1 ? -1 : 1;
    elig = eligibleSectors(s, dir);
  }
  if (elig.length === 0) return;
  const sec = pick(rng, elig);
  // The ripple is one standard move. This passed `1` — a step count from the
  // ladder era — which became 1 bp after the percentage redesign, so every
  // ripple silently fell back to the minimum $25 move.
  const impacts = moveSector(s, sec, dir, MOVE_BP.meterStandard);
  if (impacts.length > 0) {
    recordMarketSignal(s, {
      kind: 'market',
      title: `Market Ripple — ${zone === 'bull' ? 'Bullish' : zone === 'bear' ? 'Bearish' : 'Neutral'}`,
      summary: `A drawn card also stirs the wider market — ${sec} ${dir === 1 ? 'up' : 'down'}.`,
      impacts,
    });
  }
}
