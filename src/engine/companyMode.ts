import type { GameState, Player } from './types';
import { operatingNetWorth } from './scoringEngine';

export const COMPANY_TOTAL_SHARES = 100;
export const COMPANY_FOUNDER_SHARES = 60;
export const COMPANY_PUBLIC_SHARES = 40;
export const COMPANY_PRICE_FLOOR = 25;
export const COMPANY_LOAN_RATE = 0.05;

/** Company value deliberately excludes player-company holdings, so prices do not loop. */
export function companyValue(s: GameState, owner: number): number {
  return Math.max(0, operatingNetWorth(s, s.players[owner]));
}

export function companySharePrice(s: GameState, owner: number): number {
  return Math.max(COMPANY_PRICE_FLOOR, Math.round(companyValue(s, owner) / COMPANY_TOTAL_SHARES));
}

export function companyLoanBalance(p: Player): number {
  return Math.max(0, p.companyLoanPrincipal + p.companyLoanInterest);
}

export function companySharesHeld(p: Player, owner: number): number {
  return p.companyHoldings[owner] ?? 0;
}

/** Public shares issued to players; the remainder is still held by the bank. */
export function companyPublicSharesHeld(s: GameState, owner: number): number {
  return s.players.reduce((sum, p) => sum + companySharesHeld(p, owner), 0);
}

export function companyPublicSharesRemaining(s: GameState, owner: number): number {
  return Math.max(0, COMPANY_PUBLIC_SHARES - companyPublicSharesHeld(s, owner));
}

export function companyMarketTradingOpen(s: GameState): boolean {
  if (!s.opts.companiesMode || !s.companyMarketOpen) return false;
  if (s.marketHaltUntilLap !== null && s.lap < s.marketHaltUntilLap) return false;
  return true;
}
