// BANK LOANS (2026-09-20) — borrowing cash from the bank against what you
// already own, priced at the Bank Rate.
//
// Distinct from the three borrowings that came before it:
//   - Margin (Section 20) is an advanced-mode trading line, capped at $4,000
//     and half-repaid at every Market Open.
//   - Outstanding Fees are a charge you chose to carry, not money handed over.
//   - A Payout Claim loan is another PLAYER's money, and only ever covers a
//     claim you could not pay.
//
// A bank loan is ordinary borrowing: take what your holdings support on your
// own turn, pay the Bank Rate on it each turn, and repay whenever you like.
// Anything still owed at Market Close counts against the final score, so a
// loan is leverage, not free money.

import { BANK_LOAN_INCREMENT, BANK_LOAN_INSTALLMENT, BANK_LOAN_MAX_LTV, BANK_LOAN_MIN_INTEREST, etfValue } from '../data';
import { money } from '../utils/formatMoney';
import { bankRateBp } from './rates';
import { canMarketSell } from './rules';
import { sharesValue } from './scoringEngine';
import { totalOwedByPlayer } from './playerLoans';
import type { GameState, LogKind, Player } from './types';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

export function bankLoanBalance(player: Player): number {
  return (player.bankLoanPrincipal ?? 0) + (player.bankLoanInterest ?? 0);
}

/** Market value of everything a player could borrow against: stocks, IPOs and
    ETFs. Cash is deliberately excluded — a loan is against holdings, so a
    player cannot borrow simply because they are holding the money already. */
export function collateralValue(s: GameState, pi: number): number {
  const p = s.players[pi];
  return sharesValue(s, p) + etfValue(p.etfShares);
}

/** The most this player may owe in total, across bank loans and player loans:
    half the market value of their holdings. Falls as prices fall, which is
    what stops a borrowed position from compounding on the way down. */
export function debtCeiling(s: GameState, pi: number): number {
  return Math.floor((collateralValue(s, pi) * BANK_LOAN_MAX_LTV) / BANK_LOAN_INCREMENT) * BANK_LOAN_INCREMENT;
}

/** What is still available to borrow, in whole increments. */
export function borrowingCapacity(s: GameState, pi: number): number {
  const owed = bankLoanBalance(s.players[pi]) + totalOwedByPlayer(s, pi);
  const room = debtCeiling(s, pi) - owed;
  return Math.max(0, Math.floor(room / BANK_LOAN_INCREMENT) * BANK_LOAN_INCREMENT);
}

/** Why the current player can't take this loan right now, or null. */
export function bankLoanBlockReason(s: GameState, amount: number): string | null {
  if (!s.opts.bankLoans) return 'Bank loans are turned off for this game.';
  if (!canMarketSell(s)) return 'Roll and resolve every required action first.';
  if (amount <= 0 || amount % BANK_LOAN_INCREMENT !== 0) {
    return `Borrow in ${money(BANK_LOAN_INCREMENT)} steps.`;
  }
  const capacity = borrowingCapacity(s, s.cur);
  if (capacity <= 0) {
    return `You can borrow up to half the value of your holdings, and you are already there. Your holdings are worth ${money(collateralValue(s, s.cur))}.`;
  }
  if (amount > capacity) return `You can borrow ${money(capacity)} more right now.`;
  return null;
}

export function takeBankLoan(s: GameState, amount: number): void {
  if (bankLoanBlockReason(s, amount)) return;
  const p = s.players[s.cur];
  p.bankLoanPrincipal = (p.bankLoanPrincipal ?? 0) + amount;
  p.cash += amount;
  addLog(s, `${p.name} borrows ${money(amount)} from the bank at ${bankRateBp(s) / 100}%/turn. Balance ${money(bankLoanBalance(p))}.`, 'y');
}

/** One turn of interest at the CURRENT Bank Rate — a bank loan floats, unlike
    a player loan, whose rate is fixed when it is agreed. Rounded to $10 with a
    small minimum so a tiny balance still costs something. */
export function accrueBankLoan(s: GameState, pi: number): number {
  const p = s.players[pi];
  const balance = bankLoanBalance(p);
  if (balance <= 0) return 0;
  const rounded = Math.round((balance * bankRateBp(s)) / 10_000 / 10) * 10;
  const interest = Math.max(BANK_LOAN_MIN_INTEREST, rounded);
  p.bankLoanInterest = (p.bankLoanInterest ?? 0) + interest;
  return interest;
}

/** Pay interest first, then principal. Returns the cash actually paid. */
export function payBankLoan(s: GameState, mode: 'installment' | 'full'): number {
  const p = s.players[s.cur];
  const balance = bankLoanBalance(p);
  const requested = mode === 'full' ? balance : Math.min(BANK_LOAN_INSTALLMENT, balance);
  if (requested <= 0 || p.cash < requested) return 0;

  p.cash -= requested;
  const towardInterest = Math.min(p.bankLoanInterest ?? 0, requested);
  p.bankLoanInterest = (p.bankLoanInterest ?? 0) - towardInterest;
  p.bankLoanPrincipal = (p.bankLoanPrincipal ?? 0) - (requested - towardInterest);
  addLog(s, `${p.name} repays ${money(requested)} of their bank loan. Balance ${money(bankLoanBalance(p))}.`, 'g');
  return requested;
}
