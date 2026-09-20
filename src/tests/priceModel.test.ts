// Focused coverage for the percentage-based price model (2026-09-18 redesign).
// The per-mechanic tests (weakDemand, marketMeter, marketRegime, …) assert that
// each source uses the right constant; this file pins down the arithmetic those
// all sit on top of, plus the grid/floor invariants.

import { describe, expect, it } from 'vitest';
import {
  CEILING_TRIGGER, IPO_RUN_BP, MOVE_BP, PRICE_FLOOR, PRICE_GRID, RUN_BP,
  SELL_BACK_HAIRCUT_BP, SHIELDABLE_SOURCES, STOCK_BY_CODE,
  applyBasisPoints, roundToGrid, runBasisPoints,
} from '../data';
import { applyPriceMove } from '../engine/stockState';
import { priceOf, sellBackPrice, shortPayout } from '../engine';
import { dispatch, patch, rng, started } from './helpers';

describe('applyBasisPoints', () => {
  it('moves a price by the requested percentage', () => {
    expect(applyBasisPoints(1_000, 500)).toBe(1_050);   // +5%
    expect(applyBasisPoints(1_000, -500)).toBe(950);    // -5%
    expect(applyBasisPoints(1_000, 1_000)).toBe(1_100); // +10%
    expect(applyBasisPoints(2_000, -1_000)).toBe(1_800);
  });

  it('is a no-op at zero basis points', () => {
    expect(applyBasisPoints(1_337 as number, 0)).toBe(1_337);
  });

  it('always lands on the $25 grid', () => {
    for (let price = PRICE_FLOOR; price <= 8_000; price += PRICE_GRID) {
      for (const bp of [500, -500, 1_000, -1_000, 2_000, -2_000]) {
        expect(applyBasisPoints(price, bp) % PRICE_GRID).toBe(0);
      }
    }
  });

  it('never returns a price below the floor', () => {
    expect(applyBasisPoints(PRICE_FLOOR, -2_000)).toBe(PRICE_FLOOR);
    expect(applyBasisPoints(125, -5_000)).toBe(PRICE_FLOOR);
    for (let price = PRICE_FLOOR; price <= 1_000; price += PRICE_GRID) {
      expect(applyBasisPoints(price, -9_000)).toBeGreaterThanOrEqual(PRICE_FLOOR);
    }
  });

  it('moves at least one grid step so low prices never freeze', () => {
    // A nominal -5% on $100 is -$5, which would round to $0 and leave the
    // price stuck. The minimum-one-step rule is what prevents that; the cost
    // is that small prices overshoot their nominal percentage.
    expect(applyBasisPoints(200, 500)).toBe(225);  // +$10 nominal -> +$25
    expect(applyBasisPoints(200, -500)).toBe(175); // -$10 nominal -> -$25
    expect(applyBasisPoints(300, 100)).toBe(325);  // +1% still registers
  });

  it('a price at the floor cannot fall but can still rise', () => {
    expect(applyBasisPoints(PRICE_FLOOR, -500)).toBe(PRICE_FLOOR);
    expect(applyBasisPoints(PRICE_FLOOR, 500)).toBe(PRICE_FLOOR + PRICE_GRID);
  });

  it('has no upper bound — the $5,000 mark is a trigger, not a cap', () => {
    expect(applyBasisPoints(CEILING_TRIGGER, 1_000)).toBe(5_500);
    expect(applyBasisPoints(20_000, 500)).toBe(21_000);
  });

  it('is symmetric in sign for the same magnitude', () => {
    for (const price of [500, 1_000, 2_500, 5_000]) {
      const up = applyBasisPoints(price, 1_000) - price;
      const down = price - applyBasisPoints(price, -1_000);
      expect(up).toBe(down);
    }
  });
});

describe('roundToGrid', () => {
  it('rounds to the nearest $25', () => {
    expect(roundToGrid(1_000)).toBe(1_000);
    expect(roundToGrid(1_010)).toBe(1_000);
    expect(roundToGrid(1_013)).toBe(1_025);
    expect(roundToGrid(1_012.5)).toBe(1_025); // .5 rounds up
  });
});

describe('applyPriceMove', () => {
  it('reports the real before/after/delta/percentage of a move', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices.MEDI = 1_000; });
    let result!: ReturnType<typeof applyPriceMove>;
    s = patch(s, (d) => { result = applyPriceMove(d, 'MEDI', MOVE_BP.strongDemand, 'strongDemand'); });
    expect(result).toEqual({ before: 1_000, after: 1_050, delta: 50, pct: 5 });
    expect(s.prices.MEDI).toBe(1_050);
  });

  it('reports the REALIZED percentage, not the requested one, when the grid rounds', () => {
    // $750 -5% is -$37.50, which the $25 grid pulls to -$25 — a realized
    // -3.33%. Logs, the ticker, and signals must show what actually happened.
    let s = started(2);
    s = patch(s, (d) => { d.prices.MEDI = 750; });
    let result!: ReturnType<typeof applyPriceMove>;
    s = patch(s, (d) => { result = applyPriceMove(d, 'MEDI', -500, 'weakDemand'); });
    expect(result.after).toBe(725);
    expect(result.delta).toBe(-25);
    expect(result.pct).toBeCloseTo(-3.333, 3);
  });

  it('reports a zero move when a company at the floor is pushed down', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices.MEDI = PRICE_FLOOR; });
    let result!: ReturnType<typeof applyPriceMove>;
    s = patch(s, (d) => { result = applyPriceMove(d, 'MEDI', -2_000, 'bearRun'); });
    expect(result).toEqual({ before: PRICE_FLOOR, after: PRICE_FLOOR, delta: 0, pct: 0 });
  });

  it('never moves an unrevealed IPO', () => {
    const s = started(2);
    const code = s.ipos[0].code;
    expect(s.ipos[0].revealed).toBe(false);
    const after = patch(s, (d) => { applyPriceMove(d, code, 2_000, 'bullRun'); });
    expect(after.ipos[0].price).toBe(s.ipos[0].price);
  });

  it('moves a revealed IPO like any other tradable code', () => {
    let s = patch(started(2), (d) => { d.ipos[0].revealed = true; });
    const code = s.ipos[0].code;
    const before = s.ipos[0].price;
    s = patch(s, (d) => { applyPriceMove(d, code, IPO_RUN_BP, 'bullRun'); });
    expect(s.ipos[0].price).toBe(applyBasisPoints(before, IPO_RUN_BP));
    expect(priceOf(s, code)).toBe(s.ipos[0].price);
  });
});

describe('movement source constants', () => {
  it('each source carries its own explicit basis-point value', () => {
    expect(MOVE_BP.weakDemand).toBe(-500);
    expect(MOVE_BP.strongDemand).toBe(500);
    expect(MOVE_BP.meterStandard).toBe(500);
    expect(MOVE_BP.meterAmplified).toBe(1_000);
    expect(MOVE_BP.cardStep).toBe(500);
    expect(MOVE_BP.bankSale).toBe(-500);
    expect(MOVE_BP.investorDay).toBe(500);
  });

  it('Bull and Bear Runs differ by risk tier and are mirror images', () => {
    expect(RUN_BP).toEqual({ Low: 0, Med: 1_000, High: 2_000 });
    expect(runBasisPoints('High', 'bull')).toBe(2_000);
    expect(runBasisPoints('High', 'bear')).toBe(-2_000);
    expect(runBasisPoints('Med', 'bull')).toBe(1_000);
    expect(runBasisPoints('Med', 'bear')).toBe(-1_000);
    // Low risk sits out a Run entirely, in BOTH directions.
    expect(runBasisPoints('Low', 'bull')).toBe(0);
    expect(runBasisPoints('Low', 'bear')).toBe(0);
  });

  it('protects only genuinely external declines', () => {
    // The upgrade/shield system must never soften a decline a player caused
    // themselves by selling or by choosing their own company as a target.
    for (const source of ['weakDemand', 'roundMarket', 'marketEvent', 'fedCard', 'bearRun'] as const) {
      expect(SHIELDABLE_SOURCES.has(source)).toBe(true);
    }
    for (const source of ['voluntarySale', 'bankSale', 'cyberattackChoice', 'regulatoryChoice'] as const) {
      expect(SHIELDABLE_SOURCES.has(source)).toBe(false);
    }
  });
});

describe('prices derived from the live model', () => {
  it('every company opens on the grid, at or above the floor', () => {
    const s = started(2);
    for (const stock of Object.values(STOCK_BY_CODE)) {
      expect(s.prices[stock.code]).toBe(stock.base);
      expect(stock.base % PRICE_GRID).toBe(0);
      expect(stock.base).toBeGreaterThanOrEqual(PRICE_FLOOR);
    }
  });

  it('bank sell-back applies the haircut and respects the floor', () => {
    let s = started(2);
    s = patch(s, (d) => { d.prices.MEDI = 1_000; });
    expect(sellBackPrice(s, 'MEDI')).toBe(applyBasisPoints(1_000, -SELL_BACK_HAIRCUT_BP));
    expect(sellBackPrice(s, 'MEDI')).toBe(800);

    s = patch(s, (d) => { d.prices.MEDI = PRICE_FLOOR; });
    expect(sellBackPrice(s, 'MEDI')).toBe(PRICE_FLOOR);
  });

  it('short settlement pays on percentage moved, capped at +/-$1,000', () => {
    // Preserves the old step table's scale exactly: ~5% paid $500 and the
    // payout capped at ~10% for $1,000.
    expect(shortPayout(1_000, 950)).toBe(500);    // -5%
    expect(shortPayout(1_000, 900)).toBe(1_000);  // -10%
    expect(shortPayout(1_000, 800)).toBe(1_000);  // capped
    expect(shortPayout(1_000, 1_000)).toBe(0);
    expect(shortPayout(1_000, 1_050)).toBe(-500);
    expect(shortPayout(1_000, 1_200)).toBe(-1_000); // capped
  });
});

describe('determinism', () => {
  it('a fixed seed reproduces identical prices', () => {
    const run = () => {
      let s = started(2);
      for (const bp of [500, -1_000, 2_000, -500, 1_000]) {
        s = patch(s, (d) => { applyPriceMove(d, 'MEDI', bp, 'marketEvent'); });
      }
      return s.prices.MEDI;
    };
    expect(run()).toBe(run());
  });

  it('compounding moves stay on the grid throughout', () => {
    let s = started(2);
    for (let i = 0; i < 50; i += 1) {
      const bp = i % 2 === 0 ? 500 : -500;
      s = patch(s, (d) => { applyPriceMove(d, 'MEDI', bp, 'roundMarket'); });
      expect(s.prices.MEDI % PRICE_GRID).toBe(0);
      expect(s.prices.MEDI).toBeGreaterThanOrEqual(PRICE_FLOOR);
    }
  });
});

describe('last move per stock', () => {
  it('records the realized percentage, source, and round of each real price change', () => {
    let s = patch(started(2), (d) => { d.prices.MEDI = 1_000; d.lap = 3; });
    expect(s.lastMove.MEDI).toBeUndefined();
    s = patch(s, (d) => { applyPriceMove(d, 'MEDI', -500, 'weakDemand'); });
    expect(s.lastMove.MEDI).toEqual({ pct: -5, source: 'weakDemand', lap: 3 });
    s = patch(s, (d) => { d.lap = 4; applyPriceMove(d, 'MEDI', 1_000, 'roundMarket'); });
    expect(s.lastMove.MEDI.source).toBe('roundMarket');
    expect(s.lastMove.MEDI.lap).toBe(4);
    expect(s.lastMove.MEDI.pct).toBeCloseTo(((s.prices.MEDI - 950) / 950) * 100, 10);
  });

  it('keeps the previous readout when a move changes nothing (price on the floor)', () => {
    let s = patch(started(2), (d) => { d.prices.MEDI = 125; });
    s = patch(s, (d) => { applyPriceMove(d, 'MEDI', -500, 'weakDemand'); }); // 125 -> 100
    const before = s.lastMove.MEDI;
    s = patch(s, (d) => { applyPriceMove(d, 'MEDI', -500, 'bearRun'); });   // stays 100
    expect(s.prices.MEDI).toBe(PRICE_FLOOR);
    expect(s.lastMove.MEDI).toEqual(before);
  });

  it('is cleared when a new game starts', () => {
    let s = patch(started(2), (d) => { applyPriceMove(d, 'MEDI', 500, 'strongDemand'); });
    expect(s.lastMove.MEDI).toBeDefined();
    s = dispatch(s, { t: 'startGame' }, rng());
    expect(s.lastMove).toEqual({});
  });
});
