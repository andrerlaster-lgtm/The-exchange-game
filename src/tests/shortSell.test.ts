// Rule — Portfolio Tax (space 25) and Audit Notice (space 34).
// Short Sell was removed from the board; its state types are kept for legacy safety.

import { describe, expect, it } from 'vitest';
import { netWorth } from '../engine';
import { dispatch, patch, scriptedRng, started } from './helpers';

describe('Portfolio Tax (space 25)', () => {
  it('charges 10% of net worth on landing', () => {
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
  });
});

describe('Audit Notice (space 34)', () => {
  it('charges flat $500 with no margin', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 8000;
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.players[0].pos).toBe(34);
    expect(s.players[0].cash).toBe(8000 - 500);
  });

  it('charges $750 when player has margin', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 8000;
      d.players[0].margin = 2000;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.players[0].pos).toBe(34);
    expect(s.players[0].cash).toBe(8000 - 750);
  });
});
