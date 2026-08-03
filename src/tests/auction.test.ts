// Phase 3: Bank Auctions. Pooled shares of sold-out stocks are auctioned at
// Market Open with ascending, turn-order bidding.

import { describe, expect, it } from 'vitest';
import { blocked } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

const CODE = 'MEDI';

/** Roll the current player around the board to land on Market Open (space 1). */
function passMarketOpen(s: ReturnType<typeof started>) {
  const placed = patch(s, (d) => { d.players[d.cur].pos = 35; d.turnPhase = 'preRoll'; });
  return dispatch(placed, { t: 'roll' }, scriptedRng([1, 1])); // 35 + 2 -> space 1
}

/** Set MEDI sold out with `pool` shares awaiting auction. */
function withPool(s: ReturnType<typeof started>, pool: number, claimHolder: number | null = 0) {
  return patch(s, (d) => {
    d.supply[CODE] = 0;
    d.soldOut[CODE] = { code: CODE, claimHolder };
    d.bankPool[CODE] = pool;
  });
}

describe('Bank Auction — opening', () => {
  it('opens at Market Open when a sold-out stock has pooled shares', () => {
    let s = started(2);
    s = withPool(s, 1);
    s = passMarketOpen(s);
    expect(s.auction).not.toBeNull();
    expect(s.auction!.code).toBe(CODE);
    expect(s.auction!.poolLeft).toBe(1);
    expect(s.auction!.highBidder).toBeNull();
    expect(s.auction!.actor).toBe(0);   // current player bids first
    expect(blocked(s)).toBe(true);      // End Turn is gated until it resolves
  });

  it('does not open when there are no pooled shares', () => {
    let s = started(2);
    s = passMarketOpen(s);
    expect(s.auction).toBeNull();
  });
});

describe('Bank Auction — bidding', () => {
  it('awards the share to the higher bidder and closes the auction', () => {
    let s = started(2);
    s = withPool(s, 1);
    s = passMarketOpen(s);
    const start = s.auction!.startPrice;
    const p1CashBefore = s.players[1].cash;

    s = dispatch(s, { t: 'auctionBid', amount: start }, rng());        // p0 opens at start
    expect(s.auction!.highBidder).toBe(0);
    expect(s.auction!.actor).toBe(1);
    s = dispatch(s, { t: 'auctionBid', amount: start + 100 }, rng());  // p1 raises
    expect(s.auction!.highBidder).toBe(1);
    s = dispatch(s, { t: 'auctionPass' }, rng());                      // p0 passes -> p1 wins

    expect(s.auction).toBeNull();
    expect(s.players[1].shares[CODE]).toBe(1);
    expect(s.players[1].cash).toBe(p1CashBefore - (start + 100));
    expect(s.bankPool[CODE]).toBe(0);
  });

  it('promotes an auction takeover when control passes to another player', () => {
    let s = withPool(started(2), 1, 0);
    s = patch(s, (d) => {
      d.players[0].shares[CODE] = 4;
      d.players[1].shares[CODE] = 4;
    });
    s = passMarketOpen(s);
    const start = s.auction!.startPrice;
    s = dispatch(s, { t: 'auctionPass' }, rng());
    s = dispatch(s, { t: 'auctionBid', amount: start }, rng());

    expect(s.soldOut[CODE].claimHolder).toBe(1);
    expect(s.marketSignals[0]).toMatchObject({
      kind: 'claim',
      title: `${CODE} Taken Over`,
    });
    expect(s.marketSignals[0].summary).toContain('Riley took control');
  });

  it('lets a single remaining bidder win uncontested after others pass', () => {
    let s = started(2);
    s = withPool(s, 1);
    s = passMarketOpen(s);
    const start = s.auction!.startPrice;
    s = dispatch(s, { t: 'auctionPass' }, rng());                 // p0 passes
    expect(s.auction!.actor).toBe(1);
    s = dispatch(s, { t: 'auctionBid', amount: start }, rng());   // p1 bids -> wins
    expect(s.auction).toBeNull();
    expect(s.players[1].shares[CODE]).toBe(1);
  });

  it('leaves shares in the pool when everyone passes (no bids)', () => {
    let s = started(2);
    s = withPool(s, 1);
    s = passMarketOpen(s);
    s = dispatch(s, { t: 'auctionPass' }, rng());
    s = dispatch(s, { t: 'auctionPass' }, rng());
    expect(s.auction).toBeNull();
    expect(s.bankPool[CODE]).toBe(1);   // unsold, stays pooled
    expect(s.log.some((l) => /no bids/i.test(l.text))).toBe(true);
  });

  it('auto-passes a player who cannot meet the minimum bid', () => {
    let s = started(3);
    s = withPool(s, 1);
    // Push MEDI to the ceiling so the start price is high, and starve player 1.
    s = patch(s, (d) => { d.prices[CODE] = 11; d.players[1].cash = 0; });
    s = passMarketOpen(s);
    const start = s.auction!.startPrice; // $4,000 (one step below $5,000)
    s = dispatch(s, { t: 'auctionPass' }, rng());               // p0 passes; p1 auto-passed (broke); p2 to act
    expect(s.auction!.actor).toBe(2);
    s = dispatch(s, { t: 'auctionBid', amount: start }, rng()); // p2 wins uncontested
    expect(s.auction).toBeNull();
    expect(s.players[2].shares[CODE]).toBe(1);
    expect(s.players[1].shares[CODE] ?? 0).toBe(0);
    expect(s.log.some((l) => /auto-pass/i.test(l.text))).toBe(true);
  });
});

describe('Bank Auction — sequencing & guards', () => {
  it('auctions each pooled stock in turn', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0; d.soldOut[CODE] = { code: CODE, claimHolder: 0 }; d.bankPool[CODE] = 1;
      d.supply.OILW = 0; d.soldOut.OILW = { code: 'OILW', claimHolder: 0 }; d.bankPool.OILW = 1;
    });
    s = passMarketOpen(s);
    expect(s.auction!.code).toBe(CODE);
    const start = s.auction!.startPrice;
    s = dispatch(s, { t: 'auctionBid', amount: start }, rng()); // p0
    s = dispatch(s, { t: 'auctionPass' }, rng());              // p1 -> p0 wins MEDI
    // Next stock's auction opens automatically.
    expect(s.auction).not.toBeNull();
    expect(s.auction!.code).toBe('OILW');
  });

  it('blocks buying while an auction is live', () => {
    let s = started(2);
    s = withPool(s, 1);
    s = passMarketOpen(s);
    const before = s.players[0].shares[CODE] ?? 0;
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.players[0].shares[CODE] ?? 0).toBe(before);
  });
});
