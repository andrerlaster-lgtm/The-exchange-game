// Player-to-player trades: accepting an offer must never let a buyer pay more
// cash than they have, or a seller hand over more shares than they hold.

import { describe, expect, it } from 'vitest';
import { dispatch, patch, rng, started } from './helpers';
import { payMarketOpen } from '../engine/playerState';

describe('P2P trade — affordability guard', () => {
  it('transfers majority control while the seller keeps shares and dividends', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 11 };
      d.players[0].stockCostBasis = { MEDI: 8_250 };
      d.players[1].cash = 20_000;
      d.supply.MEDI = 0;
      d.soldOut.MEDI = { code: 'MEDI', claimHolder: 0 };
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 6, direction: 'sell', price: 7_000 }, rng());
    const offerId = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'acceptP2POffer', id: offerId }, rng());

    expect(s.players[0].shares.MEDI).toBe(5);
    expect(s.players[1].shares.MEDI).toBe(6);
    expect(s.soldOut.MEDI.claimHolder).toBe(1);
    expect(s.players[0].cash).toBe(37_000);
    expect(s.players[1].cash).toBe(13_000);

    s = patch(s, () => {});
    const sellerBefore = s.players[0].cash;
    const buyerBefore = s.players[1].cash;
    payMarketOpen(s, 0);
    payMarketOpen(s, 1);
    expect(s.players[0].cash - sellerBefore).toBe(750); // $500 salary + 5 × $50 dividend
    expect(s.players[1].cash - buyerBefore).toBe(1_100); // $500 salary + 6 × $50 × control bonus
  });

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
