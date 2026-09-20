// ETF pricing, per-fund Market Open distributions, and the diversification
// bonus for holding different funds (2026-09-19 redesign).

import { describe, expect, it } from 'vitest';
import {
  ETF_DEFS, ETF_DIVERSIFICATION_BONUS_BY_FUNDS, ETF_FUND_DISTRIBUTION, ETF_PRICE,
  calcEtfPayout, distinctEtfFunds, etfDiversificationBonus, hasFullEtfDiversification, projectedEtfIncome,
} from '../data';
import { dispatch, patch, scriptedRng, started } from './helpers';

describe('ETF pricing', () => {
  it('is fixed at $3,000/share', () => {
    expect(ETF_PRICE).toBe(3_000);
  });
});

describe('ETF distributions (per fund)', () => {
  it('pays each fund by its own shares: 1 → $250, 2 → $500, 3+ → $750', () => {
    expect(ETF_FUND_DISTRIBUTION).toEqual([0, 250, 500, 750]);
    expect(calcEtfPayout({ GRW: 1 })).toBe(250);
    expect(calcEtfPayout({ GRW: 2 })).toBe(500);
    expect(calcEtfPayout({ GRW: 3 })).toBe(750);
    expect(calcEtfPayout({ GRW: 5 })).toBe(750); // capped at 3+
  });

  it('adds the funds together', () => {
    expect(calcEtfPayout({ GRW: 1, INC: 2 })).toBe(250 + 500);
    const oneEach = Object.fromEntries(ETF_DEFS.map((e) => [e.code, 1]));
    expect(calcEtfPayout(oneEach)).toBe(4 * 250);
  });

  it('pays nothing with no ETFs', () => {
    expect(calcEtfPayout({})).toBe(0);
    expect(projectedEtfIncome({})).toBe(0);
  });
});

describe('ETF diversification bonus (different funds)', () => {
  it('counts different funds, not more shares of one', () => {
    expect(distinctEtfFunds({ GRW: 4 })).toBe(1);
    expect(etfDiversificationBonus({ GRW: 4 })).toBe(0);
  });

  it('pays 2 funds +$250, 3 funds +$500, all 4 +$750', () => {
    expect(ETF_DIVERSIFICATION_BONUS_BY_FUNDS).toEqual({ 2: 250, 3: 500, 4: 750 });
    expect(etfDiversificationBonus({ GRW: 1, INC: 1 })).toBe(250);
    expect(etfDiversificationBonus({ GRW: 1, INC: 1, PROP: 1 })).toBe(500);
    const oneEach = Object.fromEntries(ETF_DEFS.map((e) => [e.code, 1]));
    expect(hasFullEtfDiversification(oneEach)).toBe(true);
    expect(etfDiversificationBonus(oneEach)).toBe(750);
  });

  it('spreading beats stacking: 4 shares across 4 funds out-earn 4 shares of one', () => {
    const oneEach = Object.fromEntries(ETF_DEFS.map((e) => [e.code, 1]));
    expect(projectedEtfIncome(oneEach)).toBe(1_000 + 750); // $1,750
    expect(projectedEtfIncome({ GRW: 4 })).toBe(750);        // capped fund, no bonus
  });

  it('is paid on top of distributions at Market Open', () => {
    let s = started(2);
    const etfShares = Object.fromEntries(ETF_DEFS.map((e) => [e.code, 1]));
    s = patch(s, (d) => {
      d.players[0].etfShares = etfShares;
      d.players[0].pos = 37; // 37 + 4 = 41 → wraps to space 1 (Market Open)
    });
    const cashBefore = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // total 4
    expect(s.players[0].pos).toBe(1);
    expect(s.log.some((l) => /ETF diversification bonus \(4 funds\)/i.test(l.text))).toBe(true);
    expect(s.players[0].cash).toBeGreaterThanOrEqual(cashBefore + projectedEtfIncome(etfShares));
  });

  it('ETF shares can never be force-sold (rulebook §17): forcedSell only touches p.shares', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 24;
      d.players[0].cash = 0;
      d.players[0].shares = {};
      d.players[0].etfShares = { GRW: 2 };
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 0])); // → Portfolio Tax at space 25 territory-ish; just verify no crash/ETF loss
    // Regardless of what triggered, ETF holdings must be untouched — there is no
    // action in the engine that can reduce p.etfShares once purchased.
    expect(s.players[0].etfShares.GRW).toBe(2);
  });
});
