// Taxes & Fees panel: margin calls, Market Open income, and Audit Notice
// payments are logged to s.feeLog. projectedDividend reports the next-pass payout.

import { describe, expect, it } from 'vitest';
import { projectedDividend } from '../engine';
import { dispatch, patch, scriptedRng, started } from './helpers';

describe('Taxes & Fees — feeLog', () => {
  it('logs an income entry on Market Open with no dividends owed', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // wraps past space 1

    const income = s.feeLog.find((f) => f.kind === 'income');
    expect(income).toBeDefined();
    expect(income!.player).toBe(s.players[0].name);
    expect(income!.amount).toBe(500); // SALARY only, no holdings
  });

  it('projects next-pass dividends from holdings and logs income including them', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { SAFE: 2 }; // Low-risk, $100 div/share
      d.players[0].pos = 34;
    });

    // Forward-looking projection reflects current holdings before the pass.
    expect(projectedDividend(s, s.players[0])).toBe(200);

    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    const income = s.feeLog.find((f) => f.kind === 'income');
    expect(income!.amount).toBe(500 + 200);
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
      d.players[0].margin = 4000;
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

  it('logs an audit entry when landing on Audit Notice', () => {
    let s = started(2);
    // Space 34 is Audit Notice — land there by rolling 2 from space 32.
    s = patch(s, (d) => { d.players[0].pos = 32; d.turnPhase = 'preRoll'; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1])); // 32 + 2 = 34

    expect(s.players[0].pos).toBe(34);
    const audit = s.feeLog.find((f) => f.kind === 'audit');
    expect(audit).toBeDefined();
    expect(audit!.amount).toBeLessThan(0);
  });
});
