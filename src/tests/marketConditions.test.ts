import { describe, expect, it } from 'vitest';
import {
  marketConditionBlocksMargin, marketConditionBuyoutDiscount,
  marketConditionClaimAdjustment, marketConditionIncome, marketConditionLoanRateCap,
  marketConditionSectorRentMultiplier, reduce,
} from '../engine';
import { SECTOR_PAIRS, STOCK_BY_CODE } from '../data';
import { claimPayoutForLanding } from '../engine/soldOut';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

describe('Market Conditions — personal, per-player', () => {
  it('starts a condition owned by the landing player only — the other player\'s slot stays empty', () => {
    let s = started(2);
    const decksBefore = structuredClone(s.decks);
    s = patch(s, (d) => { d.players[0].pos = 34; d.turnPhase = 'preRoll'; });

    // Roll 1+2 to Market Open, then select condition 0 (Sector Spotlight)
    // and sector 0 (Technology). The condition uses its own random choice,
    // not the Market Event or Fed deck.
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2, 0, 0]));

    expect(s.players[0].pos).toBe(1);
    expect(s.marketConditions[0]).toMatchObject({
      id: 'sectorSpotlight', title: 'Technology Spotlight', owner: 0, durationUnit: 'turns', remaining: 5,
    });
    expect(s.marketConditions[1]).toBeNull();
    expect(s.decks).toEqual(decksBefore);
    expect(s.pendingDraws).toEqual([]);
  });

  it('never touches another player\'s still-active condition when someone else reaches Market Open', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.marketConditions[1] = { id: 'riskOff', title: 'Risk-Off', detail: 'test', icon: '⚠', color: '#fb923c', owner: 1, lap: 1, durationUnit: 'turns', remaining: 5 };
      d.players[0].pos = 34;
      d.turnPhase = 'preRoll';
    });

    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2, 2])); // player 0 reaches Market Open, rolls ETF Inflows

    expect(s.marketConditions[0]).toMatchObject({ id: 'etfInflows', owner: 0 });
    // Player 1's own condition is completely unaffected by player 0's reroll.
    expect(s.marketConditions[1]).toMatchObject({ id: 'riskOff', owner: 1, remaining: 5 });
  });

  it('a still-active "rounds" condition survives its owner\'s Market Open pass instead of rerolling, and counts down', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'dividendWindfall', title: 'Dividend Windfall', detail: 'test', icon: '✦', color: '#4ade80', owner: 0, lap: 1, durationUnit: 'rounds', remaining: 2 };
      d.players[0].pos = 34;
      d.turnPhase = 'preRoll';
    });

    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2]));

    // Same condition, not a fresh reroll — just ticked down by 1.
    expect(s.marketConditions[0]).toMatchObject({ id: 'dividendWindfall', remaining: 1 });
  });

  it('a "rounds" condition pays out through its final pass, then expires — the NEXT pass after that rolls fresh', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'dividendWindfall', title: 'Dividend Windfall', detail: 'test', icon: '✦', color: '#4ade80', owner: 0, lap: 1, durationUnit: 'rounds', remaining: 1 };
      d.players[0].shares = { MEDI: 2 };
      d.players[0].pos = 34;
      d.turnPhase = 'preRoll';
    });
    const cashBefore = s.players[0].cash;

    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // final pass: still pays the +$25/share bonus

    expect(s.players[0].cash).toBeGreaterThan(cashBefore + 500); // salary + dividend + the $25/share windfall
    expect(s.marketConditions[0]).toBeNull(); // expired after this pass, not replaced yet
    expect(s.log.some((entry) => entry.text.includes("Dividend Windfall ends"))).toBe(true);
  });

  it('ticks a "turns" condition down at the end of its owner\'s own turn, and expires it at 0', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'riskOff', title: 'Risk-Off', detail: 'test', icon: '⚠', color: '#fb923c', owner: 0, lap: 1, durationUnit: 'turns', remaining: 1 };
      d.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.marketConditions[0]).toBeNull();
    expect(s.log.some((entry) => entry.text.includes('Risk-Off ends'))).toBe(true);
  });

  it('does not tick down on a doubles bonus-roll continuation (not a real turn end)', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'riskOff', title: 'Risk-Off', detail: 'test', icon: '⚠', color: '#fb923c', owner: 0, lap: 1, durationUnit: 'turns', remaining: 1 };
      d.turnPhase = 'acted';
      d.bonusRollPending = true;
    });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.marketConditions[0]).toMatchObject({ remaining: 1 }); // untouched
    expect(s.cur).toBe(0); // still the same player's turn
  });

  it('applies the condition modifiers only for the owning player, and not at all when inactive', () => {
    let s = started(2);
    const normalCost = 8_250;
    expect(marketConditionBuyoutDiscount(s, 0, 'MEDI', normalCost)).toBe(normalCost);
    expect(marketConditionClaimAdjustment(s, 0, 'CCAI')).toBe(0);
    expect(marketConditionBlocksMargin(s, 0)).toBe(false);

    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'weakDemandBargains', title: 'Weak Demand Bargains', detail: 'test', icon: '⌄', color: '#fbbf24', owner: 0, lap: 1, durationUnit: 'turns', remaining: 5 };
      d.skips.MEDI = 1;
    });
    expect(marketConditionBuyoutDiscount(s, 0, 'MEDI', normalCost)).toBe(7_450);
    expect(marketConditionBuyoutDiscount(s, 1, 'MEDI', normalCost)).toBe(normalCost); // player 1 has no condition

    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'riskOff', title: 'Risk-Off', detail: 'test', icon: '⚠', color: '#fb923c', owner: 0, lap: 1, durationUnit: 'turns', remaining: 5 };
    });
    expect(marketConditionClaimAdjustment(s, 0, 'CCAI')).toBe(-250);
    expect(marketConditionClaimAdjustment(s, 0, 'MEDI')).toBe(0);
    expect(marketConditionClaimAdjustment(s, 1, 'CCAI')).toBe(0); // player 1's own claim adjustment is unaffected

    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'creditTightening', title: 'Credit Tightening', detail: 'test', icon: '▣', color: '#f87171', owner: 0, lap: 1, durationUnit: 'turns', remaining: 5 };
    });
    expect(marketConditionBlocksMargin(s, 0)).toBe(true);
    expect(marketConditionBlocksMargin(s, 1)).toBe(false);
  });

  it('adds the advertised income only to the owning player, while their condition is active', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].shares = { MEDI: 2, RNST: 1, NDRV: 1 };
      d.marketConditions[0] = { id: 'dividendWindfall', title: 'Dividend Windfall', detail: 'test', icon: '✦', color: '#4ade80', owner: 0, lap: 1, durationUnit: 'rounds', remaining: 2 };
    });
    // MEDI and RNST pay dividends; NDRV does not.
    expect(marketConditionIncome(s, 0)).toEqual({ dividend: 75, etf: 0 });
    expect(marketConditionIncome(s, 1)).toEqual({ dividend: 0, etf: 0 }); // player 1 has no condition

    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'etfInflows', title: 'ETF Inflows', detail: 'test', icon: '◆', color: '#60a5fa', owner: 0, lap: 1, durationUnit: 'rounds', remaining: 2 };
      d.players[0].etfShares = { GRW: 1 };
    });
    expect(marketConditionIncome(s, 0)).toEqual({ dividend: 0, etf: 300 });
  });

  it('enforces Credit Tightening at the reducer boundary, only for the player it belongs to', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.opts.margin = true;
      d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 };
      d.marketConditions[0] = { id: 'creditTightening', title: 'Credit Tightening', detail: 'test', icon: '▣', color: '#f87171', owner: 0, lap: 1, durationUnit: 'turns', remaining: 5 };
    });

    s = dispatch(s, { t: 'takeMargin' }, scriptedRng([]));
    expect(s.players[0].margin).toBe(0);
    expect(s.players[0].cash).toBe(35_000);
  });

  it('can select Toll Hike as the 7th condition', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; d.turnPhase = 'preRoll'; });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2, 6]));
    expect(s.marketConditions[0]).toMatchObject({ id: 'tollHike', title: 'Toll Hike', owner: 0 });
  });

  it('doubles Sector Control rent for the controller\'s own Toll Hike, and leaves it unchanged otherwise', () => {
    let s = started(2);
    expect(marketConditionSectorRentMultiplier(s, 1)).toBe(1);
    s = patch(s, (d) => {
      d.marketConditions[1] = { id: 'tollHike', title: 'Toll Hike', detail: 'test', icon: '▲', color: '#f472b6', owner: 1, lap: 1, durationUnit: 'turns', remaining: 5 };
    });
    expect(marketConditionSectorRentMultiplier(s, 1)).toBe(2);
    expect(marketConditionSectorRentMultiplier(s, 0)).toBe(1); // a different player's rent is unaffected
  });

  it('caps the negotiated loan rate for the debtor\'s own Credit Tightening, and leaves it uncapped otherwise', () => {
    let s = started(2);
    expect(marketConditionLoanRateCap(s, 0)).toBeNull();
    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'creditTightening', title: 'Credit Tightening', detail: 'test', icon: '▣', color: '#f87171', owner: 0, lap: 1, durationUnit: 'turns', remaining: 5 };
    });
    expect(marketConditionLoanRateCap(s, 0)).toBe(2);
    expect(marketConditionLoanRateCap(s, 1)).toBeNull(); // creditor's own condition (if any) is irrelevant here
  });

  it('charges doubled Sector Rent on a live landing while the claim holder\'s own Toll Hike is active', () => {
    const PAIR = SECTOR_PAIRS.blueChipAlliance;
    const [CODE_A, CODE_B] = PAIR.codes; // FTRB, IRON
    let s = started(2);
    s = patch(s, (d) => {
      d.marketConditions[1] = { id: 'tollHike', title: 'Toll Hike', detail: 'test', icon: '▲', color: '#f472b6', owner: 1, lap: 1, durationUnit: 'turns', remaining: 5 };
      d.supply[CODE_A] = 0; d.soldOut[CODE_A] = { code: CODE_A, claimHolder: 1 };
      d.supply[CODE_B] = 0; d.soldOut[CODE_B] = { code: CODE_B, claimHolder: 1 };
      d.players[1].shares[CODE_A] = 11;
      d.players[1].shares[CODE_B] = 11;
      d.cur = 0;
    });
    s = rollTo(s, 11); // IRON (CODE_B)
    const stock = STOCK_BY_CODE[CODE_B];
    const claimOwed = claimPayoutForLanding(11, false, stock.step, stock.step, 0);
    expect(s.landingNotice).toMatchObject({
      title: `Payout Claim + Sector Rent · ${CODE_B}`,
      amount: claimOwed + PAIR.rent * 2,
    });
  });

  it('caps a rolled loan rate at 2% for the debtor\'s own Credit Tightening, even on a high roll', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.marketConditions[0] = { id: 'creditTightening', title: 'Credit Tightening', detail: 'test', icon: '▣', color: '#f87171', owner: 0, lap: 1, durationUnit: 'turns', remaining: 5 };
      d.supply.FTRB = 0; d.soldOut.FTRB = { code: 'FTRB', claimHolder: 1 };
      d.players[1].shares.FTRB = 6;
      d.players[0].cash = 100;
      d.players[0].shares = { MEDI: 5 };
      d.players[0].pos = 4;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = rollTo(s, 8); // FTRB
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    s = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([6])); // would be 5% uncapped
    expect(s.playerDebts[0].rate).toBe(2);
  });

  it('pays double salary for landing exactly on Market Open, and normal salary for passing over it', () => {
    let landed = started(2);
    landed = patch(landed, (d) => { d.players[0].pos = 34; d.turnPhase = 'preRoll'; });
    landed = dispatch(landed, { t: 'roll' }, scriptedRng([1, 2])); // 34 -> 1 exactly
    expect(landed.players[0].pos).toBe(1);
    expect(landed.log.some((entry) => entry.text.includes('landed exactly'))).toBe(true);
    expect(landed.players[0].salaryCollected).toBe(1_500);

    let passed = started(2);
    passed = patch(passed, (d) => { d.players[0].pos = 35; d.turnPhase = 'preRoll'; });
    passed = dispatch(passed, { t: 'roll' }, scriptedRng([1, 2])); // 35 -> 2, passing over 1
    expect(passed.players[0].pos).toBe(2);
    expect(passed.log.some((entry) => entry.text.includes('landed exactly'))).toBe(false);
    expect(passed.players[0].salaryCollected).toBe(750);
  });
});
