// New house rules: market-trade qty cap, Controlling Stake dividend boost,
// and player-to-player negotiated trading.

import { describe, expect, it } from 'vitest';
import {
  CONTROL_DIVIDEND_MULTIPLIER, CONTROL_THRESHOLD_IPO, CONTROL_THRESHOLD_REGULAR,
  fullCompanyDividendPerMarketOpen, MAX_TRADE_QTY, REGULAR_SUPPLY, STOCK_BY_CODE,
} from '../data';
import { priceOf } from '../engine';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

describe('Regular stock supply is 11', () => {
  it('every regular stock starts with 11 shares', () => {
    const s = started();
    for (const code of Object.keys(STOCK_BY_CODE)) expect(s.supply[code]).toBe(11);
    expect(REGULAR_SUPPLY).toBe(11);
  });
});

describe('Max bank-sale quantity (half the 11-share company)', () => {
  it('buying out a company is unaffected by MAX_TRADE_QTY — always the full 11-share supply', () => {
    let s = started();
    s = rollTo(s, 5); // MEDI stock space
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[0].shares.MEDI).toBe(REGULAR_SUPPLY);
    expect(REGULAR_SUPPLY).toBeGreaterThan(MAX_TRADE_QTY);
  });

  it('rejects a sell of more than half the holding', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].shares.MEDI = REGULAR_SUPPLY; });
    s = rollTo(s, 5);
    const before = s.players[0].cash;
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: MAX_TRADE_QTY + 1 }, rng());
    expect(s.players[0].cash).toBe(before);
    expect(s.players[0].shares.MEDI).toBe(REGULAR_SUPPLY);
  });
});

describe('Controlling Stake dividend boost', () => {
  it('shows the full-company dividend paid each lap', () => {
    expect(fullCompanyDividendPerMarketOpen(STOCK_BY_CODE.FTRB)).toBe(2_200);
    expect(fullCompanyDividendPerMarketOpen(STOCK_BY_CODE.MEDI)).toBe(1_100);
    expect(fullCompanyDividendPerMarketOpen(STOCK_BY_CODE.CCAI)).toBe(0);
  });

  // Place player 0 at space 34 and roll [2,2] (sum 4) to wrap past Market
  // Open onto space 2 — same pattern used by scoring.test.ts's Rule 8 suite.
  it('doubles dividend for a regular stock at 6+ shares', () => {
    // FTRB is Low-risk -> $100/share dividend.
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; d.players[0].shares = { FTRB: CONTROL_THRESHOLD_REGULAR }; });
    const before = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    const gained = s.players[0].cash - before;
    // salary ($500) + 6 * $100 * 2 (controlling) = 500 + 1200 = 1700
    expect(gained).toBe(500 + STOCK_BY_CODE.FTRB.div * CONTROL_THRESHOLD_REGULAR * CONTROL_DIVIDEND_MULTIPLIER);
  });

  it('does not double dividend below the threshold', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; d.players[0].shares = { FTRB: CONTROL_THRESHOLD_REGULAR - 1 }; });
    const before = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    const gained = s.players[0].cash - before;
    expect(gained).toBe(500 + STOCK_BY_CODE.FTRB.div * (CONTROL_THRESHOLD_REGULAR - 1));
  });

  it('IPO controlling threshold is 3 shares', () => {
    // RNST is the only IPO with a nonzero dividend ($50/share).
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; d.players[0].shares = { RNST: CONTROL_THRESHOLD_IPO }; });
    const before = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    const gained = s.players[0].cash - before;
    expect(gained).toBe(500 + 50 * CONTROL_THRESHOLD_IPO * CONTROL_DIVIDEND_MULTIPLIER);
  });
});

describe('Player-to-player trading', () => {
  it('proposes, accepts, and transfers shares + cash directly (no market involvement)', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].shares.MEDI = 4; });
    const priceBefore = priceOf(s, 'MEDI');
    const supplyBefore = s.supply.MEDI;
    const p0CashBefore = s.players[0].cash;
    const p1CashBefore = s.players[1].cash;

    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 3, direction: 'sell', price: 4000 }, rng());
    expect(s.p2pOffers).toHaveLength(1);
    const offerId = s.p2pOffers[0].id;

    s = dispatch(s, { t: 'acceptP2POffer', id: offerId }, rng());
    expect(s.p2pOffers).toHaveLength(0);
    expect(s.players[0].shares.MEDI).toBe(1);
    expect(s.players[1].shares.MEDI).toBe(3);
    expect(s.players[0].cash).toBe(p0CashBefore + 4000);
    expect(s.players[1].cash).toBe(p1CashBefore - 4000);

    // Market price and bank supply are untouched by a private trade.
    expect(priceOf(s, 'MEDI')).toBe(priceBefore);
    expect(s.supply.MEDI).toBe(supplyBefore);
  });

  it('supports a "buy" direction offer (proposer pays cash for the target\'s shares)', () => {
    let s = started();
    s = patch(s, (d) => { d.players[1].shares.OILW = 2; });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'OILW', qty: 2, direction: 'buy', price: 2500 }, rng());
    const offerId = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'acceptP2POffer', id: offerId }, rng());
    expect(s.players[0].shares.OILW).toBe(2);
    expect(s.players[1].shares.OILW).toBeUndefined();
  });

  it('declining an offer removes it without transacting', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].shares.MEDI = 2; });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 2, direction: 'sell', price: 3000 }, rng());
    const offerId = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'declineP2POffer', id: offerId }, rng());
    expect(s.p2pOffers).toHaveLength(0);
    expect(s.players[0].shares.MEDI).toBe(2);
  });

  it('cancelling an offer removes it without transacting', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].shares.MEDI = 2; });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 2, direction: 'sell', price: 3000 }, rng());
    const offerId = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'cancelP2POffer', id: offerId }, rng());
    expect(s.p2pOffers).toHaveLength(0);
  });

  it('accept fails gracefully if the seller no longer has enough shares', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].shares.MEDI = 2; });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 2, direction: 'sell', price: 3000 }, rng());
    const offerId = s.p2pOffers[0].id;
    // Seller sells off their shares elsewhere before the offer is accepted.
    s = patch(s, (d) => { delete d.players[0].shares.MEDI; });
    const p1CashBefore = s.players[1].cash;
    s = dispatch(s, { t: 'acceptP2POffer', id: offerId }, rng());
    expect(s.p2pOffers).toHaveLength(0);
    expect(s.players[1].cash).toBe(p1CashBefore); // no transfer happened
  });

  it('rejects ETF codes and self-trades at propose time', () => {
    let s = started();
    const before = s.p2pOffers.length;
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'GRW', qty: 1, direction: 'sell', price: 1000 }, rng());
    expect(s.p2pOffers).toHaveLength(before); // ETF code rejected
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 0, code: 'MEDI', qty: 1, direction: 'sell', price: 100 }, rng());
    expect(s.p2pOffers).toHaveLength(before); // from === to rejected
  });
});
