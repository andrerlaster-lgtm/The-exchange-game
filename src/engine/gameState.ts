// Factory functions for fresh game state.

import { IPO_DEFS, IPO_SUPPLY, PLAYER_COLORS, REGULAR_SUPPLY, STOCK_BY_CODE, CARDS, DEFAULT_PIECES, BANK_RATE_START_BP } from '../data';
import type { Rng } from '../utils/rng';
import type { GameState } from './types';
import { DEFAULT_OPTIONS } from './types';

/**
 * Fixed Rounds mode has its own closing mechanism (s.lap >= closeRounds) —
 * a random Market Close card drawn from the event deck must never also end
 * that kind of game early (2026-08-21 deck rebuild). Card mode keeps the
 * pre-existing bottom-quarter insertion unchanged: no bounded "Card Close"
 * redesign was approved, so its timing is untouched by this rebuild.
 */
export function buildMarketEventDeck(rng: Rng, closeMode: GameState['opts']['closeMode'] = 'card'): number[] {
  const closeIdx = CARDS.ME.findIndex(c => c.eff.k === 'close');
  const rest = Array.from({ length: CARDS.ME.length }, (_, i) => i).filter(i => i !== closeIdx);
  const shuffled = rng.shuffle(rest);
  if (closeMode === 'rounds') return shuffled; // Market Close excluded entirely — Fixed Rounds owns the ending
  // Insert Market Close into a random position in the bottom 25%
  const bottom25Start = Math.floor(shuffled.length * 0.75);
  const insertAt = rng.int(bottom25Start, shuffled.length);
  shuffled.splice(insertAt, 0, closeIdx);
  return shuffled;
}

export function freshDecks(rng: Rng, closeMode: GameState['opts']['closeMode'] = 'card'): GameState['decks'] {
  const seq = (n: number) => rng.shuffle(Array.from({ length: n }, (_, i) => i));
  return { ME: buildMarketEventDeck(rng, closeMode), FED: seq(CARDS.FED.length) };
}

export function freshDevelopment(): GameState['development'] {
  return Object.fromEntries(Object.keys(STOCK_BY_CODE).map((code) => [
    code, { level: 0, shieldActive: false, fundedBy: null, totalInvested: 0 },
  ]));
}

export function freshIpos(): GameState['ipos'] {
  return IPO_DEFS.map((ip) => ({
    code: ip.code, startPrice: ip.start, price: ip.start, milestonesPaid: 0, growthFunding: {},
    supply: IPO_SUPPLY, revealed: false,
  }));
}

export function initialState(rng: Rng): GameState {
  const prices: Record<string, number> = {};
  const supply: Record<string, number> = {};
  for (const s of Object.values(STOCK_BY_CODE)) {
    prices[s.code] = s.base;
    supply[s.code] = REGULAR_SUPPLY;
  }
  return {
    phase: 'setup',
    numPlayers: 4,
    names: ['Morgan', 'Riley', 'Avery', 'Quinn', 'Sage', 'Devon'],
    pieces: [...DEFAULT_PIECES],
    players: [],
    orderRoll: null,
    cur: 0,
    turnPhase: 'preRoll',
    dice: [null, null],
    rolling: false,
    bonusRollPending: false,
    bonusRollUsed: false,
    prices, supply,
    skips: {}, demand: {}, soldOut: {}, bankPool: {}, bankSoldThisTurn: {}, auction: null, auctionQueue: [], marketOpenReport: null, marketConditions: [], lap: 1,
    log: [],
    marketSignals: [],
    marketSignalSeq: 0,
    portfolioMilestones: {},
    tradeLog: [],
    trade: null, pendingDraws: [], card: null, cardPreviewMode: null, pick: null, investorDay: null,
    ipos: freshIpos(),
    ipoChoice: false, ipoListPick: false, ipoBuy: null, outstandingBuy: null,
    decks: freshDecks(rng), discard: { ME: [], FED: [] },
    closing: false, closeDrawer: null,
    extendedHoursAvailable: false, extendedRoundsLeft: 0,
    circuitBreakerHolder: null, circuitBreakerPrompt: null,
    etfPick: null,
    marginCall: null,
    insolvency: null,
    landingNotice: null,
    cyberattackPrompt: null,
    openingBellPrompt: null,
    regulatoryInvestigationPrompt: null,
    payoutShortfallChoice: null,
    loanRatePrompt: null,
    lastMove: {},
    development: freshDevelopment(),
    upgradedThisTurn: false,
    ipoGrowthThisTurn: false,
    ipoBoughtThisTurn: [],
    ipoSharesAtTurnStart: {},
    rateDecisionPrompt: null,
    regimeRollPrompt: null,
    playerDebts: [],
    playerDebtSeq: 0,
    feeLog: [],
    lastDraw: null,
    p2pOffers: [],
    p2pSeq: 0,
    marketRound: null,
    roundDice: { aSum: 0, bSum: 0, rolls: 0 },
    marketTheme: null,
    roundCloseRecap: null,
    bankRateBp: BANK_RATE_START_BP,
    companyMarketOpen: false,
    marketHeat: 0,
    marketHaltUntilLap: null,
    companyLoanOffer: null,
    testMode: false,
    opts: { ...DEFAULT_OPTIONS },
  };
}

export function resetPlayers(s: GameState): void {
  s.players = [];
  for (let i = 0; i < s.numPlayers; i++) {
    const name = (s.names[i] || `Player ${i + 1}`).trim() || `Player ${i + 1}`;
    s.players.push({
      name, color: PLAYER_COLORS[i], piece: s.pieces[i] ?? DEFAULT_PIECES[i],
      cash: s.opts.startCash, pos: 1, hasCompletedLap: false, shares: {}, stockCostBasis: {}, realizedStockGain: 0, dividendCuts: {},
      etfShares: {}, salaryCollected: 0, margin: 0, bankLoanPrincipal: 0, bankLoanInterest: 0,
      feeDebtPrincipal: 0, feeDebtInterest: 0,
      marketStance: 'balanced', prevRank: null, companyShares: 60, companyHoldings: {},
      companyLoanPrincipal: 0, companyLoanInterest: 0, lapTrades: [],
    });
  }
}
