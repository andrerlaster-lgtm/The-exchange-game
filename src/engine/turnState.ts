// Turn-flow helpers: lap tracking, state clearing (called on Immer drafts).

import type { GameState } from './types';

export function startLap(s: GameState): void {
  s.lap += 1;
  s.skips = {};
}

export function clearTurnState(s: GameState): void {
  s.trade = null; s.card = null; s.cardPreviewMode = null; s.pendingDraws = [];
  s.pick = null; s.investorDay = null; s.shortPick = false;
  s.ipoChoice = false; s.ipoListPick = false; s.ipoBuy = null; s.outstandingBuy = null; s.etfPick = null;
  s.marginCall = null; s.insolvency = null;
  s.landingNotice = null;
  s.bankSoldThisTurn = {};
}
