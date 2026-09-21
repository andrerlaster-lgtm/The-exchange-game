// Bank Rate, Market Rate, and spread (2026-09-19).

import { describe, expect, it } from 'vitest';
import {
  BANK_RATE_MAX_BP, BANK_RATE_START_BP, FED_CARDS, STOCK_BY_CODE, applyBasisPoints,
} from '../data';
import type { GameState } from '../engine';
import { accrueFeeDebt, bankRateBp, feeDebtRatePct, marketRateBp, rateSpreadBp } from '../engine';
import { resolveRoundEndMarket, tallyRoundDice } from '../engine/roundMarket';
import { dispatch, patch, rng, started } from './helpers';

const fedIndex = (title: string) => FED_CARDS.findIndex((c) => c.title === title);
const codesWhere = (f: (st: (typeof STOCK_BY_CODE)[string]) => boolean) => Object.values(STOCK_BY_CODE).filter(f).map((st) => st.code);

/** Draw one Fed card with the Market Meter off, so no ripple muddies prices. */
function drawFed(s: GameState, title: string): GameState {
  const ready = patch(s, (d) => {
    d.opts.roundMarket = false;
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

  it('reads the Market Rate from the round that just closed', () => {
    const s = patch(started(2), (d) => { d.marketRound = { direction: 'bull', bloc: 'Tech & Communications', sectors: ['tech', 'comm'], bp: 500, sectorTotal: 1, moveAvg: 5, lap: 1 }; });
    expect(marketRateBp(s)).toBe(800);
    expect(rateSpreadBp(s)).toBe(500);
    const bearish = patch(s, (d) => {
      d.marketRound = { direction: 'bear', bloc: 'Finance', sectors: ['finance'], bp: 250, sectorTotal: 5, moveAvg: 3, lap: 2 };
      d.bankRateBp = 400;
    });
    expect(marketRateBp(bearish)).toBe(50);
    expect(rateSpreadBp(bearish)).toBe(-350);
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

  it('a resolved round nudges the rate 25 bp with its marker, every other round', () => {
    const even = patch(started(2), (d) => { d.lap = 4; d.marketTheme = null; tallyRoundDice(d, 5, 6); });
    expect(patch(even, (d) => { resolveRoundEndMarket(d); }).bankRateBp).toBe(325);
    const odd = patch(started(2), (d) => { d.lap = 5; d.marketTheme = null; tallyRoundDice(d, 5, 6); });
    expect(patch(odd, (d) => { resolveRoundEndMarket(d); }).bankRateBp).toBe(300);
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
