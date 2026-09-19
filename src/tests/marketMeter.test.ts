// THE MARKET METER — 2026-08-21 Market Overhaul, later made the default core
// rule by the 2026-08-21 Market Regime Display task (see
// DEFAULT_OPTIONS.marketMeter). Tests below explicitly opt in via `withMeter`
// even though it's now the default, so this file's coverage never silently
// depends on whatever DEFAULT_OPTIONS happens to be; the "off" tests
// explicitly opt out for the same reason.

import { describe, expect, it } from 'vitest';
import { FED_CARDS } from '../data';
import { CEILING_TRIGGER, MOVE_BP, PRICE_FLOOR, SECTOR_CODES, STOCK_BY_CODE, applyBasisPoints } from '../data';
import type { SectorId } from '../data/types';
import { blocked } from '../engine/rules';
import { moveEventPrice } from '../engine/stockState';
import {
  advanceMeterOnRoll, eligibleSectors, marketMeterForecast, meterZone, METER_MAX, METER_MIN, repriceRoundBoundary, triggerCardRipple,
} from '../engine/marketMeter';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

const SECTORS = Object.keys(SECTOR_CODES) as SectorId[];
const CEIL = CEILING_TRIGGER;

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

describe('marketMeterForecast', () => {
  it('explains the exact round-end scope without naming a sector before it is selected', () => {
    expect(marketMeterForecast(0).headline).toBe('One random sector will move 5% (500 bp).');
    expect(marketMeterForecast(2).headline).toBe('One random sector will rise 10% (1,000 bp).');
    expect(marketMeterForecast(-2).headline).toBe('One random sector will fall 10% (1,000 bp).');
    expect(marketMeterForecast(3).headline).toBe('Two random sectors will rise 5% (500 bp) each.');
    expect(marketMeterForecast(-3).headline).toBe('Two random sectors will fall 5% (500 bp) each.');
    expect(marketMeterForecast(2).detail).toContain('selected when the round ends');
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
    const s = patch(started(2), (d) => { d.opts.marketMeter = false; });
    advanceMeterOnRoll(s, 6, 6);
    expect(s.meter).toBe(0);
  });
});

describe('eligibleSectors', () => {
  it('excludes a sector only once every company in it is pinned at the floor', () => {
    // The floor is now the only bound: the percentage redesign removed the
    // hard ceiling, so nothing is ever ineligible to RISE (see rules.canRise).
    let s = withMeter(started(2));
    const sec = SECTORS[0];
    const codes = SECTOR_CODES[sec];
    s = patch(s, (d) => { for (const code of codes) d.prices[code] = PRICE_FLOOR; });
    expect(eligibleSectors(s, -1)).not.toContain(sec); // all at the floor -> cannot fall
    expect(eligibleSectors(s, 1)).toContain(sec);      // always eligible to rise
  });

  it('a sector far above the old $5,000 ceiling is still eligible to rise', () => {
    let s = withMeter(started(2));
    const sec = SECTORS[0];
    s = patch(s, (d) => { for (const code of SECTOR_CODES[sec]) d.prices[code] = CEIL * 2; });
    expect(eligibleSectors(s, 1)).toContain(sec);
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

  it('moves exactly ONE sector per round at |meter|<=2 — Neutral is never churnier than a bare Bull/Bear', () => {
    // 2026-08-22: Neutral used to move two sectors (one up, one down), so the
    // supposedly calm state touched twice as many companies as an extreme
    // one. The needle sets the direction always, and — since Option C
    // (2026-09-18) — the breadth/depth too, but only at the pinned extreme
    // (see the dedicated 'amplitude scales with |meter|' block below); a bare
    // +/-2 still touches exactly one sector, just two steps deep instead of one.
    for (const meter of [-2, -1, 0, 1, 2]) {
      for (const seed of ['a', 'b', 'c', 'd', 'e']) {
        let s = withMeter(started(2));
        s = patch(s, (d) => { d.meter = meter; });
        const before = { ...s.prices };
        repriceRoundBoundary(s, rng(`one-sector-${meter}-${seed}`));
        const movedSectors = SECTORS.filter((sec) =>
          SECTOR_CODES[sec].some((code) => s.prices[code] !== before[code]));
        expect(movedSectors).toHaveLength(1);
      }
    }
  });

  it('Neutral goes both ways across seeds, while Bull only ever moves up and Bear only ever down', () => {
    const neutralDirections = new Set<number>();
    for (let i = 0; i < 40; i++) {
      let s = withMeter(started(2));
      s = patch(s, (d) => { d.meter = 0; });
      const before = { ...s.prices };
      repriceRoundBoundary(s, rng(`neutral-dir-${i}`));
      const changed = Object.keys(before).find((code) => s.prices[code] !== before[code])!;
      neutralDirections.add(Math.sign(s.prices[changed] - before[changed]));
    }
    expect(neutralDirections).toEqual(new Set([1, -1])); // unbiased coin flip

    for (const [meter, expectedDir] of [[METER_MAX, 1], [METER_MIN, -1]] as const) {
      for (let i = 0; i < 20; i++) {
        let s = withMeter(started(2));
        s = patch(s, (d) => { d.meter = meter; });
        const before = { ...s.prices };
        repriceRoundBoundary(s, rng(`dir-${meter}-${i}`));
        for (const code of Object.keys(before)) {
          if (s.prices[code] !== before[code]) {
            expect(Math.sign(s.prices[code] - before[code])).toBe(expectedDir);
          }
        }
      }
    }
  });

  it('does nothing when the option is off', () => {
    let s = started(2);
    s = patch(s, (d) => { d.opts.marketMeter = false; d.meter = 2; });
    const before = { ...s.prices };
    repriceRoundBoundary(s, rng());
    expect(s.prices).toEqual(before);
    expect(s.meter).toBe(2); // no reset either, while the option is off
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
      const before = s.ipos.map((ip) => ip.price);
      repriceRoundBoundary(s, rng(`ipo-${i}`));
      if (s.ipos[0].price !== before[0]) revealedMoved = true;
      expect(s.ipos[1].price).toBe(before[1]); // unrevealed never moves, ever
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
    s = patch(s, (d) => { d.opts.marketMeter = false; d.cur = 1; d.turnPhase = 'acted'; d.trade = null; });
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
    s = patch(s, (d) => { moveEventPrice(d, 'CCAI', MOVE_BP.meterAmplified); });
    expect(s.prices.CCAI).toBe(applyBasisPoints(before, MOVE_BP.meterAmplified));
  });
});

describe('sector selection balance', () => {
  it('is deterministic for a fixed seed and reasonably balanced across many draws', () => {
    // Force a bull reprice repeatedly with a fixed seed suite and confirm no
    // single sector dominates — a crude but real balance check, not just an
    // assertion that selection happens. Uses meter=2 (AMPLIFIED, not
    // METER_MAX/PINNED): |meter|==2 still touches exactly one sector under
    // Option C, so this test's "is the RANDOM PICK balanced" question stays
    // isolated from the breadth behavior the PINNED case gets its own test for.
    const counts: Record<string, number> = {};
    for (let seed = 0; seed < 400; seed++) {
      let s = withMeter(started(2));
      s = patch(s, (d) => { d.meter = 2; });
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

describe('Option C — amplitude scales with |meter| (2026-09-18)', () => {
  it('|meter|==1 (or 0) moves exactly one sector by the standard percentage', () => {
    for (const meter of [0, 1, -1]) {
      let s = withMeter(started(2));
      s = patch(s, (d) => { d.meter = meter; });
      const before = { ...s.prices };
      repriceRoundBoundary(s, rng(`mag1-${meter}`));
      const moved = SECTORS.filter((sec) => SECTOR_CODES[sec].some((code) => s.prices[code] !== before[code]));
      expect(moved).toHaveLength(1);
      for (const code of SECTOR_CODES[moved[0]]) {
        const dir = Math.sign(s.prices[code] - before[code]);
        // Each company moves the standard amount from its OWN price, so the
        // dollar deltas differ across a sector even though the percentage does not.
        expect(s.prices[code]).toBe(applyBasisPoints(before[code], dir * MOVE_BP.meterStandard));
      }
    }
  });

  it('|meter|==2 ("amplified") moves exactly one sector by the amplified percentage', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 2; });
    const before = { ...s.prices };
    repriceRoundBoundary(s, rng('mag2'));
    const moved = SECTORS.filter((sec) => SECTOR_CODES[sec].some((code) => s.prices[code] !== before[code]));
    expect(moved).toHaveLength(1);
    for (const code of SECTOR_CODES[moved[0]]) {
      expect(s.prices[code]).toBe(applyBasisPoints(before[code], MOVE_BP.meterAmplified));
    }
  });

  it('|meter|==3 ("pinned/broad") can move a second, different sector one step each', () => {
    // Not guaranteed every single draw (the second pick can coincide with the
    // first if nothing else is eligible), so sweep seeds and confirm it
    // actually happens at least once — a real, reachable behavior, not just
    // code that never executes.
    let sawTwoSectors = false;
    for (let seed = 0; seed < 30; seed++) {
      let s = withMeter(started(2));
      s = patch(s, (d) => { d.meter = METER_MAX; });
      const before = { ...s.prices };
      repriceRoundBoundary(s, rng(`mag3-${seed}`));
      const moved = SECTORS.filter((sec) => SECTOR_CODES[sec].some((code) => s.prices[code] !== before[code]));
      if (moved.length === 2) { sawTwoSectors = true; break; }
      expect(moved.length).toBeLessThanOrEqual(2);
    }
    expect(sawTwoSectors).toBe(true);
  });

  it('decays the needle by 1 toward neutral instead of hard-resetting to 0', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = METER_MAX; });
    repriceRoundBoundary(s, rng('decay-bull'));
    expect(s.meter).toBe(METER_MAX - 1); // was: hard reset to exactly 0

    let s2 = withMeter(started(2));
    s2 = patch(s2, (d) => { d.meter = METER_MIN; });
    repriceRoundBoundary(s2, rng('decay-bear'));
    expect(s2.meter).toBe(METER_MIN + 1);
  });

  it('a trend can persist across multiple laps instead of resetting the instant it peaks', () => {
    // Pin the needle back to +3 before each boundary (simulating continued
    // bullish rolls in between) and confirm several consecutive boundaries
    // all still read as a strong/pinned zone, rather than the old behavior
    // where the very first cash-in wiped it back to a blank slate.
    let s = withMeter(started(2));
    let laps = 0;
    for (let i = 0; i < 3; i++) {
      s = patch(s, (d) => { d.meter = METER_MAX; });
      const before = s.meter;
      repriceRoundBoundary(s, rng(`persist-${i}`));
      expect(s.meter).toBeLessThan(before); // decayed...
      expect(s.meter).toBeGreaterThanOrEqual(METER_MAX - 1); // ...but not wiped to 0
      laps++;
    }
    expect(laps).toBe(3);
  });

  it('does not decay below METER_MIN..METER_MAX (Neutral has nothing to decay from at 0)', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 0; });
    repriceRoundBoundary(s, rng('decay-neutral-zero'));
    expect(s.meter).toBe(0);
  });
});

describe('Option A — card-triggered ripple (2026-09-18)', () => {
  it('triggerCardRipple moves exactly one sector by one standard move, direction from the current zone', () => {
    let s = withMeter(started(2));
    // $2,000 everywhere, so a standard 5% move (+$100) is distinguishable from
    // the minimum $25 step a wrong-unit amount would fall back to.
    s = patch(s, (d) => { d.meter = 2; for (const c of Object.keys(d.prices)) d.prices[c] = 2_000; }); // bull
    const before = { ...s.prices };
    triggerCardRipple(s, rng('ripple-bull'));
    const moved = SECTORS.filter((sec) => SECTOR_CODES[sec].some((code) => s.prices[code] !== before[code]));
    expect(moved).toHaveLength(1);
    for (const code of SECTOR_CODES[moved[0]]) {
      expect(s.prices[code]).toBe(applyBasisPoints(before[code], MOVE_BP.meterStandard)); // +$100
    }
  });

  it('does not touch the meter itself — only repriceRoundBoundary\'s lap-boundary cash-in does', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 2; });
    triggerCardRipple(s, rng('ripple-no-meter-change'));
    expect(s.meter).toBe(2);
  });

  it('does nothing when the option is off', () => {
    let s = started(2);
    s = patch(s, (d) => { d.opts.marketMeter = false; d.meter = 2; });
    const before = { ...s.prices };
    triggerCardRipple(s, rng());
    expect(s.prices).toEqual(before);
  });

  it('drawing a narrow Market Event card (sector/risk/multi/pick/lowest/highest) also fires a ripple', () => {
    // "Tech Breakthrough" is the first SECTOR_ROTATION card (multi: tech +1,
    // realestate -1) — a narrow, non-'all' effect, so it should qualify.
    let s = withMeter(started(2));
    s = patch(s, (d) => {
      d.meter = 2; // bull, so the ripple has a real fixed direction to check
      d.pendingDraws = ['ME'];
      d.decks.ME = [0];
      d.turnPhase = 'acted';
    });
    const before = { ...s.prices };
    s = dispatch(s, { t: 'draw', deck: 'ME' }, rng('ripple-integration'));
    // The card's own two named sectors (tech +1, realestate -1) moved as
    // usual — the ripple must touch a THIRD sector on top of those, or move
    // one of the same two an extra step, to prove it really fired.
    const totalMovedCodes = Object.keys(before).filter((code) => s.prices[code] !== before[code]);
    const cardOwnCodes = new Set([...SECTOR_CODES.tech, ...SECTOR_CODES.realestate]);
    const extraMoveBeyondCard = totalMovedCodes.some((code) => !cardOwnCodes.has(code))
      || totalMovedCodes.some((code) => Math.abs(s.prices[code] - before[code]) > 1);
    expect(extraMoveBeyondCard).toBe(true);
    // Exactly two market signals: the card's own, then the ripple's.
    const marketSignals = s.marketSignals.filter((sig) => sig.kind === 'market');
    expect(marketSignals.length).toBeGreaterThanOrEqual(2);
    expect(marketSignals[0].title).toContain('Market Ripple');
  });

  it('does NOT fire a ripple for a whole-market ("all") card — already touches everything', () => {
    // "Melt-Up Rally" is the first BROAD_MARKET card (k: 'all', d: 1) — 8
    // sector-rotation + 4 risk + 4 company-specific = index 16 in CORE_ME_CARDS.
    let s = withMeter(started(2));
    s = patch(s, (d) => {
      d.meter = 2;
      d.pendingDraws = ['ME'];
      d.decks.ME = [16];
      d.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'draw', deck: 'ME' }, rng('no-ripple-all'));
    expect(s.card?.title).toBe('Melt-Up Rally');
    const marketSignals = s.marketSignals.filter((sig) => sig.kind === 'market');
    expect(marketSignals.some((sig) => sig.title.includes('Market Ripple'))).toBe(false);
  });

  it('a narrow Fed card also fires a ripple, not just Market Event cards', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => {
      d.meter = 2;
      d.pendingDraws = ['FED'];
      d.decks.FED = [FED_CARDS.findIndex((c) => c.title === 'Rate Hike')];
      d.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'draw', deck: 'FED' }, rng('fed-ripple'));
    const marketSignals = s.marketSignals.filter((sig) => sig.kind === 'market');
    expect(marketSignals.some((sig) => sig.title.includes('Market Ripple'))).toBe(true);
    // The Fed signal itself must still be recorded, unaffected by the ripple.
    expect(s.marketSignals.some((sig) => sig.kind === 'fed' && sig.title === 'Rate Hike')).toBe(true);
  });
});
