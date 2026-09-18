import { FEE_DEBT_INSTALLMENT, FEE_DEBT_INTEREST_RATE, FEE_DEBT_MIN_INTEREST } from '../data';
import type { Player } from './types';

export function feeDebtBalance(player: Player): number {
  return player.feeDebtPrincipal + player.feeDebtInterest;
}

export function addFeeDebt(player: Player, amount: number): void {
  player.feeDebtPrincipal += Math.max(0, amount);
}

/** Add one turn of compounding interest, rounded to $10 with a $100 minimum.
    Rounding to $100 made the stated 5%/turn rate a lie at real balances — a
    $3,000 balance's true 5% ($150) rounded up to $200, an effective 6.67%.
    Rounding to $10 keeps the log/UI's "5%" claim (Portfolio.tsx) accurate
    while the $100 floor still guarantees a real minimum fee on small debts. */
export function accrueFeeDebt(player: Player): number {
  const balance = feeDebtBalance(player);
  if (balance <= 0) return 0;
  const rounded = Math.round(balance * FEE_DEBT_INTEREST_RATE / 10) * 10;
  const interest = Math.max(FEE_DEBT_MIN_INTEREST, rounded);
  player.feeDebtInterest += interest;
  return interest;
}

/** Pay interest first, then principal. Returns the actual cash paid. */
export function payFeeDebt(player: Player, mode: 'installment' | 'full'): number {
  const balance = feeDebtBalance(player);
  const requested = mode === 'full' ? balance : Math.min(FEE_DEBT_INSTALLMENT, balance);
  if (requested <= 0 || player.cash < requested) return 0;
  const paid = requested;

  player.cash -= paid;
  const towardInterest = Math.min(player.feeDebtInterest, paid);
  player.feeDebtInterest -= towardInterest;
  player.feeDebtPrincipal -= paid - towardInterest;
  return paid;
}
