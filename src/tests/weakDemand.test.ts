// Phase 6: Protected Weak Demand — 2-marker threshold, immune once any player
// holds 3+ shares of that stock, and markers clear on any ownership change
// that grants protection (not just a market purchase).

import { describe, expect, it } from 'vitest';
import { WEAK_DEMAND_PROTECTION_SHARES } from '../data';
import { isWeakDemandProtected } from '../engine';
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

  it('markers reset to 0 at the start of each new lap', () => {
    let s = started(2);
    s = patch(s, (d) => { d.skips.MEDI = 1; });
    // Advance through both players to trigger startLap (cur wraps to 0).
    s = patch(s, (d) => { d.cur = 1; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.skips.MEDI ?? 0).toBe(0);
  });
});

describe('Protected Weak Demand — immune once any player holds 3+ shares', () => {
  it('isWeakDemandProtected is true once a player owns 3 shares, false below that', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].shares.MEDI = WEAK_DEMAND_PROTECTION_SHARES; });
    expect(isWeakDemandProtected(s, 'MEDI')).toBe(true);
    s = patch(s, (d) => { d.players[0].shares.MEDI = WEAK_DEMAND_PROTECTION_SHARES - 1; });
    expect(isWeakDemandProtected(s, 'MEDI')).toBe(false);
  });

  it('a protected stock gains no marker on skip, even repeatedly', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[1].shares.MEDI = WEAK_DEMAND_PROTECTION_SHARES; });
    const base = s.prices.MEDI;
    for (let i = 0; i < 4; i++) {
      s = patch(s, (d) => { d.cur = 0; d.turnPhase = 'acted'; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
      s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    }
    expect(s.skips.MEDI ?? 0).toBe(0);
    expect(s.prices.MEDI).toBe(base);
    expect(s.log.some((l) => /protected/i.test(l.text))).toBe(true);
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

  it('an existing marker is cleared when a P2P trade newly protects the stock', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.skips.MEDI = 1;
      d.players[0].shares.MEDI = WEAK_DEMAND_PROTECTION_SHARES - 1; // 1 short of protection
      d.players[1].shares.MEDI = 1;
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 1, to: 0, code: 'MEDI', qty: 1, direction: 'sell', price: 100 }, rng());
    const id = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'acceptP2POffer', id }, rng());
    expect(s.players[0].shares.MEDI).toBe(WEAK_DEMAND_PROTECTION_SHARES);
    expect(isWeakDemandProtected(s, 'MEDI')).toBe(true);
    expect(s.skips.MEDI ?? 0).toBe(0);
  });
});
