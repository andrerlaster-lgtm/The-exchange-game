// Player-to-player trades of ETFs (2026-09-19). ETFs can't be sold to the
// bank, but they can change hands between players like any other holding.

import { describe, expect, it } from 'vitest';
import { heldQty, tradableHoldings } from '../engine';
import { dispatch, patch, rng, started } from './helpers';

const propose = (s: ReturnType<typeof started>, offer: Record<string, unknown>) =>
  dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, direction: 'sell', ...offer } as never, rng());
const acceptFirst = (s: ReturnType<typeof started>) => dispatch(s, { t: 'acceptP2POffer', id: s.p2pOffers[0].id }, rng());

describe('P2P trade — ETFs', () => {
  it('lists ETFs among a player\'s tradable holdings', () => {
    const s = patch(started(2), (d) => { d.players[0].shares = { MEDI: 2 }; d.players[0].etfShares = { GRW: 3 }; });
    expect(tradableHoldings(s.players[0])).toEqual([{ code: 'MEDI', qty: 2 }, { code: 'GRW', qty: 3 }]);
    expect(heldQty(s.players[0], 'GRW')).toBe(3);
  });

  it('sells ETF units for cash between players', () => {
    let s = patch(started(2), (d) => { d.players[0].etfShares = { GRW: 3 }; d.players[1].cash = 10_000; });
    const cash0 = s.players[0].cash;
    s = propose(s, { code: 'GRW', qty: 2, price: 5_000 });
    expect(s.p2pOffers).toHaveLength(1);
    s = acceptFirst(s);
    expect(s.players[0].etfShares.GRW).toBe(1);
    expect(s.players[1].etfShares.GRW).toBe(2);
    expect(s.players[0].cash).toBe(cash0 + 5_000);
    expect(s.players[1].cash).toBe(5_000);
    expect(s.players[1].shares.GRW).toBeUndefined(); // never lands in the stock map
  });

  it('removes the holding entirely when every unit is traded away', () => {
    let s = patch(started(2), (d) => { d.players[0].etfShares = { INC: 1 }; d.players[1].cash = 10_000; });
    s = acceptFirst(propose(s, { code: 'INC', qty: 1, price: 3_000 }));
    expect('INC' in s.players[0].etfShares).toBe(false);
    expect(s.players[1].etfShares.INC).toBe(1);
  });

  it('swaps a stock for an ETF (ETF as the counter leg)', () => {
    let s = patch(started(2), (d) => {
      d.players[0].shares = { MEDI: 2 };
      d.players[1].etfShares = { PROP: 2 };
    });
    s = propose(s, { code: 'MEDI', qty: 2, price: 0, counterCode: 'PROP', counterQty: 1 });
    expect(s.p2pOffers).toHaveLength(1);
    s = acceptFirst(s);
    expect(s.players[0].shares.MEDI ?? 0).toBe(0);
    expect(s.players[1].shares.MEDI).toBe(2);
    expect(s.players[0].etfShares.PROP).toBe(1);
    expect(s.players[1].etfShares.PROP).toBe(1);
  });

  it('swaps an ETF for an ETF', () => {
    let s = patch(started(2), (d) => { d.players[0].etfShares = { GRW: 1 }; d.players[1].etfShares = { ENE: 1 }; });
    s = acceptFirst(propose(s, { code: 'GRW', qty: 1, price: 0, counterCode: 'ENE', counterQty: 1 }));
    expect(s.players[0].etfShares).toEqual({ ENE: 1 });
    expect(s.players[1].etfShares).toEqual({ GRW: 1 });
  });

  it('falls through if the seller no longer holds the units', () => {
    let s = patch(started(2), (d) => { d.players[0].etfShares = { GRW: 1 }; d.players[1].cash = 10_000; });
    s = propose(s, { code: 'GRW', qty: 1, price: 2_000 });
    s = patch(s, (d) => { d.players[0].etfShares = {}; });
    s = acceptFirst(s);
    expect(s.players[1].cash).toBe(10_000);
    expect(s.players[1].etfShares.GRW ?? 0).toBe(0);
    expect(s.log.some((l) => /fell through/i.test(l.text))).toBe(true);
  });

  it('falls through if the buyer no longer holds the counter ETF', () => {
    let s = patch(started(2), (d) => { d.players[0].shares = { MEDI: 1 }; d.players[1].etfShares = { PROP: 1 }; });
    s = propose(s, { code: 'MEDI', qty: 1, price: 0, counterCode: 'PROP', counterQty: 2 });
    s = acceptFirst(s);
    expect(s.players[0].shares.MEDI).toBe(1);
    expect(s.players[1].etfShares.PROP).toBe(1);
  });
});
