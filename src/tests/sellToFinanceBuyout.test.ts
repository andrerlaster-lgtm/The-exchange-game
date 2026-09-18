// Selling another holding to raise cash for the company you just landed on.
// The "Sell to Bank" market panel is always visible on screen, including
// during an untouched-stock landing's buy/skip decision — but selling there
// used to silently burn that landing's one action (s.trade.actionsLeft),
// permanently disabling Buy even after enough cash was raised. A financing
// sell (a different company than the one just landed on, while scope is
// 'stock') no longer costs that action; only the eventual buy or skip does.

import { describe, expect, it } from 'vitest';
import { dispatch, patch, rng, rollTo, started } from './helpers';

describe('Selling to finance a company buyout', () => {
  it('a financing sell does not consume the landing\'s action — Buy is still available after', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 100; // can't afford MEDI ($8,250) yet
      d.players[0].shares = { IRON: 6 };
      d.players[0].pos = 1;
      d.turnPhase = 'preRoll';
    });
    s = rollTo(s, 5); // MEDI stock space, untouched
    expect(s.trade).toMatchObject({ scope: 'stock', code: 'MEDI', actionsLeft: 1 });

    s = dispatch(s, { t: 'sell', code: 'IRON', qty: 3 }, rng());
    expect(s.players[0].shares.IRON).toBe(3);
    expect(s.trade).toMatchObject({ scope: 'stock', code: 'MEDI', actionsLeft: 1 }); // action NOT spent
  });

  it('selling enough across several holdings, then buying, works in one landing', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 0;
      d.players[0].shares = { IRON: 22, FTRB: 22, APEX: 22 };
      d.players[0].pos = 1;
      d.turnPhase = 'preRoll';
    });
    s = rollTo(s, 5); // MEDI, untouched

    for (const code of ['IRON', 'FTRB', 'APEX']) {
      s = dispatch(s, { t: 'sell', code, qty: 5 }, rng());
      s = dispatch(s, { t: 'sell', code, qty: 5 }, rng());
      s = dispatch(s, { t: 'sell', code, qty: 1 }, rng());
    }
    expect(s.trade?.actionsLeft).toBe(1); // still available after 9 financing sells
    expect(s.players[0].cash).toBeGreaterThan(8_250);

    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[0].shares.MEDI).toBe(11);
    expect(s.supply.MEDI).toBe(0);
  });

  it('selling still respects the normal half-holding-per-turn bank limit', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 0;
      d.players[0].shares = { IRON: 6 }; // half-holding limit = 3
      d.players[0].pos = 1;
      d.turnPhase = 'preRoll';
    });
    s = rollTo(s, 5); // MEDI, untouched
    s = dispatch(s, { t: 'sell', code: 'IRON', qty: 3 }, rng());
    expect(s.players[0].shares.IRON).toBe(3);
    const cashAfterFirst = s.players[0].cash;

    s = dispatch(s, { t: 'sell', code: 'IRON', qty: 1 }, rng()); // over the limit — rejected
    expect(s.players[0].shares.IRON).toBe(3);
    expect(s.players[0].cash).toBe(cashAfterFirst);
  });

  it('skipping after a financing sell still works normally — the sale is not undone', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 100;
      d.players[0].shares = { IRON: 6 };
      d.players[0].pos = 1;
      d.turnPhase = 'preRoll';
    });
    s = rollTo(s, 5); // MEDI, untouched
    s = dispatch(s, { t: 'sell', code: 'IRON', qty: 3 }, rng());
    const cashAfterSell = s.players[0].cash;

    s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    expect(s.trade).toBeNull();
    expect(s.players[0].cash).toBe(cashAfterSell); // proceeds are kept
    expect(s.players[0].shares.MEDI ?? 0).toBe(0);
  });

  it('a Free Trading Day sell still spends one of its 2 actions, unlike a landing financing sell', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { IRON: 6 };
      d.trade = { scope: 'free', actionsLeft: 2 };
      d.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'sell', code: 'IRON', qty: 3 }, rng());
    expect(s.trade).toMatchObject({ scope: 'free', actionsLeft: 1 });
  });
});
