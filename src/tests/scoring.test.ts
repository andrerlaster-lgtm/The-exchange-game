// Rules 8, 9, 11 — Market Open income, Diversified Portfolio, net worth.

import { describe, expect, it } from 'vitest';
import { SALARY, STOCK_BY_CODE } from '../data';
import { isDiversified, netWorth, priceOf, sharesValue } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

describe('Rule 8 — Market Open base income + dividends', () => {
  it('passing Market Open pays base salary', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; });
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    expect(s.players[0].pos).toBe(2);
    expect(s.players[0].cash).toBe(cash + SALARY);
  });

  it('pays printed dividends per share', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; d.players[0].shares = { SAFE: 2, CCAI: 3 }; });
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    // SAFE has div, CCAI has div=0 (high-risk)
    expect(s.players[0].cash).toBe(cash + SALARY + STOCK_BY_CODE.SAFE.div * 2);
  });
});

describe('Rule 9 — Diversified Portfolio status', () => {
  it('qualifies with holdings in 3 different sectors, regardless of margin', () => {
    const base = started(2);
    const diversified = patch(base, (d) => { d.players[0].shares = { SAFE: 11, MTRO: 11, FTRB: 11 }; });
    expect(isDiversified(diversified, diversified.players[0])).toBe(true);

    // Diversification now depends only on distinct regular-stock sectors.
    const withMargin = patch(diversified, (d) => { d.players[0].margin = 2000; });
    expect(isDiversified(withMargin, withMargin.players[0])).toBe(true);

    const onlyTwo = patch(base, (d) => { d.players[0].shares = { SAFE: 11, MTRO: 11 }; });
    expect(isDiversified(onlyTwo, onlyTwo.players[0])).toBe(false);
  });

  it('IPO shares do not count toward sector diversification', () => {
    const base = started(2);
    // NDRV is an IPO — does not count as a sector
    const s = patch(base, (d) => { d.players[0].shares = { SAFE: 11, MTRO: 11, NDRV: 5 }; });
    expect(isDiversified(s, s.players[0])).toBe(false);
  });

  it('diversification does not automatically protect a stock during a crash', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { SAFE: 11, MTRO: 11, FTRB: 11 };
    });
    expect(isDiversified(s, s.players[0])).toBe(true);
    // Simulate a Flash Crash effect (all -2, crash: true) via pendingDraws
    s = patch(s, (d) => {
      d.turnPhase = 'acted';
      d.pendingDraws = ['ME'];
      // Rig the ME deck so the Flash Crash card is first
      const crashIdx = 15; // Flash Crash is index 15 in ME_CARDS
      d.decks.ME = [crashIdx, ...d.decks.ME.filter((i) => i !== crashIdx)];
    });
    s = dispatch(s, { t: 'draw', deck: 'ME' }, rng());
    expect(s.pick).toBeNull();
    expect(s.prices.SAFE).toBe(STOCK_BY_CODE.SAFE.step - 2);
  });
});

describe('Rule 11 — Final portfolio value = cash + shares − margin', () => {
  it('computes net worth correctly', () => {
    const s = patch(started(2), (d) => {
      d.players[0].cash = 5000;
      d.players[0].shares = { MEDI: 2 };
      d.players[0].margin = 2000;
    });
    const expected = 5000 + sharesValue(s, s.players[0]) - 2000;
    expect(netWorth(s, s.players[0])).toBe(expected);
    expect(sharesValue(s, s.players[0])).toBe(2 * priceOf(s, 'MEDI'));
  });
});
