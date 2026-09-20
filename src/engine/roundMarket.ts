// THE ROUND-END MARKET (2026-09-19 rules) — the only source of broad market
// movement, and it fires exactly once per completed round.
//
// This replaced the dice-driven Market Meter. A player's dice roll now moves
// their piece and nothing else: it does not push a bull/bear needle, and no
// card triggers an extra random "ripple". At the end of every non-final round
// the market resolves once:
//
//   1. the marker is set Bullish or Bearish, 50/50;
//   2. one eligible sector is drawn;
//   3. one move size is drawn — 2.5%, 5% or 7.5% (250/500/750 bp);
//   4. every regular company in that sector moves by it, up on Bullish and
//      down on Bearish, and so does every REVEALED IPO in that sector.
//
// The marker then stays visible as the result of the round just finished,
// until the next round-end resolution replaces it.
//
// Cards, Weak/Strong Demand, bank sales and every other company-specific rule
// still work exactly as written — they move only what they name. The board's
// Bull Run and Bear Run spaces stay a separate mechanic.

import { IPO_BY_CODE, METER_RATE_NUDGE_BP, RATE_NUDGE_EVERY_N_ROUNDS, ROUND_MARKET_BP, SECTOR_CODES, SECTORS } from '../data';
import type { SectorId } from '../data/types';
import type { Rng } from '../utils/rng';
import { moveSize } from '../utils/formatMoney';
import { moveRoundMarketPrice } from './stockState';
import { canFall, canRise } from './rules';
import { recordMarketSignal } from './marketSignals';
import { changeBankRate } from './rates';
import type { GameState, LogKind } from './types';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

export type MarketDirection = 'bull' | 'bear';

const ALL_SECTORS = Object.keys(SECTOR_CODES) as SectorId[];

function isAtBound(s: GameState, code: string, dir: 1 | -1): boolean {
  return dir === 1 ? !canRise(s, code) : !canFall(s, code);
}

/**
 * Every code that takes part in a sector's round-end move: the regular
 * companies (always) plus any REVEALED IPO whose own sector matches.
 * Unrevealed IPOs never move — the same rule card effects already follow.
 */
function sectorParticipants(s: GameState, sec: SectorId): string[] {
  const revealedIpos = s.ipos.filter((ip) => ip.revealed && IPO_BY_CODE[ip.code]?.sector === sec).map((ip) => ip.code);
  return [...SECTOR_CODES[sec], ...revealedIpos];
}

/** A sector is eligible in a direction when at least one of its companies
    (regular or revealed IPO) is not already clamped at that bound. */
export function eligibleSectors(s: GameState, dir: 1 | -1): SectorId[] {
  return ALL_SECTORS.filter((sec) =>
    sectorParticipants(s, sec).some((code) => !isAtBound(s, code, dir)));
}

/** Move every participant in a sector, each individually clamped, and return
    the REAL post-clamp change per code — a company one step from the floor
    moves less than the rest, and what is reported must be what happened. */
function moveSector(s: GameState, sec: SectorId, dir: 1 | -1, bp: number): Array<{ code: string; pct: number }> {
  const moved: Array<{ code: string; pct: number }> = [];
  for (const code of sectorParticipants(s, sec)) {
    const r = moveRoundMarketPrice(s, code, dir * bp);
    if (r.delta !== 0) moved.push({ code, pct: r.pct });
  }
  return moved;
}

function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[rng.int(0, arr.length - 1)];
}

/** What the next round-end resolution can do. Nothing is decided in advance:
    direction, sector and size are all drawn when the round completes. */
export function roundMarketForecast(): { headline: string; detail: string } {
  return {
    headline: `One random sector will move ${ROUND_MARKET_BP.map((bp) => moveSize(bp)).join(', ')} — up or down.`,
    detail: 'Bullish or Bearish is a coin flip, and the sector and size are drawn when the round ends, after every player has taken a turn. Your dice roll moves your piece only.',
  };
}

/**
 * Resolve the market for a completed round. Called at the round boundary for
 * every non-final round. Makes exactly three random draws — direction, size,
 * sector — so a seeded game stays reproducible.
 */
export function resolveRoundEndMarket(s: GameState, rng: Rng): void {
  if (!s.opts.roundMarket) return;

  const direction: MarketDirection = rng.int(0, 1) === 0 ? 'bull' : 'bear';
  const bp = pick(rng, ROUND_MARKET_BP);
  const dir: 1 | -1 = direction === 'bull' ? 1 : -1;

  // Every company in the drawn direction can be clamped (a Bearish round with
  // the whole market already at the $100 floor). The marker still records the
  // round's direction; no sector moves.
  const elig = eligibleSectors(s, dir);
  const sec = elig.length > 0 ? pick(rng, elig) : null;
  const impacts = sec ? moveSector(s, sec, dir, bp) : [];

  s.marketRound = { direction, sector: sec, bp, lap: s.lap };

  const label = direction === 'bull' ? 'Bullish' : 'Bearish';
  const sectorName = sec ? SECTORS[sec].name : null;
  if (sec && impacts.length > 0) {
    addLog(s, `Round ends ${label} — ${sectorName} ${direction === 'bull' ? 'rises' : 'falls'} ${moveSize(bp)}.`, direction === 'bull' ? 'g' : 'r');
  } else {
    addLog(s, `Round ends ${label} — no sector could move ${direction === 'bull' ? 'up' : 'down'} any further.`, 'y');
  }
  recordMarketSignal(s, {
    kind: 'market',
    title: `Round-End Market — ${label}`,
    summary: sec
      ? `The round closed ${label}. ${sectorName} ${direction === 'bull' ? 'up' : 'down'} ${moveSize(bp)}; every other sector is unchanged.`
      : `The round closed ${label}, but every sector was already at its limit in that direction.`,
    impacts,
  });

  // A hot round invites tightening and a cold one invites easing: the Bank
  // Rate follows the marker, but only on every RATE_NUDGE_EVERY_N_ROUNDS
  // round (2026-09-19) — nudging every round moved it two to three times as
  // often as the Fed cards did, which made the cards feel like noise.
  // Borrowing costs only; no price moves either way.
  if (s.lap % RATE_NUDGE_EVERY_N_ROUNDS === 0) {
    const before = s.bankRateBp;
    const actual = changeBankRate(s, direction === 'bull' ? METER_RATE_NUDGE_BP : -METER_RATE_NUDGE_BP);
    if (actual !== 0) {
      addLog(s, `${label} round — the Bank Rate ${actual > 0 ? 'rises' : 'falls'} ${before / 100}% → ${s.bankRateBp / 100}%.`, 'y');
    }
  }
}
