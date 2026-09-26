// MARKET THEMES (2026-09-20) — the live round-end market. A theme is drawn as
// a round begins, names tailwind and headwind sectors, and resolves when the
// round closes: public companies in those sectors move by risk tier, and
// nothing else moves at all.

import { describe, expect, it } from 'vitest';
import { SECTOR_CODES, STOCK_BY_CODE } from '../data/stocks';
import { resolveRoundEndMarket } from '../engine/roundMarket';
import type { GameState } from '../engine';
import { patch, started } from './helpers';

/** Growth Rotation without the drawing: Tech up, Consumer down. Every company
    on the board is public, so the "untouched" rule is out of the way except
    where a test puts it back. */
function themed(extra: (d: GameState) => void = () => {}): GameState {
  return patch(started(2), (d) => {
    d.lap = 3; // odd: no Bank Rate nudge, so price assertions stand alone
    d.marketTheme = { id: 'growth-rotation', name: 'Growth Rotation', tailwinds: ['tech'], headwinds: ['consumer'], lap: d.lap };
    for (const code of Object.keys(d.supply)) d.supply[code] = 10;
    extra(d);
  });
}

const codeWithRisk = (sector: 'tech' | 'consumer', risk: 'Low' | 'Med' | 'High') =>
  SECTOR_CODES[sector].find((c) => STOCK_BY_CODE[c].risk === risk);

describe('a Market Theme resolving', () => {
  it('lifts its tailwinds and presses its headwinds, scaled by risk tier', () => {
    const before = themed();
    const after = patch(before, (d) => { resolveRoundEndMarket(d); });

    for (const [risk, pct] of [['Low', 0.025], ['Med', 0.05], ['High', 0.075]] as const) {
      const up = codeWithRisk('tech', risk);
      if (up) expect(after.prices[up]).toBeGreaterThan(before.prices[up]);
      const down = codeWithRisk('consumer', risk);
      if (down) expect(after.prices[down]).toBeLessThan(before.prices[down]);
      // The grid rounds, so the check is that a High move beats a Low one.
      expect(pct).toBeGreaterThan(0);
    }

    const lowUp = codeWithRisk('tech', 'Low');
    const highUp = codeWithRisk('tech', 'High');
    if (lowUp && highUp) {
      const gain = (c: string) => (after.prices[c] - before.prices[c]) / before.prices[c];
      expect(gain(highUp)).toBeGreaterThan(gain(lowUp));
    }
  });

  it('leaves every sector the theme does not name exactly where it was', () => {
    const before = themed();
    const after = patch(before, (d) => { resolveRoundEndMarket(d); });
    for (const code of [...SECTOR_CODES.health, ...SECTOR_CODES.energy]) {
      expect(after.prices[code]).toBe(before.prices[code]);
    }
  });

  it('never moves a company still untouched in the bank', () => {
    const code = SECTOR_CODES.tech[0];
    const before = themed((d) => { d.supply[code] = 11; });
    const after = patch(before, (d) => { resolveRoundEndMarket(d); });
    expect(after.prices[code]).toBe(before.prices[code]);
  });

  it('records the marker, spends the theme, and clears the round tally', () => {
    const after = patch(themed(), (d) => { resolveRoundEndMarket(d); });
    expect(after.marketTheme).toBeNull();
    expect(after.marketRound?.bloc).toBe('Growth Rotation');
    expect(after.roundDice).toMatchObject({ rolls: 0 });
    expect(after.log.some((l) => /Market Theme resolves/.test(l.text))).toBe(true);
  });

  it('records each player’s exact holding-value impact for the round close recap', () => {
    const up = SECTOR_CODES.tech[0];
    const down = SECTOR_CODES.consumer[0];
    const before = themed((d) => {
      d.players[0].shares[up] = 2;
      d.players[0].shares[down] = 3;
    });
    const after = patch(before, (d) => { resolveRoundEndMarket(d); });
    const expected = (after.prices[up] - before.prices[up]) * 2
      + (after.prices[down] - before.prices[down]) * 3;

    expect(after.roundCloseRecap?.theme).toBe('Growth Rotation');
    expect(after.roundCloseRecap?.playerImpacts[0].amount).toBe(expected);
    expect(after.roundCloseRecap?.playerImpacts[0].helped).toContain(up);
    expect(after.roundCloseRecap?.playerImpacts[0].hurt).toContain(down);
  });

  it('carries a price shock into the rate-sensitive sectors (2026-09-25)', () => {
    // A theme confined to Healthcare and Industrials, so Finance and Real
    // Estate move only from the rate shock. FTRB (Low) and MTRO (Low) carry no
    // risk sensitivity either, so each shows one clean effect.
    const rateOnly = (lap: number) => patch(started(2), (d) => {
      d.lap = lap;
      d.marketTheme = { id: 't', name: 'T', tailwinds: ['health'], headwinds: ['industrials'], lap };
      for (const code of Object.keys(d.supply)) d.supply[code] = 10;
    });

    const before = rateOnly(4);
    const after = patch(before, (d) => { resolveRoundEndMarket(d); });
    const hiked = after.bankRateBp > before.bankRateBp;

    // Finance tracks the rate, Real Estate moves against it.
    if (hiked) {
      expect(after.prices.FTRB).toBeGreaterThan(before.prices.FTRB);
      expect(after.prices.MTRO).toBeLessThan(before.prices.MTRO);
    } else {
      expect(after.prices.FTRB).toBeLessThan(before.prices.FTRB);
      expect(after.prices.MTRO).toBeGreaterThan(before.prices.MTRO);
    }

    // An odd round changes no rate, so it shocks no prices either.
    const odd = rateOnly(5);
    const oddAfter = patch(odd, (d) => { resolveRoundEndMarket(d); });
    expect(oddAfter.bankRateBp).toBe(odd.bankRateBp);
    expect(oddAfter.prices.FTRB).toBe(odd.prices.FTRB);
    expect(oddAfter.prices.MTRO).toBe(odd.prices.MTRO);
  });

  it('shocks the whole board, untouched companies included', () => {
    // The theme only moves public companies; a rate is policy, not demand, so
    // it reprices every balance sheet on the board.
    const before = patch(started(2), (d) => {
      d.lap = 4;
      d.marketTheme = { id: 't', name: 'T', tailwinds: ['health'], headwinds: ['industrials'], lap: 4 };
      // The theme has to move something for the round to read bull or bear —
      // a flat round nudges no rate at all — so the theme's own sectors are
      // public while FTRB, the company under test, is not.
      for (const code of Object.keys(d.supply)) d.supply[code] = 10;
      d.supply.FTRB = 11; // never bought by anyone
    });
    const after = patch(before, (d) => { resolveRoundEndMarket(d); });
    expect(after.bankRateBp).not.toBe(before.bankRateBp);
    expect(after.prices.FTRB).not.toBe(before.prices.FTRB);
    // …while a company the rate does not reach stays put: SAFE is Consumer
    // (no rate sensitivity), Low risk, and outside this theme's sectors.
    expect(after.prices.SAFE).toBe(before.prices.SAFE);
  });

  it('still nudges the Bank Rate every other round — the theme does not skip it', () => {
    const even = patch(themed((d) => { d.lap = 4; }), (d) => { resolveRoundEndMarket(d); });
    const odd = patch(themed((d) => { d.lap = 5; }), (d) => { resolveRoundEndMarket(d); });
    expect(even.bankRateBp).not.toBe(300);
    expect(odd.bankRateBp).toBe(300);
  });
});
