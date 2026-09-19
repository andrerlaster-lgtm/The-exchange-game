// Crossing the $5,000 mark upward on a trade-driven move triggers a global
// Market Event. Since the percentage redesign this is a one-way THRESHOLD, not
// a hard cap: prices may sit above it, and the trigger re-arms only after a
// company falls back below. The $100 floor is enforced by applyBasisPoints.
// Fixed-tier company buyouts do not move the live share price, so acquisition
// must not create a ceiling event even when the stock is near the mark.

import { describe, expect, it } from 'vitest';
import { CEILING_TRIGGER, MOVE_BP } from '../data';
import { moveTradePrice } from '../engine/stockState';
import { dispatch, patch, rng, started } from './helpers';

const CEIL = CEILING_TRIGGER;
const CODE = 'MEDI';

function withTrade(s: ReturnType<typeof started>, code = CODE) {
  return patch(s, (d) => {
    d.turnPhase = 'acted';
    d.trade = { scope: 'stock', code, actionsLeft: 1 };
  });
}

describe('Price ceiling and fixed-tier buyouts', () => {
  it('a buy-out from just below the mark leaves the price unchanged and triggers no event', () => {
    let s = started(2);
    // 2026-08-23: the whole-company buy-out now costs REGULAR_SUPPLY × the
    // LIVE price (previously a fixed tier price), so a near-ceiling buyout
    // costs far more than the default starting cash — top up cash so this
    // test still exercises the ceiling behavior it's actually about, not an
    // affordability check.
    s = patch(s, (d) => { d.prices[CODE] = CEIL - 25; d.players[0].cash = 1_000_000; });
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.prices[CODE]).toBe(CEIL - 25);
    expect(s.soldOut[CODE]).toBeDefined();
    expect(s.pendingDraws).not.toContain('ME');
  });

  it('does not re-trigger buying out a company that starts already at the mark', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices[CODE] = CEIL; d.players[0].cash = 1_000_000; });
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.soldOut[CODE]).toBeDefined(); // confirms the buy actually went through
    expect(s.prices[CODE]).toBe(CEIL); // a buy-out never moves the live price
    expect(s.pendingDraws).not.toContain('ME'); // no below -> at/above crossing
  });

  it('cannot buy out an already-owned company at all (no partial/repeat purchase)', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.prices[CODE] = CEIL;
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
    });
    s = withTrade(s);
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.players[0].shares[CODE] ?? 0).toBe(0);
    expect(s.players[0].cash).toBe(cash);
    expect(s.pendingDraws).not.toContain('ME');
  });

  it('does not trigger on downward moves (2-share sell)', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.prices[CODE] = CEIL;
      d.players[0].shares[CODE] = 4;
      d.soldOut[CODE] = { code: CODE, claimHolder: 0 };
    });
    s = withTrade(s);
    s = dispatch(s, { t: 'sell', code: CODE, qty: 2 }, rng());
    expect(s.pendingDraws).not.toContain('ME');
  });

  // Phase 7: IPO prices no longer move from buying (rulebook §16) — only card
  // effects move them, and card-driven moves never queue a Market Event
  // (deliberately excluded to avoid card-in-card cascades). So an IPO buy can
  // no longer reach — let alone trigger — the ceiling; see ipo.test.ts for the
  // no-price-movement rule.
});

// The percentage redesign turned the old top rung into a one-way threshold.
// These cover behaviour a hard cap used to make impossible.
describe('$5,000 mark as a one-way threshold', () => {
  it('a trade-driven move that crosses upward queues exactly one Market Event', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices[CODE] = CEIL - 25; d.pendingDraws = []; });
    s = patch(s, (d) => { moveTradePrice(d, CODE, MOVE_BP.strongDemand, 'strongDemand'); });
    expect(s.prices[CODE]).toBeGreaterThan(CEIL);
    expect(s.pendingDraws.filter((deck) => deck === 'ME')).toHaveLength(1);
  });

  it('moving further up while already above the mark does not re-trigger', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices[CODE] = CEIL + 100; d.pendingDraws = []; });
    s = patch(s, (d) => { moveTradePrice(d, CODE, MOVE_BP.strongDemand, 'strongDemand'); });
    expect(s.prices[CODE]).toBeGreaterThan(CEIL);
    expect(s.pendingDraws).not.toContain('ME');
  });

  it('re-arms once the company falls back below the mark', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices[CODE] = CEIL + 100; d.pendingDraws = []; });
    s = patch(s, (d) => { d.prices[CODE] = CEIL - 25; }); // fall back under
    s = patch(s, (d) => { moveTradePrice(d, CODE, MOVE_BP.strongDemand, 'strongDemand'); });
    expect(s.pendingDraws.filter((deck) => deck === 'ME')).toHaveLength(1);
  });

  it('prices are no longer capped — a company can run well past the mark', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices[CODE] = CEIL; });
    for (let i = 0; i < 5; i += 1) {
      s = patch(s, (d) => { moveTradePrice(d, CODE, MOVE_BP.strongDemand, 'strongDemand'); });
    }
    expect(s.prices[CODE]).toBeGreaterThan(6_000); // five compounding +5% moves
    expect(s.prices[CODE] % 25).toBe(0);           // and still on the grid
  });

  it('a downward move never queues a Market Event, even crossing the mark', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices[CODE] = CEIL + 100; d.pendingDraws = []; });
    s = patch(s, (d) => { moveTradePrice(d, CODE, MOVE_BP.bankSale, 'bankSale'); });
    expect(s.prices[CODE]).toBeLessThan(CEIL + 100);
    expect(s.pendingDraws).not.toContain('ME');
  });
});
