// 2026-08-21 Add Persistent Market Regime Display and Reset.

import { describe, it, expect } from 'vitest';
import { marketRegimeInfo, formatSignedMeter } from '../utils/marketRegime';
import { buildActionCenter } from '../utils/buildBoard3DActionCenter';
import { METER_MAX, METER_MIN, repriceRoundBoundary } from '../engine/marketMeter';
import { DEFAULT_OPTIONS } from '../engine/types';
import { initialState } from '../engine';
import { PRICE_FLOOR } from '../data';
import { makeRng } from '../utils/rng';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

function withMeter(s: ReturnType<typeof started>) {
  return patch(s, (d) => { d.opts.marketMeter = true; });
}

describe('marketRegimeInfo — single source of truth for all three surfaces', () => {
  it('exact zone labels for all seven meter values', () => {
    expect(marketRegimeInfo(-3).label).toBe('BEARISH');
    expect(marketRegimeInfo(-2).label).toBe('BEARISH');
    expect(marketRegimeInfo(-1).label).toBe('NEUTRAL');
    expect(marketRegimeInfo(0).label).toBe('NEUTRAL');
    expect(marketRegimeInfo(1).label).toBe('NEUTRAL');
    expect(marketRegimeInfo(2).label).toBe('BULLISH');
    expect(marketRegimeInfo(3).label).toBe('BULLISH');
  });

  it('never reuses the Bull Run / Bear Run board-space names for a meter zone', () => {
    // Those name spaces 16 and 26, a different mechanic (risk-tier price
    // moves + stance cash). Sharing the words made the banner read
    // "BEAR RUN" while a player landed on the "BULL RUN" space.
    for (const meter of [-3, -2, -1, 0, 1, 2, 3]) {
      expect(marketRegimeInfo(meter).label).not.toMatch(/RUN/i);
    }
  });

  it('formats the signed meter value with a true minus sign, never a bare hyphen', () => {
    expect(formatSignedMeter(-3)).toBe('−3');
    expect(formatSignedMeter(0)).toBe('0');
    expect(formatSignedMeter(2)).toBe('+2');
  });

  it('accessible text contains both the condition and the meter value, for every zone', () => {
    for (const meter of [-3, -2, -1, 0, 1, 2, 3]) {
      const info = marketRegimeInfo(meter);
      expect(info.ariaLabel).toContain(info.label);
      expect(info.ariaLabel).toContain(info.meterText);
    }
  });

  it('the 3D action center exposes the exact same data the 2D banner/board use, for the same state', () => {
    const s = withMeter(patch(started(2), (d) => { d.meter = 2; }));
    const expected = marketRegimeInfo(s.meter);
    const center = buildActionCenter(s);
    expect(center.marketCondition).toMatchObject({
      enabled: true,
      zone: expected.zone,
      label: expected.label,
      meter: expected.meter,
      meterText: expected.meterText,
      color: expected.color,
      glyph: expected.glyph,
      ariaLabel: expected.ariaLabel,
    });
  });

  it('the 3D action center reports enabled: false when the Market Meter option is off', () => {
    const s = patch(started(2), (d) => { d.opts.marketMeter = false; });
    expect(buildActionCenter(s).marketCondition.enabled).toBe(false);
  });

  it('roll-driven and card-driven meter changes are reflected immediately, with no extra gameplay state', () => {
    let s = withMeter(started(2));
    expect(marketRegimeInfo(s.meter).zone).toBe('neutral');
    s = dispatch(s, { t: 'roll' }, scriptedRng([6, 6])); // sum 12 -> meter +1
    expect(s.meter).toBe(1);
    expect(marketRegimeInfo(s.meter).zone).toBe('neutral');
    // No second field tracks the regime — meter is the only source of truth.
    expect((s as unknown as Record<string, unknown>).marketRegime).toBeUndefined();
    expect((s as unknown as Record<string, unknown>).bullRun).toBeUndefined();
    expect((s as unknown as Record<string, unknown>).bearRun).toBeUndefined();
  });
});

describe('End-of-round Bull/Bear decay (2026-09-18 — was a hard reset to 0)', () => {
  it('Bull at +2 reprices once, then decays to +1', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 2; });
    repriceRoundBoundary(s, rng('bull-2'));
    expect(s.meter).toBe(1);
  });

  it('Bull at +3 (pinned) reprices once, then decays to +2 — still bullish next lap, not wiped clean', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = METER_MAX; });
    repriceRoundBoundary(s, rng('bull-3'));
    expect(s.meter).toBe(METER_MAX - 1);
  });

  it('Bear at −2 reprices once, then decays to −1', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = -2; });
    repriceRoundBoundary(s, rng('bear-2'));
    expect(s.meter).toBe(-1);
  });

  it('Bear at −3 (pinned) reprices once, then decays to −2', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = METER_MIN; });
    repriceRoundBoundary(s, rng('bear-3'));
    expect(s.meter).toBe(METER_MIN + 1);
  });

  it('Neutral at +1 also eases toward 0 now (every lap decays, not just Bull/Bear) — but never past it', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 1; });
    repriceRoundBoundary(s, rng('neutral-decay'));
    expect(s.meter).toBe(0);
  });

  it('decays even when every eligible company is already at the floor and nothing actually moves', () => {
    // A BEAR meter is used deliberately: the percentage redesign removed the
    // hard ceiling, so a company can always rise and a bull round can never be
    // fully clamped. The floor is now the only bound that can block a move.
    let s = withMeter(started(2));
    s = patch(s, (d) => {
      d.meter = -2; // bear — the only direction that can be fully blocked
      for (const code of Object.keys(d.prices)) d.prices[code] = PRICE_FLOOR;
      d.ipos.forEach((ip) => { ip.revealed = false; }); // no revealed IPO left to move either
    });
    const before = { ...s.prices };
    repriceRoundBoundary(s, rng('clamped'));
    expect(s.prices).toEqual(before); // genuinely nothing moved
    expect(s.meter).toBe(-1); // decay happens anyway
  });

  it('the decay creates no additional Important Event, price move, card draw, or stance payout', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => {
      d.meter = -2; // bear — see the clamped-floor note above
      for (const code of Object.keys(d.prices)) d.prices[code] = PRICE_FLOOR;
      d.ipos.forEach((ip) => { ip.revealed = false; });
    });
    const signalsBefore = s.marketSignals.length;
    const cashBefore = s.players.map((p) => p.cash);
    repriceRoundBoundary(s, rng('no-dupe'));
    expect(s.marketSignals.length).toBe(signalsBefore); // no signal at all — nothing moved to report
    expect(s.players.map((p) => p.cash)).toEqual(cashBefore); // no stance payout
    // The decay is represented in the ordinary log, not a curated signal.
    expect(s.log[0]?.text).toContain('Market Meter eases toward Neutral');
  });

  it('a Bull round that DID move something records exactly one signal, then still decays', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => { d.meter = 2; });
    const signalsBefore = s.marketSignals.length;
    repriceRoundBoundary(s, rng('bull-signal'));
    expect(s.marketSignals.length).toBe(signalsBefore + 1);
    expect(s.meter).toBe(1);
  });

  it('does not reset (or reprice) once Market Close has already been triggered', () => {
    let s = withMeter(started(2));
    s = patch(s, (d) => {
      d.cur = 1; d.turnPhase = 'acted'; d.trade = null;
      d.meter = METER_MAX; d.closing = true; d.closeDrawer = 0; d.extendedRoundsLeft = 1;
    });
    s = dispatch(s, { t: 'endTurn' }, scriptedRng([0]));
    expect(s.meter).toBe(METER_MAX); // untouched — repriceRoundBoundary never runs while s.closing
  });
});

describe('Default availability', () => {
  it('the Market Meter is on by default — a core rule, not an experimental option', () => {
    expect(DEFAULT_OPTIONS.marketMeter).toBe(true);
    expect(initialState(makeRng('default-check')).opts.marketMeter).toBe(true);
  });
});
