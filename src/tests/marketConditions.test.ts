import { describe, expect, it } from 'vitest';
import {
  marketConditionBlocksMargin, marketConditionBuyoutDiscount,
  marketConditionClaimAdjustment, marketConditionIncome, reduce,
} from '../engine';
import { dispatch, patch, scriptedRng, started } from './helpers';

describe('Market Conditions', () => {
  it('starts a separate random condition when a player reaches Market Open without drawing a deck card', () => {
    let s = started(2);
    const decksBefore = structuredClone(s.decks);
    s = patch(s, (d) => { d.players[0].pos = 34; d.turnPhase = 'preRoll'; });

    // Roll 1+2 to Market Open, then select condition 0 (Sector Spotlight)
    // and sector 0 (Technology). The condition uses its own random choice,
    // not the Market Event or Fed deck.
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2, 0, 0]));

    expect(s.players[0].pos).toBe(1);
    expect(s.marketCondition).toMatchObject({
      id: 'sectorSpotlight', title: 'Technology Spotlight', startedBy: s.players[0].name,
    });
    expect(s.decks).toEqual(decksBefore);
    expect(s.pendingDraws).toEqual([]);
  });

  it('replaces, rather than stacks, the previous condition at the next Market Open', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.marketCondition = {
        id: 'riskOff', title: 'Risk-Off', detail: 'old', icon: '⚠', color: '#fb923c', startedBy: 'Morgan', lap: 1,
      };
      d.cur = 1;
      d.players[1].pos = 34;
      d.turnPhase = 'preRoll';
    });

    // Roll 1+2 to Market Open and select condition 2 (ETF Inflows).
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2, 2]));

    expect(s.marketCondition).toMatchObject({ id: 'etfInflows', title: 'ETF Inflows', startedBy: s.players[1].name });
    expect(s.log.some((entry) => entry.text.includes('Risk-Off ends'))).toBe(true);
  });

  it('applies the condition modifiers without changing normal rules when inactive', () => {
    let s = started(2);
    const normalCost = 8_250;
    expect(marketConditionBuyoutDiscount(s, 'MEDI', normalCost)).toBe(normalCost);
    expect(marketConditionClaimAdjustment(s, 'CCAI')).toBe(0);
    expect(marketConditionBlocksMargin(s)).toBe(false);

    s = patch(s, (d) => {
      d.marketCondition = {
        id: 'weakDemandBargains', title: 'Weak Demand Bargains', detail: 'test', icon: '⌄', color: '#fbbf24', startedBy: 'Morgan', lap: 1,
      };
      d.skips.MEDI = 1;
    });
    expect(marketConditionBuyoutDiscount(s, 'MEDI', normalCost)).toBe(7_450);

    s = patch(s, (d) => {
      d.marketCondition = {
        id: 'riskOff', title: 'Risk-Off', detail: 'test', icon: '⚠', color: '#fb923c', startedBy: 'Morgan', lap: 1,
      };
    });
    expect(marketConditionClaimAdjustment(s, 'CCAI')).toBe(-250);
    expect(marketConditionClaimAdjustment(s, 'MEDI')).toBe(0);

    s = patch(s, (d) => {
      d.marketCondition = {
        id: 'creditTightening', title: 'Credit Tightening', detail: 'test', icon: '▣', color: '#f87171', startedBy: 'Morgan', lap: 1,
      };
    });
    expect(marketConditionBlocksMargin(s)).toBe(true);
  });

  it('adds the advertised income only while the matching condition is active', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 2, RNST: 1, NDRV: 1 };
      d.marketCondition = {
        id: 'dividendWindfall', title: 'Dividend Windfall', detail: 'test', icon: '✦', color: '#4ade80', startedBy: 'Morgan', lap: 1,
      };
    });
    // MEDI and RNST pay dividends; NDRV does not.
    expect(marketConditionIncome(s, s.players[0])).toEqual({ dividend: 75, etf: 0 });

    s = patch(s, (d) => {
      d.marketCondition = {
        id: 'etfInflows', title: 'ETF Inflows', detail: 'test', icon: '◆', color: '#60a5fa', startedBy: 'Morgan', lap: 1,
      };
      d.players[0].etfShares = { GRW: 1 };
    });
    expect(marketConditionIncome(s, s.players[0])).toEqual({ dividend: 0, etf: 300 });
  });

  it('enforces Credit Tightening at the reducer boundary', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.opts.margin = true;
      d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 };
      d.marketCondition = {
        id: 'creditTightening', title: 'Credit Tightening', detail: 'test', icon: '▣', color: '#f87171', startedBy: 'Morgan', lap: 1,
      };
    });

    s = dispatch(s, { t: 'takeMargin' }, scriptedRng([]));
    expect(s.players[0].margin).toBe(0);
    expect(s.players[0].cash).toBe(30_000);
  });
});
