// Player-to-player trades: accepting an offer must never let a buyer pay more
// cash than they have, or a seller hand over more shares than they hold.

import { describe, expect, it } from 'vitest';
import { dispatch, patch, rng, started } from './helpers';

describe('P2P trade — affordability guard', () => {
  it('accepting an offer the buyer cannot afford does nothing (no cash/shares move)', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 2 };
      d.players[1].cash = 100; // far less than the offer price below
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 1, direction: 'sell', price: 5000 }, rng());
    const offerId = s.p2pOffers[0].id;

    s = dispatch(s, { t: 'acceptP2POffer', id: offerId }, rng());

    expect(s.players[1].cash).toBe(100);           // buyer's cash unchanged
    expect(s.players[1].shares.MEDI ?? 0).toBe(0);  // buyer got nothing
    expect(s.players[0].shares.MEDI).toBe(2);       // seller still holds the shares
    expect(s.p2pOffers).toHaveLength(0);            // offer is cleared either way
    expect(s.log.some((l) => /fell through/i.test(l.text))).toBe(true);
  });

  it('accepting an affordable offer transfers cash and shares normally', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 2 };
      d.players[1].cash = 5000;
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 1, direction: 'sell', price: 1000 }, rng());
    const offerId = s.p2pOffers[0].id;

    s = dispatch(s, { t: 'acceptP2POffer', id: offerId }, rng());

    expect(s.players[1].cash).toBe(4000);
    expect(s.players[1].shares.MEDI).toBe(1);
    expect(s.players[0].shares.MEDI).toBe(1);
  });

  it('accepting an offer the seller can no longer cover (shares sold elsewhere) does nothing', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 1 };
      d.players[1].cash = 5000;
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 1, direction: 'sell', price: 1000 }, rng());
    const offerId = s.p2pOffers[0].id;
    // Seller loses the share before the offer is accepted (e.g. a forced sale).
    s = patch(s, (d) => { d.players[0].shares = {}; });

    s = dispatch(s, { t: 'acceptP2POffer', id: offerId }, rng());

    expect(s.players[1].cash).toBe(5000);
    expect(s.players[1].shares.MEDI ?? 0).toBe(0);
  });
});
