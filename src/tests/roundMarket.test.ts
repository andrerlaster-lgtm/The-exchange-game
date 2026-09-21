// THE ROUND-END MARKET (2026-09-19 rules), decided by the round's own dice.
// A single roll moves a piece and nothing else; the round's first dice are
// averaged for the bloc and its second dice for the move, read once when the
// round closes.

import { describe, expect, it } from 'vitest';
import {
  FED_CARDS, IPO_BY_CODE, MARKET_BLOCS, PRICE_FLOOR, STOCK_BY_CODE, applyBasisPoints,
} from '../data';
import { readRoundDice, resolveRoundEndMarket, roundMarketForecast, tallyRoundDice } from '../engine/roundMarket';
import { bankRateBp, marketRateBp } from '../engine';
import type { GameState } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

/** A state whose round tally holds exactly these rolls, with no Market Theme
    live — the dice are the round-end fallback when a theme is not running
    (a theme takes priority; see resolveRoundEndMarket). */
function withRolls(rolls: Array<[number, number]>, extra: (d: GameState) => void = () => {}): GameState {
  return patch(started(2), (d) => {
    d.marketTheme = null;
    for (const [a, b] of rolls) tallyRoundDice(d, a, b);
    extra(d);
  });
}

const resolve = (s: GameState) => patch(s, (d) => { resolveRoundEndMarket(d); });
const blocOf = (face: number) => MARKET_BLOCS.find((b) => b.face === face)!;

describe('reading the round\'s dice', () => {
  it('totals the first dice for the bloc and averages the second for the move', () => {
    // First dice 2 + 4 = 6 → face 6, Real Estate.
    // Second dice 5, 6 → average 5.5 → well above the midpoint → 7.5%.
    const r = readRoundDice(withRolls([[2, 5], [4, 6]]));
    expect(r.rolls).toBe(2);
    expect(r.sectorTotal).toBe(6);
    expect(r.face).toBe(6);
    expect(r.blocName).toBe(blocOf(6).name);
    expect(r.sectors).toEqual(['realestate']);
    expect(r.moveAvg).toBe(5.5);
    expect(r.direction).toBe('bull');
    expect(r.bp).toBe(750);
  });

  it('wraps the sector total to a face, so every bloc stays reachable', () => {
    expect(readRoundDice(withRolls([[1, 1]])).face).toBe(1);
    expect(readRoundDice(withRolls([[6, 1]])).face).toBe(6);
    expect(readRoundDice(withRolls([[6, 1], [1, 1]])).face).toBe(1); // 7 wraps
    expect(readRoundDice(withRolls([[6, 1], [6, 1]])).face).toBe(6); // 12 wraps
    for (const bloc of MARKET_BLOCS) {
      const r = readRoundDice(withRolls([[bloc.face, 1]]));
      expect(r.blocName).toBe(bloc.name);
      expect(r.sectors).toEqual([...bloc.sectors]);
    }
  });

  it('every bloc comes up about as often, at any table size', () => {
    for (const players of [2, 4, 6]) {
      const hits: Record<number, number> = {};
      // Every combination of that many first dice, counted exactly.
      const walk = (left: number, total: number) => {
        if (left === 0) {
          const face = readRoundDice(withRolls([[total, 1]])).face!;
          hits[face] = (hits[face] ?? 0) + 1;
          return;
        }
        for (let die = 1; die <= 6; die++) walk(left - 1, total + die);
      };
      walk(players, 0);
      const counts = Object.values(hits);
      expect(counts).toHaveLength(6);
      expect(Math.min(...counts)).toBe(Math.max(...counts)); // exactly uniform
    }
  });

  it('sizes the move by how lopsided the round was, in both directions', () => {
    const sizeOf = (b: number) => readRoundDice(withRolls([[3, b]]));
    // One roll: a single die wanders 1.71, so +0.5 is an ordinary round.
    expect(sizeOf(4)).toMatchObject({ direction: 'bull', bp: 250 }); // +0.5
    expect(sizeOf(5)).toMatchObject({ direction: 'bull', bp: 500 }); // +1.5
    expect(sizeOf(6)).toMatchObject({ direction: 'bull', bp: 750 }); // +2.5
    expect(sizeOf(3)).toMatchObject({ direction: 'bear', bp: 250 });
    expect(sizeOf(2)).toMatchObject({ direction: 'bear', bp: 500 });
    expect(sizeOf(1)).toMatchObject({ direction: 'bear', bp: 750 });
    // A round whose move dice average exactly 3.5 holds flat.
    expect(readRoundDice(withRolls([[3, 3], [3, 4]]))).toMatchObject({ direction: 'flat', bp: 0 });
  });

  it('scales those bands with the number of rolls', () => {
    // The same 0.5 above the midpoint is an ordinary round for two rolls and
    // a lopsided one for eight, so it pays more at the bigger table.
    const two = readRoundDice(withRolls([[1, 3], [1, 5]]));           // avg 4.0
    const twelve = readRoundDice(withRolls(Array.from({ length: 12 }, (_, i) => [1, i % 2 === 0 ? 3 : 5] as [number, number])));
    expect(two.moveAvg).toBe(4);
    expect(twelve.moveAvg).toBe(4);
    expect(two.bp).toBe(500);
    expect(twelve.bp).toBe(750);
  });

  it('reads as flat with no rolls at all', () => {
    expect(readRoundDice(started(2))).toMatchObject({ rolls: 0, direction: 'flat', bp: 0, blocName: null });
  });
});

describe('resolving a round', () => {
  it('moves every company in the bloc, and nothing else', () => {
    const s = withRolls([[5, 6]]); // total 5 → face 5, Finance; move +2.5 → 7.5% up
    const before = { ...s.prices };
    const t = resolve(s);
    expect(t.marketRound).toMatchObject({ direction: 'bull', bloc: 'Finance', sectors: ['finance'], bp: 750 });
    for (const [code, stock] of Object.entries(STOCK_BY_CODE)) {
      const expected = stock.sector === 'finance' ? applyBasisPoints(before[code], 750) : before[code];
      expect(t.prices[code], code).toBe(expected);
    }
  });

  it('moves both sectors of a two-sector bloc', () => {
    const s = withRolls([[1, 1]]); // face 1 → Tech & Communications, move −2.5 → 7.5% down
    const before = { ...s.prices };
    const t = resolve(s);
    expect([...t.marketRound!.sectors].sort()).toEqual(['comm', 'tech']);
    for (const [code, stock] of Object.entries(STOCK_BY_CODE)) {
      const inBloc = stock.sector === 'tech' || stock.sector === 'comm';
      expect(t.prices[code], code).toBe(inBloc ? applyBasisPoints(before[code], -750) : before[code]);
    }
  });

  it('moves a revealed IPO in the drawn bloc, and never an unrevealed one', () => {
    const base = started(2);
    const ipo = base.ipos[0];
    const bloc = MARKET_BLOCS.find((b) => (b.sectors as readonly string[]).includes(IPO_BY_CODE[ipo.code].sector))!;
    const s = withRolls([[bloc.face, 1]], (d) => {
      d.ipos.forEach((ip) => { ip.revealed = false; });
      d.ipos[0].revealed = true;
    });
    const t = resolve(s);
    expect(t.marketRound!.bloc).toBe(bloc.name);
    expect(t.ipos[0].price).toBe(applyBasisPoints(ipo.price, -750));
    expect(t.ipos[1].price).toBe(s.ipos[1].price); // unrevealed: untouched
  });

  it('holds the market when the move die averages the midpoint', () => {
    const s = withRolls([[4, 3], [4, 4]]); // move avg exactly 3.5
    const before = { ...s.prices };
    const t = resolve(s);
    expect(t.prices).toEqual(before);
    expect(t.marketRound).toMatchObject({ direction: 'flat', bp: 0 });
    expect(t.log.some((l) => /flat/.test(l.text))).toBe(true);
  });

  it('keeps prices on the $25 grid and never below the $100 floor', () => {
    const s = withRolls([[5, 1]], (d) => {
      for (const code of Object.keys(STOCK_BY_CODE)) d.prices[code] = PRICE_FLOOR;
    });
    const t = resolve(s);
    for (const code of Object.keys(STOCK_BY_CODE)) {
      expect(t.prices[code]).toBeGreaterThanOrEqual(PRICE_FLOOR);
      expect(t.prices[code] % 25).toBe(0);
    }
  });

  it('records the marker with the dice that produced it, and clears the tally', () => {
    const t = resolve(withRolls([[2, 6], [4, 5]]));
    expect(t.marketRound).toMatchObject({ sectorTotal: 6, moveAvg: 5.5, lap: t.lap });
    expect(t.roundDice).toEqual({ aSum: 0, bSum: 0, rolls: 0 });
  });

  it('nudges the Bank Rate with the marker every OTHER round', () => {
    const even = withRolls([[5, 6]], (d) => { d.lap = 2; });
    expect(bankRateBp(resolve(even))).toBe(bankRateBp(even) + 25);
    const odd = withRolls([[5, 6]], (d) => { d.lap = 3; });
    expect(bankRateBp(resolve(odd))).toBe(bankRateBp(odd));
    const bear = withRolls([[5, 1]], (d) => { d.lap = 2; });
    expect(bankRateBp(resolve(bear))).toBe(bankRateBp(bear) - 25);
  });

  it('feeds the Market Rate: neutral before any round, then the round\'s move', () => {
    expect(marketRateBp(started(2))).toBe(300);
    expect(marketRateBp(resolve(withRolls([[5, 6]])))).toBe(300 + 750);
    expect(marketRateBp(resolve(withRolls([[5, 1]])))).toBe(300 - 750);
    expect(marketRateBp(resolve(withRolls([[4, 3], [4, 4]])))).toBe(300); // flat
  });

  it('does nothing when the round-end market rule is switched off', () => {
    const off = withRolls([[5, 6]], (d) => { d.opts.roundMarket = false; });
    const before = { ...off.prices };
    const t = resolve(off);
    expect(t.prices).toEqual(before);
    expect(t.marketRound).toBeNull();
  });
});

describe('the dice during a round', () => {
  it('a roll tallies both dice and moves no prices', () => {
    const s = patch(started(2), (d) => {
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    const before = { ...s.prices };
    const rolled = dispatch(s, { t: 'roll' }, scriptedRng([2, 1])); // to space 4
    expect(rolled.players[0].pos).toBe(4);
    expect(rolled.prices).toEqual(before);
    expect(rolled.roundDice).toEqual({ aSum: 2, bSum: 1, rolls: 1 });
    expect(rolled.marketRound).toBeNull();
  });

  it('shows the table where the market stands, and says so before any roll', () => {
    expect(roundMarketForecast(started(2)).headline).toMatch(/dice decide the market/);
    const mid = roundMarketForecast(withRolls([[5, 6]]));
    expect(mid.headline).toContain('Finance');
    expect(mid.headline).toContain('rises');
    expect(mid.detail).toContain('1 roll');
    expect(mid.detail).toContain('3.50 midpoint');
  });

  it('a narrow card moves only what it names — no extra random sector', () => {
    const s = patch(started(2), (d) => {
      d.pendingDraws = ['FED'];
      d.decks.FED = [FED_CARDS.findIndex((c) => c.title === 'Rate Hike')];
      d.turnPhase = 'acted';
    });
    const before = { ...s.prices };
    const t = dispatch(s, { t: 'draw', deck: 'FED' }, rng('no-ripple'));
    for (const [code, stock] of Object.entries(STOCK_BY_CODE)) {
      const named = stock.sector === 'finance' || stock.sector === 'realestate' || stock.risk === 'High';
      if (!named) expect(t.prices[code], code).toBe(before[code]);
    }
    expect(t.marketSignals.some((sig) => sig.title.includes('Ripple'))).toBe(false);
  });
});
