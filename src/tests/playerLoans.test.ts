import { describe, expect, it } from 'vitest';
import { blocked, netWorth, playerDebtBalance } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

describe('Player-to-player Payout Claim loans', () => {
  const CODE = 'FTRB';

  function payoutState() {
    return patch(started(2), (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = 6;
      d.players[0].cash = 100;
      d.players[0].shares = { MEDI: 5 };
      d.players[0].pos = 6;
      d.turnPhase = 'preRoll';
    });
  }

  it('blocks End Turn while the shortfall choice or loan rate prompt is pending', () => {
    let s = payoutState();
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    expect(s.payoutShortfallChoice).not.toBeNull();
    expect(blocked(s)).toBe(true);

    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    expect(s.loanRatePrompt).not.toBeNull();
    expect(blocked(s)).toBe(true);

    s = dispatch(s, { t: 'setLoanRate', rate: 4 }, rng());
    expect(s.loanRatePrompt).toBeNull();
    expect(s.payoutShortfallChoice).toBeNull();
    expect(blocked(s)).toBe(false);
  });

  it('clamps the creditor-chosen rate to the 1-5 range', () => {
    let s = payoutState();
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    s = dispatch(s, { t: 'setLoanRate', rate: 99 }, rng());

    expect(s.playerDebts[0].rate).toBe(5);
  });

  it('accrues interest at the loan\'s own rate on the debtor\'s next turn', () => {
    // Land one space earlier and roll a non-double so End Turn actually
    // advances the turn instead of granting a doubles bonus roll.
    let s = patch(payoutState(), (d) => { d.players[0].pos = 5; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 2]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    s = dispatch(s, { t: 'setLoanRate', rate: 5 }, rng());
    const debt = s.playerDebts[0];
    const principal = debt.principal;

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // player 1's turn begins — debtor (0) unaffected
    expect(s.playerDebts[0].interest).toBe(0);

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // player 0's turn begins — interest accrues

    const expectedInterest = Math.max(100, Math.round(principal * 5 / 100 / 100) * 100);
    expect(s.playerDebts[0].interest).toBe(expectedInterest);
    expect(playerDebtBalance(s.playerDebts[0])).toBe(principal + expectedInterest);
  });

  it('lets the debtor pay an installment or the full balance, crediting the creditor', () => {
    let s = payoutState();
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    s = dispatch(s, { t: 'setLoanRate', rate: 2 }, rng());
    const debtId = s.playerDebts[0].id;
    const owed = playerDebtBalance(s.playerDebts[0]);

    s = patch(s, (d) => { d.players[0].cash = owed; });
    const creditorBefore = s.players[1].cash;
    s = dispatch(s, { t: 'payPlayerDebt', debtId, mode: 'full' }, rng());

    expect(s.playerDebts.find((d) => d.id === debtId)).toBeUndefined();
    expect(s.players[1].cash).toBe(creditorBefore + owed);
  });

  it('counts an unpaid loan against the debtor\'s score and for the creditor\'s', () => {
    let s = payoutState();
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    s = dispatch(s, { t: 'setLoanRate', rate: 3 }, rng());
    const debt = s.playerDebts[0];
    const balance = playerDebtBalance(debt);

    const withoutDebt = patch(s, (d) => { d.playerDebts = []; });
    expect(netWorth(s, s.players[0])).toBe(netWorth(withoutDebt, s.players[0]) - balance);
    expect(netWorth(s, s.players[1])).toBe(netWorth(withoutDebt, s.players[1]) + balance);
  });
});
