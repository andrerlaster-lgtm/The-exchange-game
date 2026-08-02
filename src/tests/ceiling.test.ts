// Phase 2: reaching the $5,000 price ceiling triggers a global Market Event.
// Floor ($100) is already enforced by clampStep; this covers the ceiling trigger.
// Under the all-or-nothing buy-out model, every successful buy immediately
// triggers the sellout +1 step bump (no more deferred/queued rise), so a buy-out
// from one step below the ceiling is the only way to reach it via buying.

import { describe, expect, it } from 'vitest';
import { LADDER } from '../data';
import { dispatch, patch, rng, started } from './helpers';

const CEIL = LADDER.length - 1; // step index of $5,000
const CODE = 'MEDI';

function withTrade(s: ReturnType<typeof started>, code = CODE) {
  return patch(s, (d) => {
    d.turnPhase = 'acted';
    d.trade = { scope: 'stock', code, actionsLeft: 1 };
  });
}

describe('Price ceiling → Market Event', () => {
  it('a buy-out from one step below the ceiling reaches it and triggers a Market Event', () => {
    let s = started(2);
    // At step CEIL-1 ($4,000/share), buying out all 11 shares costs $44,000 —
    // far more than starting cash, so fund the purchase explicitly.
    s = patch(s, (d) => { d.prices[CODE] = CEIL - 1; d.players[0].cash = 100_000; });
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.prices[CODE]).toBe(CEIL);
    expect(s.soldOut[CODE]).toBeDefined();
    expect(s.pendingDraws).toContain('ME');
    expect(s.log.some((l) => /ceiling/i.test(l.text))).toBe(true);
  });

  it('does not re-trigger buying out a company that starts already at the ceiling', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices[CODE] = CEIL; d.players[0].cash = 100_000; });
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.prices[CODE]).toBe(CEIL); // clamped, no further movement
    expect(s.pendingDraws).not.toContain('ME'); // no before<ceiling -> at-ceiling transition
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
