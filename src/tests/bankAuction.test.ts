// Bank Auction variant (opts.bankAuction — off by default, rulebook standard
// mode uses Outstanding Shares instead; see auction.test.ts). Turning it on
// swaps the resale channel: pooled shares no longer offer an exclusive
// landing purchase — they wait for a turn-order bidding war at Market Open.

import { describe, expect, it } from 'vitest';
import { blocked, minNextBid } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

const CODE = 'MEDI';

function startedWithAuction(numPlayers = 2) {
  return patch(started(numPlayers), (d) => { d.opts.bankAuction = true; });
}

function withPool(s: ReturnType<typeof started>, qty: number, claimHolder: number | null = 0) {
  return patch(s, (d) => {
    d.supply[CODE] = 0;
    d.soldOut[CODE] = { code: CODE, claimHolder };
    d.bankPool[CODE] = qty;
  });
}

function landOnMedi(s: ReturnType<typeof started>) {
  const placed = patch(s, (d) => { d.players[d.cur].pos = 2; d.turnPhase = 'preRoll'; });
  return dispatch(placed, { t: 'roll' }, scriptedRng([1, 2]));
}

function passMarketOpen(s: ReturnType<typeof started>) {
  const placed = patch(s, (d) => { d.players[d.cur].pos = 34; d.turnPhase = 'preRoll'; });
  return dispatch(placed, { t: 'roll' }, scriptedRng([1, 2])); // 34 + 3 -> space 1
}

describe('Bank Auction option — off by default', () => {
  it('defaults to false, so a fresh game still uses Outstanding Shares', () => {
    const s = started(2);
    expect(s.opts.bankAuction).toBe(false);
  });
});

describe('Bank Auction option — on', () => {
  it('does not offer an outstanding-share purchase on landing', () => {
    let s = startedWithAuction();
    s = withPool(s, 2, 0);
    s = patch(s, (d) => { d.players[0].shares[CODE] = 8; });
    s = landOnMedi(s);

    expect(s.outstandingBuy).toBeNull();
    expect(s.bankPool[CODE]).toBe(2); // untouched — still waiting for the auction
  });

  it('opens a Bank Auction when a player passes Market Open with pooled shares', () => {
    let s = startedWithAuction();
    s = withPool(s, 2, 0);
    s = passMarketOpen(s);

    expect(s.auction).not.toBeNull();
    expect(s.auction!.code).toBe(CODE);
    expect(s.auction!.poolLeft).toBe(2);
    expect(s.auction!.highBidder).toBeNull();
    expect(blocked(s)).toBe(true); // End Turn is gated until the auction resolves
  });

  it('does not open an auction when there is nothing pooled', () => {
    let s = startedWithAuction();
    s = passMarketOpen(s);
    expect(s.auction).toBeNull();
  });

  it('resolves a full bid/pass cycle through dispatch and awards the share', () => {
    let s = startedWithAuction();
    s = withPool(s, 1, 0);
    s = passMarketOpen(s);
    const start = s.auction!.startPrice;
    const winnerCashBefore = s.players[1].cash;

    s = dispatch(s, { t: 'auctionBid', amount: start }, rng()); // p0 opens
    expect(s.auction!.highBidder).toBe(0);
    s = dispatch(s, { t: 'auctionBid', amount: start + 100 }, rng()); // p1 raises
    expect(s.auction!.highBidder).toBe(1);
    s = dispatch(s, { t: 'auctionPass' }, rng()); // p0 passes -> p1 wins

    expect(s.auction).toBeNull();
    expect(s.players[1].shares[CODE]).toBe(1);
    expect(s.players[1].cash).toBe(winnerCashBefore - (start + 100));
    expect(s.bankPool[CODE]).toBe(0);
  });

  it('rejects a bid below the minimum next bid', () => {
    let s = startedWithAuction();
    s = withPool(s, 1, 0);
    s = passMarketOpen(s);
    const min = minNextBid(s);

    s = dispatch(s, { t: 'auctionBid', amount: min - 1 }, rng());
    expect(s.auction!.highBidder).toBeNull();
  });

  it('resets cleanly on a new game (auction and pool both clear)', () => {
    let s = startedWithAuction();
    s = withPool(s, 2, 0);
    s = passMarketOpen(s);
    expect(s.auction).not.toBeNull();

    s = dispatch(s, { t: 'setNum', n: 3 }, rng());
    s = dispatch(s, { t: 'startGame' }, rng());
    expect(s.auction).toBeNull();
    expect(s.auctionQueue).toEqual([]);
    expect(s.bankPool[CODE] ?? 0).toBe(0);
  });
});
