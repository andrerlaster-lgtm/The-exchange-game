// Strong Demand — the positive mirror of Weak Demand (2026-09-18, Option C).
// Weak Demand tracks skips on an UNTOUCHED company (before sellout); Strong
// Demand tracks Payout Claim LANDINGS on an already-SOLD-OUT one (after). The
// two never apply to the same company at the same time.

import { describe, expect, it } from 'vitest';
import { MOVE_BP, applyBasisPoints } from '../data';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

// MEDI is at board space 5 (safe for rollTo, which needs space >= 4).
const CODE = 'MEDI';
const SPACE = 5;

/** Player 0 lands on MEDI, already sold out to player 1. */
function landOnce(s: ReturnType<typeof started>, holderShares = 6) {
  s = patch(s, (d) => {
    d.supply[CODE] = 0;
    d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
    d.players[1].shares[CODE] = holderShares;
    d.cur = 0;
    d.turnPhase = 'preRoll';
    d.players[0].pos = SPACE - 4;
    d.players[0].hasCompletedLap = true;
  });
  return rollTo(s, SPACE);
}

describe('Strong Demand markers — 2-landing threshold', () => {
  it('two Payout Claim landings raise the price by the Strong Demand percentage and reset the counter to 0', () => {
    let s = started(2);
    const base = s.prices.MEDI;
    s = landOnce(s);
    expect(s.demand.MEDI).toBe(1);
    expect(s.prices.MEDI).toBe(base);
    s = dispatch(s, { t: 'choosePayoutPayCash' }, rng());
    s = patch(s, (d) => { d.players[0].pos = SPACE - 4; d.turnPhase = 'preRoll'; });
    s = rollTo(s, SPACE);
    expect(s.demand.MEDI).toBe(0);
    expect(s.prices.MEDI).toBe(applyBasisPoints(base, MOVE_BP.strongDemand));
  });

  it('counter increments to 1 without rising until the second landing', () => {
    let s = started(2);
    const base = s.prices.MEDI;
    s = landOnce(s);
    expect(s.demand.MEDI).toBe(1);
    expect(s.prices.MEDI).toBe(base);
  });

  it('landing on your own sold-out company adds no marker', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 0 };
      d.players[0].shares[CODE] = 11;
      d.cur = 0;
      d.players[0].pos = SPACE - 4;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = rollTo(s, SPACE);
    expect(s.demand.MEDI ?? 0).toBe(0);
  });

  it('a Contested company adds no marker', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: null };
      d.cur = 0;
      d.players[0].pos = SPACE - 4;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = rollTo(s, SPACE);
    expect(s.demand.MEDI ?? 0).toBe(0);
  });

  it('a first-lap-grace landing (no claim owed yet) adds no marker', () => {
    // rollTo always force-sets hasCompletedLap = true before rolling (see its
    // own doc comment), so genuine first-lap behavior needs a real roll from
    // a freshly-started game instead — same pattern soldout.test.ts uses for
    // its own first-lap-grace test.
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = 6;
      d.players[0].pos = SPACE - 3; // 1+2 lands exactly on SPACE
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 2]));
    expect(s.players[0].pos).toBe(SPACE);
    expect(s.landingNotice).toBeNull(); // confirms the grace path, not a real claim
    expect(s.demand.MEDI ?? 0).toBe(0);
  });

  it('fires regardless of how the claim is eventually settled (cash, force-sell, or loan)', () => {
    // Force-sell path.
    let s = started(2);
    s = patch(s, (d) => { d.players[0].cash = 0; d.players[0].shares = { CCAI: 5 }; });
    s = landOnce(s);
    expect(s.demand.MEDI).toBe(1);
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutForceSell' }, rng());
    expect(s.insolvency).not.toBeNull(); // still unresolved, but the marker already counted

    // Loan path.
    let s2 = started(2);
    s2 = patch(s2, (d) => { d.players[0].cash = 0; });
    s2 = landOnce(s2);
    expect(s2.demand.MEDI).toBe(1);
    s2 = dispatch(s2, { t: 'ackLandingNotice' }, rng());
    s2 = dispatch(s2, { t: 'choosePayoutLoan' }, rng());
    expect(s2.payoutShortfallChoice).toBeNull(); // moved on to loan negotiation
    expect(s2.demand.MEDI).toBe(1); // marker still counted even though nothing was paid yet
  });

  it('markers persist across a lap rollover', () => {
    let s = started(2);
    s = patch(s, (d) => { d.demand.MEDI = 1; d.cur = 1; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.lap).toBe(2);
    expect(s.demand.MEDI).toBe(1);
  });

  it('a marker carried over from an earlier lap still completes the threshold', () => {
    let s = started(2);
    s = patch(s, (d) => { d.demand.MEDI = 1; d.cur = 1; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // lap 2 — the marker survives
    const base = s.prices.MEDI;
    s = landOnce(s);
    expect(s.demand.MEDI).toBe(0);
    expect(s.prices.MEDI).toBe(applyBasisPoints(base, MOVE_BP.strongDemand));
  });

  it('records a Strong Demand market signal when the threshold hits', () => {
    let s = started(2);
    s = patch(s, (d) => { d.demand.MEDI = 1; });
    const signalsBefore = s.marketSignals.length;
    const priceBefore = s.prices.MEDI;
    s = landOnce(s);
    expect(s.marketSignals.length).toBe(signalsBefore + 1);
    // The signal reports the REALIZED percentage, which the $25 grid can pull
    // away from the nominal +5% at lower prices.
    expect(s.marketSignals[0]).toMatchObject({
      kind: 'strongDemand',
      title: 'Strong Demand · MEDI',
      impacts: [{ code: 'MEDI', pct: ((s.prices.MEDI - priceBefore) / priceBefore) * 100 }],
    });
    expect(s.prices.MEDI).toBe(applyBasisPoints(priceBefore, MOVE_BP.strongDemand));
  });
});
