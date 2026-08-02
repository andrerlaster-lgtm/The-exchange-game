// Rules 1-5 — trading timing, the all-or-nothing company buy-out, share supply,
// stock-space scope, and Market Event triggers.

import { describe, expect, it } from 'vitest';
import { LADDER, REGULAR_SUPPLY, START_CASH, STOCK_BY_CODE } from '../data';
import { priceOf } from '../engine';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

describe('Rule 1 — trading timing (no trade before rolling)', () => {
  it('blocks buy/sell while in preRoll', () => {
    const s = started();
    expect(s.turnPhase).toBe('preRoll');
    const after = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(after.players[0].cash).toBe(START_CASH);
    expect(Object.keys(after.players[0].shares)).toHaveLength(0);
  });

  it('allows a trade only after landing on a tradable space', () => {
    let s = started();
    s = rollTo(s, 5);
    expect(s.turnPhase).toBe('acted');
    expect(s.trade).toEqual({ scope: 'stock', code: 'MEDI', actionsLeft: 1 });
    const before = s.players[0].cash;
    const cost = priceOf(started(), 'MEDI') * REGULAR_SUPPLY;
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[0].shares.MEDI).toBe(REGULAR_SUPPLY);
    expect(s.players[0].cash).toBe(before - cost);
  });
});

describe('Rule 2 — buying a company is all-or-nothing (rulebook §10, all-or-nothing buy-out)', () => {
  it('buying pays price × 11, grants all 11 shares, and instantly sells the stock out', () => {
    let s = started();
    s = rollTo(s, 5); // MEDI stock space
    const price = priceOf(s, 'MEDI');
    const cashBefore = s.players[0].cash;
    const stepBefore = s.prices.MEDI;

    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());

    expect(s.players[0].shares.MEDI).toBe(REGULAR_SUPPLY);
    expect(s.players[0].cash).toBe(cashBefore - price * REGULAR_SUPPLY);
    expect(s.supply.MEDI).toBe(0);
    // Sellout trigger fires immediately: +1 price step, claim goes to the buyer.
    expect(s.prices.MEDI).toBe(stepBefore + 1);
    expect(s.soldOut.MEDI).toBeDefined();
    expect(s.soldOut.MEDI.claimHolder).toBe(0);
  });

  it('cannot buy without enough cash for the full payout', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].cash = 100; });
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[0].shares.MEDI).toBeUndefined();
    expect(s.supply.MEDI).toBe(REGULAR_SUPPLY);
    expect(s.soldOut.MEDI).toBeUndefined();
  });

  it('cannot buy a company that is already owned — no partial stake available', () => {
    let s = started(3);
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng()); // player 0 buys it out
    s = dispatch(s, { t: 'endTurn' }, rng());
    s = rollTo(s, 5); // player 1 lands on the now-owned MEDI
    const cashBefore = s.players[1].cash;
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[1].shares.MEDI ?? 0).toBe(0);
    expect(s.players[1].cash).toBe(cashBefore); // no purchase possible — rent already resolved on landing
  });

  it('sell-back pays one price step below market, not the market price (rulebook §11)', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    const step = s.prices.MEDI;
    const cash = s.players[0].cash;
    s = patch(s, (d) => { d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 1 }, rng());
    expect(s.players[0].cash).toBe(cash + LADDER[step - 1]);
    expect(LADDER[step - 1]).toBeLessThan(LADDER[step]);
  });

  it('sell-back at the $100 floor pays the floor price (no negative step)', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    const cash = s.players[0].cash;
    s = patch(s, (d) => { d.prices.MEDI = 0; d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 1 }, rng());
    expect(s.players[0].cash).toBe(cash + LADDER[0]);
  });

  it('selling 2+ shares back still moves the price down one step', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    const base = s.prices.MEDI;
    s = patch(s, (d) => { d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    expect(s.prices.MEDI).toBe(base - 1);
  });

  it('sold-back shares go to the bank auction pool, not back on the open market', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (d) => { d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    expect(s.supply.MEDI).toBe(0);        // still nothing for sale directly
    expect(s.bankPool.MEDI).toBe(2);      // pooled for the next Bank Auction
  });

  it('clamps at the top of the ladder on buy-out', () => {
    let s = started();
    s = patch(s, (d) => { d.prices.MEDI = LADDER.length - 1; });
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.prices.MEDI).toBe(LADDER.length - 1);
  });
});

describe('Rule 3 — share supply limits & stock-space scope', () => {
  it('starts every regular stock at full (11-share) supply', () => {
    const s = started();
    for (const code of Object.keys(STOCK_BY_CODE)) expect(s.supply[code]).toBe(REGULAR_SUPPLY);
  });

  it('buying takes the whole supply to 0 in one shot', () => {
    let s = started();
    s = rollTo(s, 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.supply.MEDI).toBe(0);
  });

  it('blocks buying when supply is already exhausted', () => {
    let s = started();
    s = patch(s, (d) => { d.supply.MEDI = 0; d.soldOut.MEDI = { code: 'MEDI', claimHolder: null }; });
    s = rollTo(s, 5);
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[0].shares.MEDI).toBeUndefined();
    expect(s.players[0].cash).toBe(cash);
  });

  it('on a stock space only that stock may be traded', () => {
    let s = started();
    s = rollTo(s, 5);
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'buy', code: 'CCAI' }, rng());
    expect(s.players[0].shares.CCAI).toBeUndefined();
    expect(s.players[0].cash).toBe(cash);
  });
});

describe('Rule 4 — Market Event: triggered by landing on space 19 (not Market Open)', () => {
  it('passing Market Open does NOT queue a Market Event draw (payday only)', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].pos = 34; }); // roll 2+2 → pos 2, passes MO at 1
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    expect(s.players[0].pos).toBe(2);
    expect(s.pendingDraws).toHaveLength(0); // Market Open is payday only — no ME draw
  });

  it('landing on space 19 queues a Market Event draw', () => {
    let s = started();
    s = rollTo(s, 19); // Market Event space
    expect(s.players[0].pos).toBe(19);
    expect(s.pendingDraws[0]).toBe('ME');
  });

  it('drawing the ME card resolves the effect and clears pendingDraws', () => {
    let s = started();
    s = patch(s, (d) => { d.turnPhase = 'acted'; d.pendingDraws = ['ME']; });
    s = dispatch(s, { t: 'draw', deck: 'ME' }, scriptedRng([]));
    expect(s.pendingDraws).toHaveLength(0);
    expect(s.card).not.toBeNull();
    expect(s.trade).toBeNull();
  });
});

describe('Rule 4 — Free Trading Day: 2 trade actions', () => {
  it('grants 2 actionsLeft and allows buying out two different companies', () => {
    let s = started();
    // Buying out two companies in one day is expensive — give plenty of cash so
    // the test isolates the action-count/ownership behavior from affordability.
    s = patch(s, (d) => { d.players[0].cash = 100_000; d.turnPhase = 'acted'; d.trade = { scope: 'free', actionsLeft: 2 }; });
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.trade!.actionsLeft).toBe(1);
    s = dispatch(s, { t: 'buy', code: 'CCAI' }, rng());
    expect(s.trade!.actionsLeft).toBe(0);
    expect(s.players[0].shares.MEDI).toBe(REGULAR_SUPPLY);
    expect(s.players[0].shares.CCAI).toBe(REGULAR_SUPPLY);
  });

  it('blocks a third trade on Free Trading Day', () => {
    let s = started();
    s = patch(s, (d) => { d.players[0].cash = 100_000; d.turnPhase = 'acted'; d.trade = { scope: 'free', actionsLeft: 2 }; });
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = dispatch(s, { t: 'buy', code: 'CCAI' }, rng());
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'buy', code: 'IRON' }, rng());
    expect(s.players[0].cash).toBe(cash);
    expect(s.players[0].shares.IRON).toBeUndefined();
  });
});

// Phase 7 rewrote the IPO reveal/buy/pricing model — see ipo.test.ts.
