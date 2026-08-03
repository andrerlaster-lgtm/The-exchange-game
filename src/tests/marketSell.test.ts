// Trading Market — the current player can sell owned stock on their turn without
// having to land on that stock's space (moves price on block sales of 3+).

import { describe, expect, it } from 'vitest';
import { SALARY, STOCK_BY_CODE } from '../data';
import { bankSellLimit, bankSellRemaining, canMarketSell, priceOf, projectedDividend, sellBackPrice } from '../engine';

import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

describe('Trading Market — sell without landing', () => {
  it('canMarketSell is false before rolling, true once acted with nothing pending', () => {
    const s = started();
    expect(canMarketSell(s)).toBe(false); // preRoll
    const acted = rollTo(s, 20); // land on a non-blocking space
    expect(acted.turnPhase).toBe('acted');
    expect(canMarketSell(acted)).toBe(true);
  });

  it('lets the current player sell a holding they did not land on', () => {
    // Buy out MEDI on its stock space, then move to an unrelated space and sell some back.
    let s = started();
    s = rollTo(s, 5); // MEDI stock space
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[0].shares.MEDI).toBe(11);

    // Simulate a later turn: no active Trade Step, player has acted, owns MEDI.
    s = patch(s, (d) => { d.trade = null; d.turnPhase = 'acted'; d.pendingDraws = []; });
    expect(canMarketSell(s)).toBe(true);

    const cash = s.players[0].cash;
    // Sell-back pays one price step below market (rulebook §11), not full market.
    const proceeds = sellBackPrice(s, 'MEDI');
    expect(proceeds).toBeLessThan(priceOf(s, 'MEDI'));
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 1 }, rng());
    expect(s.players[0].shares.MEDI).toBe(10);
    expect(s.players[0].cash).toBe(cash + proceeds);
  });

  it('selling 2 does not move the price, while selling 3 at once drops it one step', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (d) => { d.trade = null; d.turnPhase = 'acted'; });
    const base = s.prices.MEDI;
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    expect(s.prices.MEDI).toBe(base);
    expect(s.players[0].shares.MEDI).toBe(9);
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 3 }, rng());
    expect(s.prices.MEDI).toBe(base - 1);
    expect(s.players[0].shares.MEDI).toBe(6);
  });

  it('limits cumulative bank sales to half the starting holding, rounded down', () => {
    let s = started();
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 11 };
      d.trade = null; d.turnPhase = 'acted'; d.pendingDraws = [];
    });

    expect(bankSellLimit(s, 'MEDI')).toBe(5);
    expect(bankSellRemaining(s, 'MEDI')).toBe(5);
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    expect(bankSellRemaining(s, 'MEDI')).toBe(3);
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 3 }, rng());
    expect(bankSellRemaining(s, 'MEDI')).toBe(0);

    const cashAtLimit = s.players[0].cash;
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 1 }, rng());
    expect(s.players[0].shares.MEDI).toBe(6);
    expect(s.players[0].cash).toBe(cashAtLimit);
  });

  it('tracks the half-holding allowance separately for each company', () => {
    let s = patch(started(), (d) => {
      d.players[0].shares = { MEDI: 2, SAFE: 2, OILW: 2 };
      d.turnPhase = 'acted';
    });

    for (const code of ['MEDI', 'SAFE', 'OILW']) {
      s = dispatch(s, { t: 'sell', code, qty: 1 }, rng());
      expect(s.players[0].shares[code]).toBe(1);
      expect(bankSellRemaining(s, code)).toBe(0);
    }
  });

  it('clears the sale tracker when the turn ends', () => {
    let s = patch(started(2), (d) => {
      d.players[0].shares.MEDI = 4;
      d.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    expect(s.bankSoldThisTurn.MEDI).toBe(2);
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.bankSoldThisTurn).toEqual({});
  });

  it('reduces projected and paid dividends when shares are sold', () => {
    let s = patch(started(2), (d) => {
      d.players[0].shares.SAFE = 5;
      d.turnPhase = 'acted';
    });
    expect(projectedDividend(s, s.players[0])).toBe(STOCK_BY_CODE.SAFE.div * 5);

    s = dispatch(s, { t: 'sell', code: 'SAFE', qty: 2 }, rng());
    expect(s.players[0].shares.SAFE).toBe(3);
    expect(projectedDividend(s, s.players[0])).toBe(STOCK_BY_CODE.SAFE.div * 3);

    s = patch(s, (d) => {
      d.players[0].pos = 34;
      d.turnPhase = 'preRoll';
      d.trade = null;
    });
    const beforeMarketOpen = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    expect(s.players[0].cash).toBe(beforeMarketOpen + SALARY + STOCK_BY_CODE.SAFE.div * 3);
  });

  it('market sell is blocked during the Market Open window', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (d) => { d.trade = null; d.turnPhase = 'acted'; d.marketOpenWindow = true; });
    expect(canMarketSell(s)).toBe(false);
    const owned = s.players[0].shares.MEDI;
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 1 }, rng());
    expect(s.players[0].shares.MEDI).toBe(owned); // unchanged
  });
});
