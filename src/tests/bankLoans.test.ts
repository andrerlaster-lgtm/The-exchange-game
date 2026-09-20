// Bank loans and freely-asked player loans (2026-09-20). Both borrow against
// what you hold and price off the Bank Rate.

import { describe, expect, it } from 'vitest';
import { BANK_LOAN_INCREMENT, BANK_LOAN_MAX_LTV } from '../data';
import {
  bankLoanBalance, bankLoanBlockReason, borrowingCapacity, collateralValue, debtCeiling, netWorth,
} from '../engine';
import type { GameState } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

/** Player 0 holds 8 MEDI (8 × $750 = $6,000 of collateral), has rolled, and
    nothing is pending. */
function borrower(extra: (d: GameState) => void = () => {}): GameState {
  return patch(started(2), (d) => {
    d.players[0].shares = { MEDI: 8 };
    d.players[0].cash = 1_000;
    d.turnPhase = 'acted';
    d.cur = 0;
    extra(d);
  });
}

const borrow = (s: GameState, amount: number) => dispatch(s, { t: 'takeBankLoan', amount }, rng());
const repay = (s: GameState, mode: 'installment' | 'full') => dispatch(s, { t: 'payBankLoan', mode }, rng());

describe('borrowing capacity', () => {
  it('is half the market value of holdings, in $1,000 steps', () => {
    const s = borrower();
    expect(collateralValue(s, 0)).toBe(6_000);
    expect(debtCeiling(s, 0)).toBe(3_000);
    expect(borrowingCapacity(s, 0)).toBe(3_000);
    expect(BANK_LOAN_MAX_LTV).toBe(0.5);
  });

  it('counts cash as no collateral at all', () => {
    const rich = borrower((d) => { d.players[0].shares = {}; d.players[0].cash = 80_000; });
    expect(borrowingCapacity(rich, 0)).toBe(0);
    expect(bankLoanBlockReason(rich, 1_000)).toMatch(/half the value of your holdings/);
  });

  it('falls as the balance rises, and as prices fall', () => {
    const s = borrow(borrower(), 2_000);
    expect(borrowingCapacity(s, 0)).toBe(1_000);
    const crashed = patch(s, (d) => { d.prices.MEDI = 375; }); // collateral halves
    expect(debtCeiling(crashed, 0)).toBe(1_000);
    expect(borrowingCapacity(crashed, 0)).toBe(0); // already owes more than the ceiling
  });
});

describe('taking a bank loan', () => {
  it('pays out the cash and records the debt', () => {
    const s = borrow(borrower(), 3_000);
    expect(s.players[0].cash).toBe(4_000);
    expect(bankLoanBalance(s.players[0])).toBe(3_000);
    expect(s.log.some((l) => /borrows \$3,000 from the bank at 3%/.test(l.text))).toBe(true);
  });

  it('leaves net worth unchanged — the cash is owed', () => {
    const before = borrower();
    const after = borrow(before, 3_000);
    expect(netWorth(after, after.players[0])).toBe(netWorth(before, before.players[0]));
  });

  it('refuses more than the capacity, odd amounts, and a blocked turn', () => {
    const s = borrower();
    expect(bankLoanBlockReason(s, 4_000)).toMatch(/can borrow \$3,000 more/);
    expect(borrow(s, 4_000).players[0].cash).toBe(1_000);
    expect(bankLoanBlockReason(s, 1_500)).toMatch(/\$1,000 steps/);
    expect(bankLoanBlockReason(s, 0)).toMatch(/\$1,000 steps/);
    const preRoll = patch(s, (d) => { d.turnPhase = 'preRoll'; });
    expect(bankLoanBlockReason(preRoll, 1_000)).toMatch(/Roll and resolve/);
    const off = patch(s, (d) => { d.opts.bankLoans = false; });
    expect(bankLoanBlockReason(off, 1_000)).toMatch(/turned off/);
  });
});

describe('interest and repayment', () => {
  it('charges the live Bank Rate at the start of the borrower\'s turn', () => {
    let s = borrower((d) => { d.bankRateBp = 400; d.cur = 0; });
    s = borrow(s, 3_000);
    s = dispatch(patch(s, (d) => { d.turnPhase = 'acted'; }), { t: 'endTurn' }, rng());
    s = dispatch(patch(s, (d) => { d.turnPhase = 'acted'; }), { t: 'endTurn' }, rng()); // back to player 0
    expect(s.cur).toBe(0);
    expect(s.players[0].bankLoanInterest).toBe(120); // 4% of $3,000
    expect(bankLoanBalance(s.players[0])).toBe(3_120);
  });

  it('follows the Bank Rate as it moves, unlike a player loan', () => {
    const base = borrow(borrower(), 3_000);
    const cheap = patch(base, (d) => { d.bankRateBp = 100; });
    const dear = patch(base, (d) => { d.bankRateBp = 800; });
    const accrue = (s: GameState) => dispatch(patch(dispatch(patch(s, (d) => { d.turnPhase = 'acted'; }), { t: 'endTurn' }, rng()), (d) => { d.turnPhase = 'acted'; }), { t: 'endTurn' }, rng());
    expect(accrue(cheap).players[0].bankLoanInterest).toBe(30);
    expect(accrue(dear).players[0].bankLoanInterest).toBe(240);
  });

  it('pays interest before principal, in installments or in full', () => {
    let s = borrow(borrower(), 3_000);
    s = patch(s, (d) => { d.players[0].bankLoanInterest = 200; d.players[0].cash = 4_000; });
    s = repay(s, 'installment');
    expect(s.players[0].bankLoanInterest).toBe(0);
    expect(s.players[0].bankLoanPrincipal).toBe(2_700); // $500 paid: $200 interest, $300 principal
    expect(s.players[0].cash).toBe(3_500);

    s = repay(s, 'full');
    expect(bankLoanBalance(s.players[0])).toBe(0);
    expect(s.players[0].cash).toBe(800);
  });

  it('cannot repay what the player cannot afford', () => {
    const s = patch(borrow(borrower(), 3_000), (d) => { d.players[0].cash = 100; });
    expect(repay(s, 'installment').players[0].cash).toBe(100);
    expect(bankLoanBalance(repay(s, 'full').players[0])).toBe(3_000);
  });
});

describe('asking another player for a loan', () => {
  const ask = (s: GameState, amount: number) => dispatch(s, { t: 'requestPlayerLoan', from: 0, to: 1, amount }, rng());

  it('moves the lender\'s cash once they accept, at the Bank Rate plus their roll', () => {
    let s = borrower((d) => { d.players[1].cash = 20_000; });
    s = ask(s, 2_000);
    expect(s.loanRatePrompt).toMatchObject({ debtor: 0, creditor: 1, amount: 2_000, label: 'a cash loan' });
    expect(s.players[0].cash).toBe(1_000); // nothing moves until the lender answers

    s = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([3]));
    expect(s.players[0].cash).toBe(3_000);
    expect(s.players[1].cash).toBe(18_000);
    expect(s.playerDebts).toMatchObject([{ debtor: 0, creditor: 1, principal: 2_000, rate: 5 }]);
  });

  it('can be declined, and then no cash moves', () => {
    let s = ask(borrower((d) => { d.players[1].cash = 20_000; }), 2_000);
    s = dispatch(s, { t: 'declinePlayerLoan' }, rng());
    expect(s.loanRatePrompt).toBeNull();
    expect(s.players[0].cash).toBe(1_000);
    expect(s.players[1].cash).toBe(20_000);
    expect(s.playerDebts).toHaveLength(0);
  });

  it('shares one borrowing limit with bank loans', () => {
    // $3,000 of capacity: a $2,000 bank loan leaves room for $1,000 only.
    let s = borrow(borrower((d) => { d.players[1].cash = 20_000; }), 2_000);
    s = ask(s, 2_000);
    expect(s.loanRatePrompt).toBeNull();
    s = ask(s, 1_000);
    expect(s.loanRatePrompt).not.toBeNull();
  });

  it('refuses when the lender has not got the cash', () => {
    const poor = borrower((d) => { d.players[1].cash = 500; });
    expect(ask(poor, 2_000).loanRatePrompt).toBeNull();
  });

  it('a Payout Claim loan still moves no cash — the creditor was owed already', () => {
    const s = patch(started(2), (d) => {
      d.loanRatePrompt = { debtor: 0, creditor: 1, code: 'MEDI', amount: 2_000, label: 'MEDI Payout Claim' };
    });
    const t = dispatch(s, { t: 'rollLoanRate' }, scriptedRng([3]));
    expect(t.players[0].cash).toBe(s.players[0].cash);
    expect(t.players[1].cash).toBe(s.players[1].cash);
    expect(t.playerDebts).toHaveLength(1);
  });

  it('cannot be declined when it is Payout Claim financing', () => {
    const s = patch(started(2), (d) => {
      d.loanRatePrompt = { debtor: 0, creditor: 1, code: 'MEDI', amount: 2_000, label: 'MEDI Payout Claim' };
    });
    expect(dispatch(s, { t: 'declinePlayerLoan' }, rng()).loanRatePrompt).not.toBeNull();
  });
});

describe('the borrowing increment', () => {
  it('is $1,000', () => {
    expect(BANK_LOAN_INCREMENT).toBe(1_000);
  });
});
