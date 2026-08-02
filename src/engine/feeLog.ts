// Shared helper for the Taxes & Fees panel log — tracks margin calls, Market
// Open income, and Audit Notice payments only (no buy/sell/trade noise).

import type { FeeEventKind, GameState, Player } from './types';

export function pushFeeEvent(s: GameState, kind: FeeEventKind, p: Player, amount: number): void {
  s.feeLog.unshift({ kind, player: p.name, color: p.color, lap: s.lap, amount });
  if (s.feeLog.length > 40) s.feeLog.pop();
}
