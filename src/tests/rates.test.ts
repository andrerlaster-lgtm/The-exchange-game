// Bank Rate, Market Rate, and spread (2026-09-19).

import { describe, expect, it } from 'vitest';
import {
  BANK_RATE_MAX_BP, BANK_RATE_START_BP, FED_CARDS, STOCK_BY_CODE, applyBasisPoints, spreadUpChance,
} from '../data';
import type { GameState } from '../engine';
import { accrueFeeDebt, bankRateBp, feeDebtRatePct, marketRateBp, rateSpreadBp, spreadDirection } from '../engine';
import { makeRng } from '../utils/rng';
import { repriceRoundBoundary } from '../engine/marketMeter';
import { dispatch, patch, rng, started } from './helpers';

const fedIndex = (title: string) => FED_CARDS.findIndex((c) => c.title === title);
const codesWhere = (f: (st: (typeof STOCK_BY_CODE)[string]) => boolean) => Object.values(STOCK_BY_CODE).filter(f).map((st) => st.code);

/** Draw one Fed card with the Market Meter off, so no ripple muddies prices. */
function drawFed(s: GameState, title: string): GameState {
  const ready = patch(s, (d) => {
    d.opts.marketMeter = false;
    d.pendingDraws = ['FED'];
    d.decks.FED = [fedIndex(title)];
    d.turnPhase = 'acted';
  });
  return dispatch(ready, { t: 'draw', deck: 'FED' }, rng());
}

describe('Bank Rate and Market Rate', () => {
  it('starts at 3% with the Market Rate level, so the spread is zero', () => {
    const s = started(2);
    expect(bankRateBp(s)).toBe(BANK_RATE_START_BP);
    expect(marketRateBp(s)).toBe(300);
    expect(rateSpreadBp(s)).toBe(0);
  });

  it('reads the Market Rate from the Market Meter: 100 bp per point', () => {
    const s = patch(started(2), (d) => { d.meter = 2; });
    expect(marketRateBp(s)).toBe(500);
    expect(rateSpreadBp(s)).toBe(200);
    expect(rateSpreadBp(patch(s, (d) => { d.meter = -3; d.bankRateBp = 400; }))).toBe(-400);
  });

  it('a Rate Hike raises the Bank Rate 50 bp and moves the rate-sensitive stocks', () => {
    const s = started(2);
    const t = drawFed(s, 'Rate Hike');
    expect(bankRateBp(t)).toBe(350);
    const fin = codesWhere((st) => st.sector === 'finance' && st.risk !== 'High')[0];
    const re = codesWhere((st) => st.sector === 'realestate' && st.risk !== 'High')[0];
    const high = codesWhere((st) => st.risk === 'High' && st.sector !== 'finance' && st.sector !== 'realestate')[0];
    expect(t.prices[fin]).toBe(applyBasisPoints(s.prices[fin], 500));
    expect(t.prices[re]).toBe(applyBasisPoints(s.prices[re], -500));
    expect(t.prices[high]).toBe(applyBasisPoints(s.prices[high], -500));
    const untouched = codesWhere((st) => st.risk !== 'High' && st.sector !== 'finance' && st.sector !== 'realestate')[0];
    expect(t.prices[untouched]).toBe(s.prices[untouched]);
  });

  it('a Rate Cut lowers it and reverses the moves; Tight Money is a half-size hike', () => {
    const s = started(2);
    const fin = codesWhere((st) => st.sector === 'finance' && st.risk !== 'High')[0];
    const cut = drawFed(s, 'Rate Cut');
    expect(bankRateBp(cut)).toBe(250);
    expect(cut.prices[fin]).toBe(applyBasisPoints(s.prices[fin], -500));
    const tight = drawFed(s, 'Tight Money');
    expect(bankRateBp(tight)).toBe(325);
    expect(tight.prices[fin]).toBe(applyBasisPoints(s.prices[fin], 250));
  });

  it('at its ceiling the rate cannot rise, and nothing moves', () => {
    const s = patch(started(2), (d) => { d.bankRateBp = BANK_RATE_MAX_BP; });
    const t = drawFed(s, 'Rate Hike');
    expect(bankRateBp(t)).toBe(BANK_RATE_MAX_BP);
    expect(t.prices).toEqual(s.prices);
    expect(t.log.some((l) => /already at its ceiling/.test(l.text))).toBe(true);
  });

  it('a partly blocked change moves prices only by what the rate actually moved', () => {
    const s = patch(started(2), (d) => { d.bankRateBp = BANK_RATE_MAX_BP - 25; });
    const t = drawFed(s, 'Rate Hike');
    expect(bankRateBp(t)).toBe(BANK_RATE_MAX_BP);
    const fin = codesWhere((st) => st.sector === 'finance' && st.risk !== 'High')[0];
    expect(t.prices[fin]).toBe(applyBasisPoints(s.prices[fin], 250));
  });

  it('Rate Hold and non-rate Fed cards leave the Bank Rate alone', () => {
    const s = started(2);
    expect(bankRateBp(drawFed(s, 'Rate Hold'))).toBe(300);
    expect(bankRateBp(drawFed(s, 'Mortgage Pressure'))).toBe(300);
  });

  it('Jumbo Hike and Emergency Cut move it a full point', () => {
    const s = started(2);
    expect(bankRateBp(drawFed(s, 'Jumbo Hike'))).toBe(400);
    expect(bankRateBp(drawFed(s, 'Emergency Cut'))).toBe(200);
  });

  it('a card that moves the rate but keeps its own effect does both', () => {
    const s = started(2);
    const t = drawFed(s, 'Inflation Warning'); // Consumer and High-Risk down 5%
    expect(bankRateBp(t)).toBe(325);
    const consumer = codesWhere((st) => st.sector === 'consumer' && st.risk !== 'High')[0];
    expect(t.prices[consumer]).toBe(applyBasisPoints(s.prices[consumer], -500));
    // Not a rate shock: Finance, which a shock would lift, is untouched.
    const fin = codesWhere((st) => st.sector === 'finance' && st.risk !== 'High')[0];
    expect(t.prices[fin]).toBe(s.prices[fin]);
  });

  it('a Bullish round nudges the rate up and a Bearish round nudges it down', () => {
    const bull = patch(started(2), (d) => { d.meter = 2; });
    const afterBull = patch(bull, (d) => { repriceRoundBoundary(d, makeRng('bull')); });
    expect(afterBull.bankRateBp).toBe(325);

    const bear = patch(started(2), (d) => { d.meter = -2; });
    expect(patch(bear, (d) => { repriceRoundBoundary(d, makeRng('bear')); }).bankRateBp).toBe(275);

    const flat = patch(started(2), (d) => { d.meter = 0; });
    expect(patch(flat, (d) => { repriceRoundBoundary(d, makeRng('flat')); }).bankRateBp).toBe(300);
  });
});

describe('loans follow the Bank Rate', () => {
  it('Outstanding Fees charge the Bank Rate + 2% per turn', () => {
    const s = patch(started(2), (d) => { d.bankRateBp = 600; });
    expect(feeDebtRatePct(s)).toBe(8);
    const p = structuredClone(s.players[0]);
    p.feeDebtPrincipal = 5_000;
    expect(accrueFeeDebt(p, feeDebtRatePct(s))).toBe(400);
  });

  it('Outstanding Fees accrue at the current rate at the start of the debtor\'s turn', () => {
    let s = patch(started(2), (d) => {
      d.bankRateBp = 100; // fees at 3%
      d.players[1].feeDebtPrincipal = 10_000;
      d.turnPhase = 'acted';
      d.cur = 0;
    });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(1);
    expect(s.players[1].feeDebtInterest).toBe(300);
  });

  it('Margin adds the Bank Rate at the start of the borrower\'s turn', () => {
    let s = patch(started(2), (d) => {
      d.bankRateBp = 400;
      d.players[1].margin = 4_000;
      d.turnPhase = 'acted';
      d.cur = 0;
    });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.players[1].margin).toBe(4_160);
  });
});

describe('the spread tilts undirected market moves', () => {
  it('is 50/50 at a zero spread and leans with it, held between 20% and 80%', () => {
    expect(spreadUpChance(0)).toBe(0.5);
    expect(spreadUpChance(200)).toBe(0.75);
    expect(spreadUpChance(-200)).toBe(0.25);
    expect(spreadUpChance(2_000)).toBe(0.8);
    expect(spreadUpChance(-2_000)).toBe(0.2);
  });

  it('a positive spread sends most Neutral moves up', () => {
    const bull = patch(started(2), (d) => { d.meter = 1; d.bankRateBp = 100; }); // spread +300 → 80% up
    const r = makeRng('spread');
    let ups = 0;
    for (let i = 0; i < 2_000; i++) if (spreadDirection(bull, r) === 1) ups++;
    expect(ups / 2_000).toBeGreaterThan(0.76);
    expect(ups / 2_000).toBeLessThan(0.84);
  });
});
