// Taxes & Fees panel: margin calls, Market Open income, and Audit Notice
// payments are logged to s.feeLog. projectedDividend reports the next-pass payout.

import { describe, expect, it } from 'vitest';
import { blocked, projectedDividend } from '../engine';
import { dispatch, patch, rollTo, scriptedRng, started } from './helpers';

describe('Taxes & Fees — feeLog', () => {
  it('logs an income entry on Market Open with no dividends owed', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // wraps past space 1

    const income = s.feeLog.find((f) => f.kind === 'income');
    expect(income).toBeDefined();
    expect(income!.player).toBe(s.players[0].name);
    expect(income!.amount).toBe(750); // SALARY only, no holdings
  });

  it('projects next-pass dividends from holdings and logs income including them', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { SAFE: 2 }; // Low-risk, $110 div/share (2026-09-18 cash-flow pass)
      d.players[0].pos = 34;
    });

    // Forward-looking projection reflects current holdings before the pass.
    expect(projectedDividend(s, s.players[0])).toBe(220);

    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    const income = s.feeLog.find((f) => f.kind === 'income');
    expect(income!.amount).toBe(750 + 220);
  });

  it('logs a marginCall entry when the call is fully paid from cash', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].margin = 2000; d.players[0].cash = 10000; d.players[0].pos = 34; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));

    const call = s.feeLog.find((f) => f.kind === 'marginCall');
    expect(call).toBeDefined();
    expect(call!.amount).toBe(-1000); // half of 2000
    expect(s.marginCall).toBeNull();
  });

  it('logs a marginCall entry when payMarginCall resolves a default', () => {
    let s = started(2);
    s = patch(s, (d) => {
      // A real game caps Margin at $4,000, but this patches state directly to
      // force a shortfall even after the Recovery Bonus (2026-09-18 cash-flow
      // pass) kicks in: starting at $0 cash still nets $750 salary + $2,000
      // Recovery Bonus = $2,750 before the margin call is deducted, which
      // alone covers half of a real $4,000 balance ($2,000).
      d.players[0].margin = 10_000;
      d.players[0].cash = 0;
      d.players[0].shares = { MEDI: 3 };
      d.players[0].pos = 34;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    expect(s.marginCall).not.toBeNull();
    const owed = s.marginCall!.owed;

    while (s.players[0].cash < owed && (s.players[0].shares['MEDI'] ?? 0) > 0) {
      s = dispatch(s, { t: 'marginSell', code: 'MEDI' }, scriptedRng([]));
    }
    s = dispatch(s, { t: 'payMarginCall' }, scriptedRng([]));

    const calls = s.feeLog.filter((f) => f.kind === 'marginCall');
    expect(calls.length).toBeGreaterThan(0);
    expect(s.marginCall).toBeNull();
  });

  it('logs an audit entry after the player chooses Pay Now', () => {
    let s = started(2);
    // Space 34 is Audit Notice — land there by rolling 2 from space 32.
    s = patch(s, (d) => { d.players[0].pos = 32; d.turnPhase = 'preRoll'; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1])); // 32 + 2 = 34

    expect(s.players[0].pos).toBe(34);
    expect(s.landingNotice).toMatchObject({
      kind: 'audit', amount: 1_800, paidFromCash: 0, remaining: 1_800, canDefer: true,
    });
    expect(blocked(s)).toBe(true);

    s = dispatch(s, { t: 'payLandingFee' }, scriptedRng([]));
    const audit = s.feeLog.find((f) => f.kind === 'audit');
    expect(audit?.amount).toBe(-1_800);
    expect(s.landingNotice).toBeNull();
    expect(blocked(s)).toBe(false);
  });

  it('raises the Audit Notice rate to 7.5% when margin is outstanding', () => {
    let s = patch(started(2), (d) => {
      d.players[0].pos = 32;
      d.players[0].cash += 2_000; // borrowed cash offsets the new margin in net worth
      d.players[0].margin = 2_000;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));

    expect(s.landingNotice).toMatchObject({
      kind: 'audit', amount: 2_600, paidFromCash: 0, remaining: 2_600, canDefer: true,
    });
    expect(s.landingNotice?.detail).toContain('7.5% of net worth $35,000');
  });

  it('explains the 10% Portfolio Tax and exact amount charged', () => {
    let s = started(2);
    s = rollTo(s, 25);

    expect(s.landingNotice).toMatchObject({
      kind: 'tax', amount: 3_500, paidFromCash: 0, remaining: 3_500, canDefer: true,
    });
    expect(s.landingNotice?.detail).toContain('10% of net worth $35,000');
  });
});
