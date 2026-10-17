import { describe, expect, it } from 'vitest';
import { reduce } from '../engine';
import { patch, scriptedRng, started } from './helpers';

// ETF spaces no longer charge a landing fee (rule change 2026-10-17). Landing only offers a share.
describe('landing on an ETF space', () => {
  it('charges nothing when another player holds the fund, and the share can be bought straight away', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 10_000;
      d.players[1].cash = 10_000;
      d.players[1].etfShares = { GRW: 3, INC: 1, PROP: 1, ENE: 1 }; // controls every fund
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // 1 + 3 = fund space 4 (Growth Fund)
    expect(s.landingNotice).toBeNull();
    expect(s.etfPick).toBe('GRW');
    expect(s.players[0].cash).toBe(10_000);
    expect(s.players[1].cash).toBe(10_000);
    expect(s.players[0].feeDebtPrincipal ?? 0).toBe(0);
    expect(s.log.some((entry) => /owes/.test(entry.text))).toBe(false);

    s = reduce(s, { t: 'buyEtf', code: 'GRW' }, scriptedRng([]));
    expect(s.players[0].etfShares.GRW).toBe(1);
    expect(s.players[0].cash).toBe(7_000);   // only the share price
    expect(s.players[1].cash).toBe(10_000);  // the other holder receives nothing
  });

  it('charges nothing on the Property Fund either, with no cash at all', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 0;
      d.players[1].etfShares = { PROP: 2 };
      d.players[0].pos = 20;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // 20 + 3 = space 23 (Property Fund)
    expect(s.etfPick).toBe('PROP');
    expect(s.landingNotice).toBeNull();
    expect(s.players[0].cash).toBe(0);
    expect(s.players[0].feeDebtPrincipal ?? 0).toBe(0);
  });
});
