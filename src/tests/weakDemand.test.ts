// Weak Demand — 2-marker threshold with no automatic ownership protection.

import { describe, expect, it } from 'vitest';
import { dispatch, patch, rng, started } from './helpers';

describe('Weak Demand markers — 2-marker threshold', () => {
  it('two skips drop the price one step and reset the counter to 0', () => {
    let s = started(3);
    const base = s.prices.MEDI;
    for (let pi = 0; pi < 2; pi++) {
      s = patch(s, (d) => { d.cur = pi; d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
      s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    }
    expect(s.prices.MEDI).toBe(base - 1);
    expect(s.skips.MEDI).toBe(0);
  });

  it('counter increments to 1 without dropping until the second skip', () => {
    let s = started(3);
    const base = s.prices.MEDI;
    s = patch(s, (d) => { d.cur = 0; d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    expect(s.prices.MEDI).toBe(base);
    expect(s.skips.MEDI).toBe(1);
  });

  it('skipping on a sold-out stock adds no marker', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply.MEDI = 0;
      d.cur = 0; d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 };
    });
    s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    expect(s.skips.MEDI ?? 0).toBe(0);
  });

  it('endTurn alone does not add a weak-demand marker', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.turnPhase = 'acted';
      d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 };
    });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.skips.MEDI ?? 0).toBe(0);
  });

  // Rulebook §9/§19: a marker sits on the company until the 2-marker threshold
  // drops its price, or the company is bought outright. It is NOT a per-lap
  // counter — clearing it every lap made the second skip have to land on the
  // same company within the same lap, so the mechanic effectively never fired.
  it('markers persist across a lap rollover', () => {
    let s = started(2);
    s = patch(s, (d) => { d.skips.MEDI = 1; });
    // Advance through both players to trigger startLap (cur wraps to 0).
    s = patch(s, (d) => { d.cur = 1; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.lap).toBe(2);
    expect(s.skips.MEDI).toBe(1);
  });

  it('a marker carried over from an earlier lap still completes the threshold', () => {
    let s = started(2);
    s = patch(s, (d) => { d.skips.MEDI = 1; d.cur = 1; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // lap 2 — the marker survives
    const stepBefore = s.prices.MEDI;
    s = patch(s, (d) => { d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    expect(s.prices.MEDI).toBe(stepBefore - 1);
    expect(s.skips.MEDI).toBe(0);
  });
});

describe('Weak Demand — ownership grants no automatic protection', () => {
  it('a large holding does not stop skips from lowering an untouched company', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[1].shares.MEDI = 11; });
    const base = s.prices.MEDI;
    for (let i = 0; i < 2; i++) {
      s = patch(s, (d) => { d.cur = 0; d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
      s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    }
    expect(s.skips.MEDI ?? 0).toBe(0);
    expect(s.prices.MEDI).toBe(base - 1);
    expect(s.log.some((l) => /protected/i.test(l.text))).toBe(false);
  });

  it('an existing marker is cleared immediately by any purchase of that stock', () => {
    let s = started(2);
    s = patch(s, (d) => { d.cur = 0; d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    expect(s.skips.MEDI).toBe(1);

    s = patch(s, (d) => { d.cur = 1; d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.skips.MEDI ?? 0).toBe(0);
  });

  it('a P2P ownership change does not clear an existing marker', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.skips.MEDI = 1;
      d.players[0].shares.MEDI = 2;
      d.players[1].shares.MEDI = 1;
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 1, to: 0, code: 'MEDI', qty: 1, direction: 'sell', price: 100 }, rng());
    const id = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'acceptP2POffer', id }, rng());
    expect(s.players[0].shares.MEDI).toBe(3);
    expect(s.skips.MEDI).toBe(1);
  });
});
