// Turn-flow helpers: lap tracking, state clearing (called on Immer drafts).

import type { GameState } from './types';

export function startLap(s: GameState): void {
  s.lap += 1;
  // Weak Demand markers deliberately SURVIVE the lap rollover. Rulebook §9/§19:
  // a marker stays on a company until it reaches the 2-marker threshold (price
  // drops a step and the markers clear) or the company is bought outright.
  // Wiping s.skips here made the second skip have to land on the same company
  // within the same lap, which with 22 companies and a handful of turns per lap
  // meant the mechanic essentially never fired — a full 12-round game produced
  // six skips and zero price drops. The only resets are in skipStock (on reaching
  // the threshold), buy (on acquiring the company), and startGame.
}

export function clearTurnState(s: GameState): void {
  s.trade = null; s.card = null; s.cardPreviewMode = null; s.pendingDraws = [];
  s.pick = null; s.investorDay = null;
  s.ipoChoice = false; s.ipoListPick = false; s.ipoBuy = null; s.outstandingBuy = null; s.etfPick = null;
  s.marginCall = null; s.insolvency = null;
  s.landingNotice = null;
  s.cyberattackPrompt = null;
  s.openingBellPrompt = null;
  s.regulatoryInvestigationPrompt = null;
  s.payoutShortfallChoice = null;
  s.loanRatePrompt = null;
  s.regimeRollPrompt = null;
  s.bankSoldThisTurn = {};
}
