// Rule — Portfolio Tax (space 25) and Audit Notice (space 34).
// Short Sell was removed from the board; its state types are kept for legacy safety.

import { describe, expect, it } from 'vitest';
import { netWorth } from '../engine';
import { dispatch, patch, scriptedRng, started } from './helpers';

describe('Portfolio Tax (space 25)', () => {
  it('offers a 10% charge that can be paid immediately', () => {
    let s = started(2);
    // pos 23 → roll [1,1] → lands on 25 (no Market Open pass)
    s = patch(s, (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 8000;
      d.players[0].shares = { MEDI: 2 };
      d.players[0].margin = 0;
    });
    const nwBefore = netWorth(s, s.players[0]);
    const expectedTax = Math.max(0, Math.round(nwBefore * 0.10 / 100) * 100);
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.players[0].pos).toBe(25);
    expect(s.players[0].cash).toBe(8000);
    expect(s.landingNotice?.amount).toBe(expectedTax);
    s = dispatch(s, { t: 'payLandingFee' }, scriptedRng([]));
    expect(s.players[0].cash).toBe(8000 - expectedTax);
  });

  it('charges 0 when net worth is zero or negative', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 0;
      d.players[0].shares = {};
      d.players[0].margin = 5000;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.players[0].pos).toBe(25);
    expect(s.players[0].cash).toBe(0);
    expect(s.landingNotice?.amount).toBe(0);
  });
});

describe('Audit Notice (space 34)', () => {
  it('offers 5% of net worth when that is above the $500 minimum', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 40_000;
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.players[0].pos).toBe(34);
    expect(s.players[0].cash).toBe(40_000);
    expect(s.landingNotice?.amount).toBe(2_000);
    s = dispatch(s, { t: 'payLandingFee' }, scriptedRng([]));
    expect(s.players[0].cash).toBe(40_000 - 2_000);
  });

  it('offers 7.5% of net worth when the player has margin', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 42_000;
      d.players[0].margin = 2_000;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.players[0].pos).toBe(34);
    expect(s.players[0].cash).toBe(42_000);
    expect(s.landingNotice?.amount).toBe(3_000);
    s = dispatch(s, { t: 'payLandingFee' }, scriptedRng([]));
    expect(s.players[0].cash).toBe(42_000 - 3_000);
  });

  it('keeps the former $500 / $750 minimum charges for low net worth', () => {
    let noMargin = patch(started(2), (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 1_000;
    });
    noMargin = dispatch(noMargin, { t: 'roll' }, scriptedRng([1, 1]));
    expect(noMargin.landingNotice?.amount).toBe(500);

    let withMargin = patch(started(2), (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 1_000;
      d.players[0].margin = 500;
    });
    withMargin = dispatch(withMargin, { t: 'roll' }, scriptedRng([1, 1]));
    expect(withMargin.landingNotice?.amount).toBe(750);
  });
});
