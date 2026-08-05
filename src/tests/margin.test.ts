// Margin system: taking margin (capped), the Market Open half-balance margin
// call, and the forced sell-to-cover default with a flat penalty.

import { describe, expect, it } from 'vitest';
import { MARGIN_DEFAULT_PENALTY, MARGIN_MAX, SPACES } from '../data';
import { blocked } from '../engine';
import { marginCallDue } from '../engine/playerState';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

const STOCK_SPACE = SPACES.find((sp) => sp.type === 'stock')!.n;

// Put the current player on a stock space with an active trade so margin can be taken.
function onStockSpace() {
  let s = started(2);
  s = patch(s, (d) => {
    d.opts.margin = true; // margin is off by default (rulebook §21) — opt in for these tests
    d.turnPhase = 'acted';
    d.trade = { scope: 'stock', code: SPACES[STOCK_SPACE - 1].code!, actionsLeft: 1 };
  });
  return s;
}

describe('Margin — taking & cap', () => {
  it('takes margin in $2,000 steps and caps at $4,000', () => {
    let s = onStockSpace();
    const cash0 = s.players[0].cash;
    s = dispatch(s, { t: 'takeMargin' }, rng());
    expect(s.players[0].margin).toBe(2000);
    expect(s.players[0].cash).toBe(cash0 + 2000);
    s = dispatch(s, { t: 'takeMargin' }, rng());
    expect(s.players[0].margin).toBe(MARGIN_MAX); // 4000
    // Third attempt is rejected — already at the cap.
    s = dispatch(s, { t: 'takeMargin' }, rng());
    expect(s.players[0].margin).toBe(MARGIN_MAX);
  });

  it('rejects a full $2,000 increment that would push a mid-value balance past the cap', () => {
    // Mid-value balances are reachable via a partial Market Open margin-call
    // repayment (the cash-portion payoff isn't a round $2,000 step). A guard that
    // only checks "already at the cap" (margin >= MARGIN_MAX) would wrongly allow
    // another full increment here, e.g. $2,300 -> $4,300 — breaching the cap.
    let s = onStockSpace();
    s = patch(s, (d) => { d.players[0].margin = 2300; d.players[0].cash = 10000; });
    s = dispatch(s, { t: 'takeMargin' }, rng());
    expect(s.players[0].margin).toBe(2300); // rejected, unchanged
    expect(s.players[0].margin).toBeLessThanOrEqual(MARGIN_MAX);
  });

  it('still allows a full increment exactly up to the cap from a mid-value balance', () => {
    let s = onStockSpace();
    s = patch(s, (d) => { d.players[0].margin = 2000; d.players[0].cash = 10000; });
    s = dispatch(s, { t: 'takeMargin' }, rng());
    expect(s.players[0].margin).toBe(4000); // exactly at the cap — allowed
  });
});

describe('Margin — call computation', () => {
  it('charges half the balance, rounded to nearest $100', () => {
    expect(marginCallDue(4000)).toBe(2000);
    expect(marginCallDue(2000)).toBe(1000);
    expect(marginCallDue(0)).toBe(0);
  });
});

describe('Margin — Market Open call', () => {
  it('pays half from cash when affordable, no penalty', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].margin = 4000; d.players[0].cash = 10000; d.players[0].pos = 1; d.turnPhase = 'preRoll'; });
    // Roll back onto Market Open to trigger the call (4+4 from pos 1 → lands 9, passes... use pos that lands on 1).
    s = patch(s, (d) => { d.players[0].pos = 33; }); // 33 + 4 = 37 → space 1, passes MO
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // total 4
    expect(s.players[0].pos).toBe(1);
    expect(s.players[0].margin).toBe(2000);   // paid half
    expect(s.marginCall).toBeNull();          // covered from cash, no default
  });

  it('defaults into a forced sell-to-cover state when cash is short', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].margin = 4000;
      d.players[0].cash = 0;            // cannot cover the $2,000 call
      d.players[0].shares = { MEDI: 3 }; // owns stock to liquidate
      d.players[0].pos = 33;
      d.turnPhase = 'preRoll';
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // → space 1, margin call

    expect(s.players[0].pos).toBe(1);
    expect(s.marginCall).not.toBeNull();
    expect(s.marginCall!.owed).toBeGreaterThan(0);
    expect(blocked(s)).toBe(true); // turn is blocked until resolved

    // Cannot pay yet — no cash.
    const owed = s.marginCall!.owed;
    s = dispatch(s, { t: 'payMarginCall' }, rng());
    expect(s.marginCall).not.toBeNull(); // rejected, still owed

    // Sell stock to raise enough cash.
    while (s.players[0].cash < owed && (s.players[0].shares['MEDI'] ?? 0) > 0) {
      s = dispatch(s, { t: 'marginSell', code: 'MEDI' }, rng());
    }
    expect(s.players[0].cash).toBeGreaterThanOrEqual(owed);

    const cashBefore = s.players[0].cash;
    const marginBefore = s.players[0].margin;
    s = dispatch(s, { t: 'payMarginCall' }, rng());

    expect(s.marginCall).toBeNull();
    expect(s.players[0].margin).toBe(marginBefore - owed);
    // Paid the owed amount plus the flat penalty.
    expect(s.players[0].cash).toBe(cashBefore - owed - MARGIN_DEFAULT_PENALTY);
  });

  it('blocks voluntary repayMargin while an active margin call is unresolved', () => {
    // Without this guard, a player could raise cash for the call via marginSell,
    // then spend it on the voluntary "Repay Margin" action instead of actually
    // paying the call — margin drops but marginCall.owed is untouched, leaving
    // the player to raise the exact same amount again (or get stuck if they run
    // out of shares to sell).
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].margin = 4000;
      d.players[0].cash = 0;
      d.players[0].shares = { MEDI: 5 };
      d.marginCall = { player: 0, owed: 2000 };
    });
    while (s.players[0].cash < 2000 && (s.players[0].shares['MEDI'] ?? 0) > 0) {
      s = dispatch(s, { t: 'marginSell', code: 'MEDI' }, rng());
    }
    expect(s.players[0].cash).toBeGreaterThanOrEqual(2000);

    const before = { cash: s.players[0].cash, margin: s.players[0].margin };
    s = dispatch(s, { t: 'repayMargin' }, rng());

    expect(s.players[0].margin).toBe(before.margin); // rejected — unchanged
    expect(s.players[0].cash).toBe(before.cash);
    expect(s.marginCall).not.toBeNull(); // still active, still owed the full amount

    // The forced-settlement path still works normally.
    s = dispatch(s, { t: 'payMarginCall' }, rng());
    expect(s.marginCall).toBeNull();
  });

  it('blocks voluntary repayMargin while a Payout Claim forced sale is unresolved', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].margin = 2000;
      d.players[0].cash = 5000;
      d.insolvency = { player: 0, owed: 500, reason: 'payout', payTo: 1, label: 'Payout Claim' };
    });
    s = dispatch(s, { t: 'repayMargin' }, rng());
    expect(s.players[0].margin).toBe(2000); // rejected — unchanged
  });
});
