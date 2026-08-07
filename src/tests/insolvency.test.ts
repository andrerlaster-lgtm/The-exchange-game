// Forced sale now applies only to a Payout Claim owed to another player.
// Audit Notice and Portfolio Tax can instead be carried as Outstanding Fees.

import { describe, expect, it } from 'vitest';
import { PAYOUT_TIER_CONTROL } from '../data';
import { blocked } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

describe('Outstanding Fees replace bank-fee insolvency', () => {
  it('Portfolio Tax can be carried without force-selling stock or losing cash', () => {
    let s = patch(started(2), (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 100;
      d.players[0].shares = { MEDI: 3 };
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));

    const charge = s.landingNotice!.amount;
    expect(s.insolvency).toBeNull();
    expect(s.players[0].cash).toBe(100);
    expect(blocked(s)).toBe(true);

    s = dispatch(s, { t: 'deferLandingFee' }, rng());
    expect(s.players[0].feeDebtPrincipal).toBe(charge);
    expect(s.players[0].shares.MEDI).toBe(3);
    expect(blocked(s)).toBe(false);
  });

  it('Audit Notice can be carried even when cash is zero', () => {
    let s = patch(started(2), (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 0;
      d.players[0].shares = { FRSH: 1 };
      d.players[0].margin = 2_000;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));

    expect(s.landingNotice?.amount).toBe(750);
    expect(s.insolvency).toBeNull();
    s = dispatch(s, { t: 'deferLandingFee' }, rng());
    expect(s.players[0].feeDebtPrincipal).toBe(750);
    expect(s.players[0].shares.FRSH).toBe(1);
  });
});

describe('Insolvency — Payout Claim landing payment', () => {
  const CODE = 'FTRB';
  const SPACE = 8;

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

  it('presents a shortfall choice because another player is owed', () => {
    let s = payoutState();
    const holderBefore = s.players[1].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));

    expect(s.players[0].pos).toBe(SPACE);
    expect(s.players[0].cash).toBe(0);
    expect(s.players[1].cash).toBe(holderBefore + 100);
    expect(s.payoutShortfallChoice).toMatchObject({
      player: 0, creditor: 1, owed: PAYOUT_TIER_CONTROL - 100, canForceSell: true,
    });
    expect(s.landingNotice?.canDefer).toBe(false);

    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutForceSell' }, rng());
    expect(s.insolvency).toMatchObject({
      reason: 'payout', payTo: 1, owed: PAYOUT_TIER_CONTROL - 100,
    });
  });

  it('routes forced-sale cash to the Payout Claim holder', () => {
    let s = payoutState();
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutForceSell' }, rng());
    const owed = s.insolvency!.owed;
    let guard = 0;
    while (s.players[0].cash < owed && guard++ < 10) {
      s = dispatch(s, { t: 'forcedSell', code: 'MEDI' }, rng());
    }
    const holderBefore = s.players[1].cash;
    s = dispatch(s, { t: 'payInsolvency' }, rng());

    expect(s.insolvency).toBeNull();
    expect(s.players[1].cash).toBe(holderBefore + owed);
  });

  it('never allows an IPO share to be force-sold', () => {
    let s = payoutState();
    s = patch(s, (d) => { d.players[0].shares.NDRV = 3; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'choosePayoutForceSell' }, rng());
    const cashBefore = s.players[0].cash;
    s = dispatch(s, { t: 'forcedSell', code: 'NDRV' }, rng());

    expect(s.players[0].cash).toBe(cashBefore);
    expect(s.players[0].shares.NDRV).toBe(3);
  });

  it('can negotiate a loan instead of force-selling when the debtor cannot fully cover the shortfall', () => {
    let s = payoutState();
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    const owed = s.payoutShortfallChoice!.owed;
    s = dispatch(s, { t: 'choosePayoutLoan' }, rng());

    expect(s.payoutShortfallChoice).toBeNull();
    expect(s.loanRatePrompt).toMatchObject({ debtor: 0, creditor: 1, amount: owed });

    s = dispatch(s, { t: 'setLoanRate', rate: 3 }, rng());
    expect(s.loanRatePrompt).toBeNull();
    expect(s.playerDebts).toMatchObject([{ debtor: 0, creditor: 1, principal: owed, interest: 0, rate: 3 }]);
    expect(s.insolvency).toBeNull();
  });
});
