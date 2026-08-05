// Phase 5: Market Open Trading Window. After Market Open payouts, an explicit
// private-trading window opens for all players before the turn can continue.

import { describe, expect, it } from 'vitest';
import { blocked } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

/** Roll the current player onto Market Open (space 1). */
function passMarketOpen(s: ReturnType<typeof started>) {
  const placed = patch(s, (d) => { d.players[d.cur].pos = 34; d.turnPhase = 'preRoll'; });
  return dispatch(placed, { t: 'roll' }, scriptedRng([1, 2])); // 34 + 3 -> space 1
}

describe('Market Open Trading Window — opening', () => {
  it('opens whenever a player passes or lands on Market Open', () => {
    let s = started(2);
    s = passMarketOpen(s);
    expect(s.marketOpenWindow).toBe(true);
  });

  it('does not open on a normal landing elsewhere on the board', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 3; d.turnPhase = 'preRoll'; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 2])); // 3 + 3 -> space 6, no MO pass
    expect(s.marketOpenWindow).toBe(false);
  });

  it('blocks End Turn until the window is explicitly closed', () => {
    let s = started(2);
    s = passMarketOpen(s);
    expect(blocked(s)).toBe(true);
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(0); // endTurn was a no-op — still blocked
  });
});

describe('Market Open Trading Window — closing', () => {
  it('closes on closeMarketOpenWindow and unblocks End Turn', () => {
    let s = started(2);
    s = passMarketOpen(s);
    s = dispatch(s, { t: 'closeMarketOpenWindow' }, rng());
    expect(s.marketOpenWindow).toBe(false);
    expect(blocked(s)).toBe(false);
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(1);
  });

  it('does not auction outstanding shares or prevent the window from closing', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply.MEDI = 0;
      d.soldOut.MEDI = { code: 'MEDI', claimHolder: 0 };
      d.bankPool.MEDI = 1;
    });
    s = passMarketOpen(s);
    expect(s.auction).toBeNull();
    expect(s.bankPool.MEDI).toBe(1);
    s = dispatch(s, { t: 'closeMarketOpenWindow' }, rng());
    expect(s.marketOpenWindow).toBe(false);
  });

  it('is a no-op when no window is open', () => {
    let s = started(2);
    s = dispatch(s, { t: 'closeMarketOpenWindow' }, rng());
    expect(s.marketOpenWindow).toBe(false);
  });
});

describe('Market Open Trading Window — P2P trading stays available', () => {
  it('any player may propose and accept a trade while the window is open', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].shares.MEDI = 2; });
    s = passMarketOpen(s);
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 1, direction: 'sell', price: 500 }, rng());
    const id = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'acceptP2POffer', id }, rng());
    expect(s.players[1].shares.MEDI).toBe(1);
  });
});
