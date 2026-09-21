// THE ROUND-END MARKET — the only source of broad market movement, and it
// resolves exactly once per completed round.
//
// MARKET THEMES (2026-09-20) are the live rule. A theme is drawn as each round
// begins and named at the table: it lists tailwind sectors and headwind
// sectors, so everyone trades all round knowing what the close will reward.
// At the round end every PUBLIC company (one that has had at least one share
// leave the bank) in a tailwind sector rises and every one in a headwind
// sector falls, 5% scaled by risk tier — 2.5% Low, 5% Med, 7.5% High.
//
// The dice path below is what themes replaced, and stays as the fallback for
// a state with no theme live (resolveRoundEndMarket tries the theme first).
// It reads the whole round's dice together:
//
//   1. the FIRST dice are TOTALLED and wrapped to six, which picks the market
//      bloc (see MARKET_BLOCS). Totalling keeps every bloc equally likely at
//      any table size; averaging did not — the average of six dice sits in
//      the middle nearly every round, so faces 3 and 4 took 84% of rounds at
//      six players and faces 1 and 6 never came up at all.
//   2. the SECOND dice's average sets the move: below 3.5 is Bearish, above is
//      Bullish, exactly 3.5 holds the market flat, and how lopsided the round
//      was — measured against how far a round of that many dice usually
//      wanders — chooses 2.5%, 5% or 7.5% (see MOVE_DIE_BANDS);
//   3. every regular company in that bloc moves by it, and so does every
//      REVEALED IPO in it.
//
// So no one roll decides anything, but every roll counts toward what the
// market does — and the running averages are visible all round, so the table
// can see where the market is heading. The marker then stays visible as the
// result of the round just finished.
//
// Cards, Weak/Strong Demand, bank sales and every other company-specific rule
// still work exactly as written — they move only what they name. The board's
// Bull Run and Bear Run spaces stay a separate mechanic.

import {
  DIE_SPREAD, IPO_BY_CODE, MARKET_BLOCS, MARKET_THEMES, METER_RATE_NUDGE_BP, MOVE_DIE_BANDS, MOVE_DIE_MIDPOINT,
  RATE_NUDGE_EVERY_N_ROUNDS, SECTOR_CODES, SECTORS,
} from '../data';
import { STOCK_BY_CODE } from '../data/stocks';
import type { Rng } from '../utils/rng';
import type { SectorId } from '../data/types';
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

export type MarketDirection = 'bull' | 'bear' | 'flat';

/** Reveal the next theme before its round begins. A theme never affects an
 * untouched company: it first has to have at least one share removed from the
 * initial bank supply, which is the game's permanent "public" signal. */
export function beginMarketTheme(s: GameState, rng: Rng): void {
  const theme = MARKET_THEMES[rng.int(0, MARKET_THEMES.length - 1)];
  s.marketTheme = { ...theme, tailwinds: [...theme.tailwinds], headwinds: [...theme.headwinds], lap: s.lap };
  addLog(s, `Market Theme: ${theme.name}. Tailwinds: ${theme.tailwinds.map((x) => SECTORS[x].name).join(', ')}. Headwinds: ${theme.headwinds.map((x) => SECTORS[x].name).join(', ')}.`, 'y');
}

/** A hot round invites tightening and a cold one invites easing: the Bank Rate
    follows the round's result, but only on every RATE_NUDGE_EVERY_N_ROUNDS
    round — nudging every round moved it two to three times as often as the Fed
    cards did. Borrowing costs only; no price moves either way. Both round-end
    paths call this: the themes took over the round end and, until this was
    pulled out, quietly took the rate nudge with it. */
function nudgeBankRate(s: GameState, direction: MarketDirection): void {
  if (direction === 'flat' || s.lap % RATE_NUDGE_EVERY_N_ROUNDS !== 0) return;
  const before = s.bankRateBp;
  const actual = changeBankRate(s, direction === 'bull' ? METER_RATE_NUDGE_BP : -METER_RATE_NUDGE_BP);
  if (actual !== 0) {
    const label = direction === 'bull' ? 'Bullish' : 'Bearish';
    addLog(s, `${label} round — the Bank Rate ${actual > 0 ? 'rises' : 'falls'} ${before / 100}% → ${s.bankRateBp / 100}%.`, 'y');
  }
}

function resolveMarketTheme(s: GameState): boolean {
  const theme = s.marketTheme;
  if (!theme) return false;
  const impacts: Array<{ code: string; pct: number }> = [];
  const move = (sectors: readonly SectorId[], dir: 1 | -1) => {
    for (const sector of sectors) for (const code of SECTOR_CODES[sector]) {
      // supply only falls on the first bank purchase / buyout, so it keeps a
      // company public even when every share later changes hands.
      if ((s.supply[code] ?? 0) >= 11) continue;
      const risk = STOCK_BY_CODE[code].risk;
      const multiplier = risk === 'Low' ? 0.5 : risk === 'High' ? 1.5 : 1;
      const r = moveRoundMarketPrice(s, code, dir * 500 * multiplier);
      if (r.delta) impacts.push({ code, pct: r.pct });
    }
  };
  move(theme.tailwinds, 1); move(theme.headwinds, -1);
  // A theme lifts one set of sectors and presses on another, so the round's
  // direction is the NET of what actually moved — not "bull because something
  // rose", which every theme would satisfy.
  const net = impacts.reduce((sum, x) => sum + x.pct, 0);
  const direction: MarketDirection = net > 0 ? 'bull' : net < 0 ? 'bear' : 'flat';
  s.marketRound = { direction, bloc: theme.name, sectors: [...theme.tailwinds, ...theme.headwinds], bp: 500, sectorTotal: 0, moveAvg: null, lap: s.lap };
  recordMarketSignal(s, { kind: 'market', title: `Market Theme — ${theme.name}`, summary: `${theme.tailwinds.map((x) => SECTORS[x].name).join(' & ')} gained while ${theme.headwinds.map((x) => SECTORS[x].name).join(' & ')} fell. Only public companies moved.`, impacts });
  addLog(s, `Market Theme resolves — ${theme.name}.`, 'y');
  s.marketTheme = null;
  nudgeBankRate(s, direction);
  resetRoundDice(s);
  return true;
}

/** What the round's dice so far say the market will do. Everything here is
    derived — the tally is the only state. */
export interface RoundMarketReading {
  rolls: number;
  sectorTotal: number;        // total of the first dice
  moveAvg: number | null;     // average of the second dice
  face: number | null;        // sectorTotal wrapped to a d6 face
  z: number;                  // how lopsided the move dice were, in typical wanders
  blocName: string | null;
  sectors: SectorId[];
  direction: MarketDirection;
  bp: number;
}

function isAtBound(s: GameState, code: string, dir: 1 | -1): boolean {
  return dir === 1 ? !canRise(s, code) : !canFall(s, code);
}

/**
 * Every code that takes part in a bloc's round-end move: the regular
 * companies in its sectors (always) plus any REVEALED IPO in them.
 * Unrevealed IPOs never move — the same rule card effects already follow.
 */
function blocParticipants(s: GameState, sectors: readonly SectorId[]): string[] {
  const regular = sectors.flatMap((sec) => SECTOR_CODES[sec]);
  const revealedIpos = s.ipos
    .filter((ip) => ip.revealed && sectors.includes(IPO_BY_CODE[ip.code]?.sector))
    .map((ip) => ip.code);
  return [...regular, ...revealedIpos];
}

/** Whether anything in these sectors can still move in this direction. */
export function blocCanMove(s: GameState, sectors: readonly SectorId[], dir: 1 | -1): boolean {
  return blocParticipants(s, sectors).some((code) => !isAtBound(s, code, dir));
}

/** Move every participant, each individually clamped, and return the REAL
    post-clamp change per code — a company one step from the floor moves less
    than the rest, and what is reported must be what happened. */
function moveBloc(s: GameState, sectors: readonly SectorId[], dir: 1 | -1, bp: number): Array<{ code: string; pct: number }> {
  const moved: Array<{ code: string; pct: number }> = [];
  for (const code of blocParticipants(s, sectors)) {
    const r = moveRoundMarketPrice(s, code, dir * bp);
    if (r.delta !== 0) moved.push({ code, pct: r.pct });
  }
  return moved;
}

/** Read the round's dice tally: what the market will do if the round ended
    now. Used by the engine to resolve, and by the UI to show it coming. */
export function readRoundDice(s: GameState): RoundMarketReading {
  const { aSum, bSum, rolls } = s.roundDice;
  if (rolls === 0) {
    return { rolls: 0, sectorTotal: 0, moveAvg: null, face: null, z: 0, blocName: null, sectors: [], direction: 'flat', bp: 0 };
  }
  // Wrapped, not averaged: a sum of dice is uniform modulo six however many
  // were rolled, so every bloc stays equally likely at every table size.
  const face = ((aSum - 1) % 6) + 1;
  const bloc = MARKET_BLOCS.find((b) => b.face === face)!;
  const moveAvg = bSum / rolls;
  const deviation = moveAvg - MOVE_DIE_MIDPOINT;
  const z = deviation / (DIE_SPREAD / Math.sqrt(rolls));
  const direction: MarketDirection = deviation > 0 ? 'bull' : deviation < 0 ? 'bear' : 'flat';
  const band = MOVE_DIE_BANDS.find((b) => Math.abs(z) >= b.minZ)!;
  return {
    rolls, sectorTotal: aSum, moveAvg, face, z,
    blocName: bloc.name,
    sectors: [...bloc.sectors],
    direction,
    bp: direction === 'flat' ? 0 : band.bp,
  };
}

/** Add one movement roll to the round's tally. The dice do nothing else. */
export function tallyRoundDice(s: GameState, a: number, b: number): void {
  s.roundDice = { aSum: s.roundDice.aSum + a, bSum: s.roundDice.bSum + b, rolls: s.roundDice.rolls + 1 };
}

/** Clear the tally as a new round begins. */
export function resetRoundDice(s: GameState): void {
  s.roundDice = { aSum: 0, bSum: 0, rolls: 0 };
}

/** How the round's dice read right now, for the table to see it coming. */
export function roundMarketForecast(s: GameState): { headline: string; detail: string } {
  const r = readRoundDice(s);
  if (r.rolls === 0) {
    return {
      headline: 'The round\'s dice decide the market.',
      detail: 'Every roll counts: the first dice are totalled to pick the market bloc, the second dice averaged to set the move. Nothing happens until the round closes.',
    };
  }
  const where = `${r.blocName} (sector dice total ${r.sectorTotal} → face ${r.face})`;
  const what = r.direction === 'flat'
    ? 'the market holds flat'
    : `${r.blocName} ${r.direction === 'bull' ? 'rises' : 'falls'} ${moveSize(r.bp)}`;
  return {
    headline: `As it stands: ${what}.`,
    detail: `After ${r.rolls} roll${r.rolls === 1 ? '' : 's'} — ${where}, move dice averaging ${r.moveAvg!.toFixed(2)} against a 3.50 midpoint. Every roll left in the round still changes both.`,
  };
}

/**
 * Resolve the market for a completed round, from the round's own dice. Called
 * at the round boundary for every non-final round. Makes no random draws of
 * its own — the dice already rolled are the whole input.
 */
export function resolveRoundEndMarket(s: GameState): void {
  if (!s.opts.roundMarket) return;
  if (resolveMarketTheme(s)) return;
  const reading = readRoundDice(s);
  const { direction, sectors, blocName, bp } = reading;

  if (reading.rolls === 0 || direction === 'flat') {
    s.marketRound = { direction: 'flat', bloc: blocName, sectors: [], bp: 0, sectorTotal: reading.sectorTotal, moveAvg: reading.moveAvg, lap: s.lap };
    addLog(s, reading.rolls === 0
      ? 'Round ends with no rolls — the market holds.'
      : `Round ends flat — the move die averaged exactly ${MOVE_DIE_MIDPOINT.toFixed(2)}.`, 'y');
    resetRoundDice(s);
    return;
  }

  const dir: 1 | -1 = direction === 'bull' ? 1 : -1;
  const canMove = blocCanMove(s, sectors, dir);
  const impacts = canMove ? moveBloc(s, sectors, dir, bp) : [];

  s.marketRound = {
    direction, bloc: blocName, sectors, bp,
    sectorTotal: reading.sectorTotal, moveAvg: reading.moveAvg, lap: s.lap,
  };

  const label = direction === 'bull' ? 'Bullish' : 'Bearish';
  const dice = `sector dice ${reading.sectorTotal} → face ${reading.face}, move dice averaged ${reading.moveAvg!.toFixed(2)} over ${reading.rolls} rolls`;
  if (impacts.length > 0) {
    addLog(s, `Round ends ${label} — ${blocName} ${direction === 'bull' ? 'rises' : 'falls'} ${moveSize(bp)} (${dice}).`, direction === 'bull' ? 'g' : 'r');
  } else {
    addLog(s, `Round ends ${label} — ${blocName} could not move ${direction === 'bull' ? 'up' : 'down'} any further (${dice}).`, 'y');
  }
  recordMarketSignal(s, {
    kind: 'market',
    title: `Round-End Market — ${label}`,
    summary: impacts.length > 0
      ? `The round's dice closed ${label}: ${sectors.map((sec) => SECTORS[sec].name).join(' and ')} ${direction === 'bull' ? 'up' : 'down'} ${moveSize(bp)}. Every other sector is unchanged.`
      : `The round's dice closed ${label} on ${blocName}, but it was already at its limit in that direction.`,
    impacts,
  });

  nudgeBankRate(s, direction);
  resetRoundDice(s);
}
