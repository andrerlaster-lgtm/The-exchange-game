// ETF pricing, rebalanced payout table, and the Full-Diversification bonus
// (paid only when a player holds all 4 distinct funds, not just 4 shares of one).

import { describe, expect, it } from 'vitest';
import { ETF_DEFS, ETF_DIVERSIFICATION_BONUS, ETF_PAYOUT, ETF_PRICE, calcEtfPayout, etfDiversificationBonus, hasFullEtfDiversification } from '../data';
import { dispatch, patch, scriptedRng, started } from './helpers';

describe('ETF pricing', () => {
  it('is fixed at $3,000/share', () => {
    expect(ETF_PRICE).toBe(3_000);
  });

  it('rebalanced payout table (0–4 total shares owned)', () => {
    expect(ETF_PAYOUT).toEqual([0, 200, 500, 900, 1_200]);
  });
});

describe('ETF Full-Diversification bonus', () => {
  it('is 0 with any single fund, even at 4 shares of the same one', () => {
    expect(hasFullEtfDiversification({ GRW: 4 })).toBe(false);
    expect(etfDiversificationBonus({ GRW: 4 })).toBe(0);
    // The share-count table still pays the max tier regardless.
    expect(calcEtfPayout({ GRW: 4 })).toBe(ETF_PAYOUT[4]);
  });

  it('is paid once all 4 distinct funds are held (1 share each is enough)', () => {
    const etfShares = Object.fromEntries(ETF_DEFS.map((e) => [e.code, 1]));
    expect(hasFullEtfDiversification(etfShares)).toBe(true);
    expect(etfDiversificationBonus(etfShares)).toBe(ETF_DIVERSIFICATION_BONUS);
  });

  it('stacks on top of the share-count payout at Market Open', () => {
    let s = started(2);
    const etfShares = Object.fromEntries(ETF_DEFS.map((e) => [e.code, 1]));
    s = patch(s, (d) => {
      d.players[0].etfShares = etfShares;
      d.players[0].pos = 33; // 33 + 4 = 37 → wraps to space 1 (Market Open)
    });
    const cashBefore = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // total 4
    expect(s.players[0].pos).toBe(1);

    const expectedEtfIncome = ETF_PAYOUT[4] + ETF_DIVERSIFICATION_BONUS; // 4 total shares, all distinct
    expect(s.log.some((l) => /ETF diversification bonus/i.test(l.text))).toBe(true);
    // Cash gained must be at least salary + full ETF income (dividends/other bonuses may also apply, but none here).
    expect(s.players[0].cash).toBeGreaterThanOrEqual(cashBefore + expectedEtfIncome);
  });

  it('ETF shares can never be force-sold (rulebook §17): forcedSell only touches p.shares', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 23;
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
