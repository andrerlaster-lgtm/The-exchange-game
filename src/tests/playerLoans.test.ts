import { describe, expect, it } from 'vitest';
import { accruePlayerDebt, blocked, netWorth, playerDebtBalance } from '../engine';
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
      d.players[0].hasCompletedLap = true;
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

    s = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([4]));
    expect(s.loanRatePrompt).toBeNull();
    expect(s.payoutShortfallChoice).toBeNull();
    expect(blocked(s)).toBe(false);
  });

  it('prices the loan at the Bank Rate plus the creditor\'s rolled premium', () => {
    const loanAt = (roll: number, bankRateBp?: number) => {
      let s = payoutState();
      if (bankRateBp) s = patch(s, (d) => { d.bankRateBp = bankRateBp; });
      s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
      s = dispatch(s, { t: 'ackLandingNotice' }, rng());
      s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
      s = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([roll]));
      return s.playerDebts[0].rate;
    };
    // Starting Bank Rate 3%; premium +1% (1-2), +2% (3-4), +3% (5-6)... see PLAYER_LOAN_PREMIUM_BY_ROLL_BP.
    expect([1, 2, 3, 4, 5, 6].map((r) => loanAt(r))).toEqual([4, 4, 5, 5, 6, 6]);
    // A higher Bank Rate makes every loan cost more.
    expect(loanAt(3, 550)).toBe(7.5);
  });

  it('accrues interest at the loan\'s own rate on the debtor\'s next turn', () => {
    // Land one space earlier and roll a non-double so End Turn actually
    // advances the turn instead of granting a doubles bonus roll.
    let s = patch(payoutState(), (d) => { d.players[0].pos = 5; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 2]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    s = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([5]));
    const debt = s.playerDebts[0];
    const principal = debt.principal;
    const expectedInterest = accruePlayerDebt({ ...debt }); // computed off a clone, same rate/formula the engine uses

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // player 1's turn begins — debtor (0) unaffected
    expect(s.playerDebts[0].interest).toBe(0);

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // player 0's turn begins — interest accrues

    expect(s.playerDebts[0].interest).toBe(expectedInterest);
    expect(playerDebtBalance(s.playerDebts[0])).toBe(principal + expectedInterest);
  });

  it('lets the debtor pay an installment or the full balance, crediting the creditor', () => {
    let s = payoutState();
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());
    s = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([2]));
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
    s = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([3]));
    const debt = s.playerDebts[0];
    const balance = playerDebtBalance(debt);

    const withoutDebt = patch(s, (d) => { d.playerDebts = []; });
    // withoutDebt is a separate structural clone — must use ITS OWN player
    // objects, not s's. netWorth derives the player's index via
    // s.players.indexOf(p), so a player object from the wrong state either
    // silently drops their debt legs (if some other player happens to sit at
    // the same index) or throws (if the index doesn't resolve at all) —
    // exactly the footgun the audit flagged in operatingNetWorth.
    expect(netWorth(s, s.players[0])).toBe(netWorth(withoutDebt, withoutDebt.players[0]) - balance);
    expect(netWorth(s, s.players[1])).toBe(netWorth(withoutDebt, withoutDebt.players[1]) + balance);
  });
});
