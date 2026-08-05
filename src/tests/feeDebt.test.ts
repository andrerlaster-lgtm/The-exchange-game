import { describe, expect, it } from 'vitest';
import { buildActionCenter } from '../utils/buildBoard3DActionCenter';
import { feeDebtBalance, getRankedPlayers, marketGain, netWorth } from '../engine';
import { dispatch, patch, rng, rollTo, started } from './helpers';

describe('Outstanding Fees debt', () => {
  it('carries a Portfolio Tax charge into the portfolio without taking cash', () => {
    let s = rollTo(started(2), 25);
    const cashBefore = s.players[0].cash;
    const charge = s.landingNotice!.amount;

    s = dispatch(s, { t: 'deferLandingFee' }, rng());

    expect(s.players[0].cash).toBe(cashBefore);
    expect(s.players[0].feeDebtPrincipal).toBe(charge);
    expect(s.players[0].feeDebtInterest).toBe(0);
    expect(feeDebtBalance(s.players[0])).toBe(charge);
  });

  it('adds 5% interest at the beginning of the debtor’s next turn', () => {
    let s = patch(started(2), (draft) => {
      draft.players[0].feeDebtPrincipal = 4_000;
      draft.turnPhase = 'acted';
    });

    s = dispatch(s, { t: 'endTurn' }, rng()); // player 1 starts; player 0 debt unchanged
    expect(feeDebtBalance(s.players[0])).toBe(4_000);
    s = patch(s, (draft) => { draft.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // player 0's next turn begins

    expect(s.players[0].feeDebtInterest).toBe(200);
    expect(feeDebtBalance(s.players[0])).toBe(4_200);
  });

  it('applies the $100 minimum interest increase to small balances', () => {
    let s = patch(started(2), (draft) => {
      draft.players[1].feeDebtPrincipal = 500;
      draft.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'endTurn' }, rng());

    expect(s.players[1].feeDebtInterest).toBe(100);
    expect(feeDebtBalance(s.players[1])).toBe(600);
  });

  it('lets the player pay $500 interest-first or pay the full balance', () => {
    let s = patch(started(2), (draft) => {
      draft.players[0].feeDebtPrincipal = 4_000;
      draft.players[0].feeDebtInterest = 200;
      draft.players[0].cash = 10_000;
    });

    s = dispatch(s, { t: 'payFeeDebt', mode: 'installment' }, rng());
    expect(s.players[0].feeDebtInterest).toBe(0);
    expect(s.players[0].feeDebtPrincipal).toBe(3_700);
    expect(s.players[0].cash).toBe(9_500);

    s = dispatch(s, { t: 'payFeeDebt', mode: 'full' }, rng());
    expect(feeDebtBalance(s.players[0])).toBe(0);
    expect(s.players[0].cash).toBe(5_800);
  });

  it('subtracts unpaid fees from Net Worth, Gain/Loss, and final ranking', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].cash = 31_000;
      draft.players[0].feeDebtPrincipal = 2_000;
      draft.players[1].cash = 30_000;
    });

    expect(netWorth(s, s.players[0])).toBe(29_000);
    expect(marketGain(s, s.players[0])).toBe(-1_000);
    expect(getRankedPlayers(s)[0].playerIdx).toBe(1);
  });

  it('exposes debt and both payment actions in the 3D portfolio', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].feeDebtPrincipal = 1_500;
      draft.players[0].feeDebtInterest = 100;
    });
    const portfolio = buildActionCenter(s).portfolio;

    expect(portfolio.description).toContain('Outstanding Fees $1,600');
    expect(portfolio.description).toContain('interest $100');
    expect(portfolio.buttons?.slice(-2).map((entry) => entry.action)).toEqual([
      { t: 'payFeeDebt', mode: 'installment' },
      { t: 'payFeeDebt', mode: 'full' },
    ]);
  });
});
