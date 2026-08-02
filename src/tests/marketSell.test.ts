// Trading Market — the current player can sell owned stock on their turn without
// having to land on that stock's space (still moves price on 2+ share sales).

import { describe, expect, it } from 'vitest';
import { canMarketSell, priceOf, sellBackPrice } from '../engine';

import { dispatch, patch, rng, rollTo, started } from './helpers';

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

  it('selling 2+ from the market still drops the price one step', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (d) => { d.trade = null; d.turnPhase = 'acted'; });
    const base = s.prices.MEDI;
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    expect(s.prices.MEDI).toBe(base - 1);
    expect(s.players[0].shares.MEDI).toBe(9);
  });

  it('allows unlimited market sells in one turn (no per-turn cap)', () => {
    let s = started();
    s = rollTo(s, 5);
    // Acquire several distinct holdings, then move off the Trade Step.
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 2, SAFE: 1, OILW: 1 };
      d.trade = null; d.turnPhase = 'acted'; d.pendingDraws = [];
    });

    // Sell holding after holding — the market stays open the whole turn.
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 1 }, rng());
    expect(canMarketSell(s)).toBe(true);
    s = dispatch(s, { t: 'sell', code: 'SAFE', qty: 1 }, rng());
    expect(canMarketSell(s)).toBe(true);
    s = dispatch(s, { t: 'sell', code: 'OILW', qty: 1 }, rng());

    expect(s.players[0].shares.MEDI).toBe(1);
    expect(s.players[0].shares.SAFE ?? 0).toBe(0);
    expect(s.players[0].shares.OILW ?? 0).toBe(0);
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
