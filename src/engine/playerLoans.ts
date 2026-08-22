import { PLAYER_LOAN_INSTALLMENT, PLAYER_LOAN_MIN_INTEREST } from '../data';
import type { GameState, PlayerDebt } from './types';

export function playerDebtBalance(debt: PlayerDebt): number {
  return debt.principal + debt.interest;
}

/** Total the given player currently owes across every negotiated loan. */
export function totalOwedByPlayer(s: GameState, playerIdx: number): number {
  return s.playerDebts
    .filter((d) => d.debtor === playerIdx)
    .reduce((sum, d) => sum + playerDebtBalance(d), 0);
}

/** Total the given player is currently owed across every negotiated loan. */
export function totalOwedToPlayer(s: GameState, playerIdx: number): number {
  return s.playerDebts
    .filter((d) => d.creditor === playerIdx)
    .reduce((sum, d) => sum + playerDebtBalance(d), 0);
}

/** Add one turn of compounding interest at this loan's own creditor-chosen
    rate, rounded to $100 with a $100 minimum. Mirrors accrueFeeDebt. */
export function accruePlayerDebt(debt: PlayerDebt): number {
  const balance = playerDebtBalance(debt);
  if (balance <= 0) return 0;
  const rounded = Math.round((balance * debt.rate) / 100 / 100) * 100;
  const interest = Math.max(PLAYER_LOAN_MIN_INTEREST, rounded);
  debt.interest += interest;
  return interest;
}

export function playerDebtInstallment(debt: PlayerDebt): number {
  return Math.min(PLAYER_LOAN_INSTALLMENT, playerDebtBalance(debt));
}

/** Pay interest first, then principal. Returns the actual amount paid; the
    caller moves that much cash from debtor to creditor. */
export function payPlayerDebt(debt: PlayerDebt, mode: 'installment' | 'full'): number {
  const balance = playerDebtBalance(debt);
  const requested = mode === 'full' ? balance : Math.min(PLAYER_LOAN_INSTALLMENT, balance);
  if (requested <= 0) return 0;
  const towardInterest = Math.min(debt.interest, requested);
  debt.interest -= towardInterest;
  debt.principal -= requested - towardInterest;
  return requested;
}
