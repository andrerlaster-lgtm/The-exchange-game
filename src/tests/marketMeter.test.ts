// THE MARKET METER — 2026-08-21 Market Overhaul. Off by default (see
// DEFAULT_OPTIONS.marketMeter); every test here explicitly opts in.

import { describe, expect, it } from 'vitest';
import { LADDER, SECTOR_CODES, STOCK_BY_CODE } from '../data';
import type { SectorId } from '../data/types';
import { blocked } from '../engine/rules';
import { moveEventPrice } from '../engine/stockState';
import {
  advanceMeterOnRoll, eligibleSectors, meterZone, METER_MAX, METER_MIN, repriceRoundBoundary,
} from '../engine/marketMeter';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

const SECTORS = Object.keys(SECTOR_CODES) as SectorId[];
const CEIL = LADDER.length - 1;

function withMeter(s: ReturnType<typeof started>) {
  return patch(s, (d) => { d.opts.marketMeter = true; });
}

describe('meterZone', () => {
  it('classifies bear, neutral, and bull bands', () => {
    expect(meterZone(METER_MIN)).toBe('bear');
    expect(meterZone(-2)).toBe('bear');
    expect(meterZone(-1)).toBe('neutral');
    expect(meterZone(0)).toBe('neutral');
    expect(meterZone(1)).toBe('neutral');
    expect(meterZone(2)).toBe('bull');
    expect(meterZone(METER_MAX)).toBe('bull');
  });
});

describe('advanceMeterOnRoll', () => {
  it('a 7 holds the needle', () => {
    let s = withMeter(started(2));
    advanceMeterOnRoll(s, 3, 4); // sum 7
    expect(s.meter).toBe(0);
  });

  it('2-6 pushes bear, 8-12 pushes bull', () => {
    let s = withMeter(started(2));
    advanceMeterOnRoll(s, 1, 2); // sum 3 -> bear
    expect(s.meter).toBe(-1);
    advanceMeterOnRoll(s, 6, 6); // sum 12 -> bull
    expect(s.meter).toBe(0);
    advanceMeterOnRoll(s, 6, 6);
    expect(s.meter).toBe(1);
  });

  it('the needle never leaves the METER_MIN..METER_MAX range', () => {
    let s = withMeter(started(2));
    for (let i = 0; i < 20; i++) advanceMeterOnRoll(s, 6, 6); // sum 12 every time
    expect(s.meter).toBe(METER_MAX);
    for (let i = 0; i < 20; i++) advanceMeterOnRoll(s, 1, 1); // sum 2 every time
    expect(s.meter).toBe(METER_MIN);
  });

  it('does nothing when the option is off', () => {
    const s = started(2); // marketMeter defaults to false
    advanceMeterOnRoll(s, 6, 6);
    expect(s.meter).toBe(0);
  });
});

describe('eligibleSectors', () => {
  it('excludes a sector only once every company in it is clamped at that bound', () => {
    let s = withMeter(started(2));
    const sec = SECTORS[0];
    const codes = SECTOR_CODES[sec];
    s = patch(s, (d) => { for (const code of codes) d.prices[code] = CEIL; });
    expect(eligibleSectors(s, 1)).not.toContain(sec); // all clamped at ceiling -> ineligible to rise
    expect(eligibleSectors(s, -1)).toContain(sec);    // still eligible to fall
  });

  it('every sector is eligible both ways from a fresh game (nothing starts clamped)', () => {
    const s = withMeter(started(2));
    expect(eligibleSectors(s, 1)).toHaveLength(SECTORS.length);
    expect(eligibleSectors(s, -1)).toHaveLength(SECTORS.length);
  });
});

describe('repriceRoundBoundary', () => {
  it('bullish zone moves exactly one sector up, bearish moves exactly one sector down', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 2; }); // bull
    const before = { ...s.prices };
    repriceRoundBoundary(s, rng('bull-seed'));
    const movedSectors = SECTORS.filter((sec) =>
      SECTOR_CODES[sec].some((code) => s.prices[code] !== before[code]));
    expect(movedSectors).toHaveLength(1);
    for (const code of SECTOR_CODES[movedSectors[0]]) {
      expect(s.prices[code]).toBeGreaterThanOrEqual(before[code]); // up or already-clamped
    }

    let s2 = withMeter(started(2));
    s2 = patch(s2, (d) => { d.meter = -2; }); // bear
    const before2 = { ...s2.prices };
    repriceRoundBoundary(s2, rng('bear-seed'));
    const movedSectors2 = SECTORS.filter((sec) =>
      SECTOR_CODES[sec].some((code) => s2.prices[code] !== before2[code]));
    expect(movedSectors2).toHaveLength(1);
  });

  it('neutral zone moves a different sector up than the one it moves down, when more than one is eligible', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 0; });
    const before = { ...s.prices };
    repriceRoundBoundary(s, rng('neutral-seed'));

    const upSectors = SECTORS.filter((sec) =>
      SECTOR_CODES[sec].some((code) => s.prices[code] > before[code]));
    const downSectors = SECTORS.filter((sec) =>
      SECTOR_CODES[sec].some((code) => s.prices[code] < before[code]));
    expect(upSectors).toHaveLength(1);
    expect(downSectors).toHaveLength(1);
    expect(upSectors[0]).not.toBe(downSectors[0]);
  });

  it('does nothing when the option is off', () => {
    let s = started(2);
    s = patch(s, (d) => { d.meter = 2; });
    const before = { ...s.prices };
    repriceRoundBoundary(s, rng());
    expect(s.prices).toEqual(before);
  });

  it('a fresh game always has a movable sector in every zone (no dead no-op at game start)', () => {
    for (const meter of [METER_MIN, -2, 0, 1, METER_MAX]) {
      let s = withMeter(started(2));
      s = patch(s, (d) => { d.meter = meter; });
      const before = { ...s.prices };
      repriceRoundBoundary(s, rng(`fresh-${meter}`));
      expect(s.prices).not.toEqual(before);
    }
  });

  it('revealed IPOs can participate; unrevealed IPOs never move', () => {
    let s = withMeter(started(2));
    // Force every regular company in every sector to the ceiling so the only
    // way "up" can succeed is via a revealed IPO in that sector's bloc-free
    // sector list — simplest reliable proof: reveal one IPO, bull it many
    // times with a large seed sweep, and confirm its step changes at least
    // once while an unrevealed one never does.
    const ipoRevealed = s.ipos[0].code;
    const ipoUnrevealed = s.ipos[1].code;
    s = patch(s, (d) => { d.ipos[0].revealed = true; d.ipos[1].revealed = false; d.meter = METER_MAX; });
    let revealedMoved = false;
    for (let i = 0; i < 50; i++) {
      const before = s.ipos.map((ip) => ip.step);
      repriceRoundBoundary(s, rng(`ipo-${i}`));
      if (s.ipos[0].step !== before[0]) revealedMoved = true;
      expect(s.ipos[1].step).toBe(before[1]); // unrevealed never moves, ever
    }
    expect(revealedMoved).toBe(true);
    void ipoRevealed; void ipoUnrevealed;
  });

  it('never queues a Market Event, even when a shock would push a company into the ceiling', () => {
    let s = withMeter(started(2));
    const sec = SECTORS[0];
    s = patch(s, (d) => {
      for (const code of SECTOR_CODES[sec]) d.prices[code] = CEIL - 1;
      d.meter = METER_MAX;
    });
    // Run repeatedly until this sector is the one that gets picked and pushed to CEIL.
    for (let i = 0; i < 30; i++) {
      repriceRoundBoundary(s, rng(`ceiling-${i}`));
      if (Object.values(STOCK_BY_CODE).some((st) => st.sector === sec && s.prices[st.code] === CEIL)) break;
    }
    expect(s.pendingDraws).not.toContain('ME');
  });
});

describe('end-to-end wiring: endTurn hook fires the round-boundary reprice', () => {
  // Constructed directly at the moment before the wrap-to-0 endTurn, rather
  // than chained through real dice-driven landings — a roll can land on any
  // of several prompt-opening spaces depending on starting position, which
  // is exactly the kind of incidental blocking state this test should not
  // depend on. The actual roll -> advanceMeterOnRoll wiring is covered by
  // its own describe block above using the pure function directly.
  function readyToEndFinalPlayerTurn(meter: number) {
    let s = withMeter(started(2));
    return patch(s, (d) => {
      d.cur = 1; // last player index for a 2-player game
      d.turnPhase = 'acted';
      d.trade = null;
      d.meter = meter;
    });
  }

  it('reprices exactly once when the wrap to a new round completes', () => {
    let s = readyToEndFinalPlayerTurn(METER_MAX);
    const before = { ...s.prices };
    s = dispatch(s, { t: 'endTurn' }, scriptedRng([0]));
    expect(s.cur).toBe(0); // confirms the wrap actually happened
    const moved = Object.keys(before).filter((code) => s.prices[code] !== before[code]);
    expect(moved.length).toBeGreaterThan(0);
  });

  it('does not reprice on a turn that does not complete a round', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.cur = 0; d.turnPhase = 'acted'; d.trade = null; d.meter = METER_MAX; });
    const before = { ...s.prices };
    s = dispatch(s, { t: 'endTurn' }, scriptedRng([0]));
    expect(s.cur).toBe(1); // no wrap
    expect(s.prices).toEqual(before);
  });

  it('does not reprice once Market Close has been triggered (Extended Hours safe)', () => {
    let s = readyToEndFinalPlayerTurn(METER_MAX);
    s = patch(s, (d) => { d.closing = true; d.closeDrawer = 0; d.extendedRoundsLeft = 1; });
    const before = { ...s.prices };
    s = dispatch(s, { t: 'endTurn' }, scriptedRng([0]));
    expect(s.cur).toBe(0); // still wraps — Extended Hours keeps playing
    expect(s.prices).toEqual(before); // but no reprice, because s.closing was already true
  });

  it('never fires when marketMeter is off, even at a real round boundary', () => {
    let s = started(2);
    s = patch(s, (d) => { d.cur = 1; d.turnPhase = 'acted'; d.trade = null; });
    const before = { ...s.prices };
    s = dispatch(s, { t: 'endTurn' }, scriptedRng([0]));
    expect(s.cur).toBe(0);
    expect(s.prices).toEqual(before);
  });

  it('adds no new blocked state — turning the meter on never changes whether End Turn is available', () => {
    const off = started(2);
    const on = withMeter(started(2));
    expect(blocked(on)).toBe(blocked(off));
  });

  it('does not interfere with a Bull Run card price move in the same game', () => {
    // Bull/Bear Run cards move prices through effectImpacts's own 'regime'
    // path, entirely separate from the meter's sector selection — confirm a
    // card-driven move still lands correctly with the meter enabled.
    let s = withMeter(started(2));
    const before = s.prices.CCAI;
    // Directly exercise the same price-move primitive a Bull Run card uses
    // (moveEventPrice) to confirm it's untouched by the meter being on.
    s = patch(s, (d) => { moveEventPrice(d, 'CCAI', 2); });
    expect(s.prices.CCAI).toBe(before + 2);
  });
});

describe('sector selection balance', () => {
  it('is deterministic for a fixed seed and reasonably balanced across many draws', () => {
    // Force a bull reprice repeatedly with a fixed seed suite and confirm no
    // single sector dominates — a crude but real balance check, not just an
    // assertion that selection happens.
    const counts: Record<string, number> = {};
    for (let seed = 0; seed < 400; seed++) {
      let s = withMeter(started(2));
      s = patch(s, (d) => { d.meter = METER_MAX; });
      const before = { ...s.prices };
      repriceRoundBoundary(s, rng(`balance-${seed}`));
      for (const sec of Object.keys(SECTOR_CODES) as SectorId[]) {
        if (SECTOR_CODES[sec].some((code) => s.prices[code] !== before[code])) {
          counts[sec] = (counts[sec] ?? 0) + 1;
        }
      }
    }
    const sectorCount = Object.keys(SECTOR_CODES).length;
    const expected = 400 / sectorCount;
    for (const sec of Object.keys(SECTOR_CODES)) {
      // Loose bound (half to double the expected share) — this is a sanity
      // check against a broken/biased selector, not a strict uniformity test.
      expect(counts[sec] ?? 0).toBeGreaterThan(expected * 0.5);
      expect(counts[sec] ?? 0).toBeLessThan(expected * 1.8);
    }
  });

  it('is exactly reproducible for the same seed', () => {
    function runOnce(seed: string) {
      let s = withMeter(started(2));
      s = patch(s, (d) => { d.meter = 0; });
      repriceRoundBoundary(s, rng(seed));
      return s.prices;
    }
    expect(runOnce('repro-seed')).toEqual(runOnce('repro-seed'));
  });
});
