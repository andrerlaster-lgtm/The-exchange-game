// Factory functions for fresh game state.

import { IPO_DEFS, IPO_SUPPLY, PLAYER_COLORS, REGULAR_SUPPLY, STOCK_BY_CODE, CARDS, DEFAULT_PIECES } from '../data';
import type { Rng } from '../utils/rng';
import type { GameState } from './types';
import { DEFAULT_OPTIONS } from './types';

export function buildMarketEventDeck(rng: Rng): number[] {
  const closeIdx = CARDS.ME.findIndex(c => c.eff.k === 'close');
  const rest = Array.from({ length: CARDS.ME.length }, (_, i) => i).filter(i => i !== closeIdx);
  const shuffled = rng.shuffle(rest);
  // Insert Market Close into a random position in the bottom 25%
  const bottom25Start = Math.floor(shuffled.length * 0.75);
  const insertAt = rng.int(bottom25Start, shuffled.length);
  shuffled.splice(insertAt, 0, closeIdx);
  return shuffled;
}

export function freshDecks(rng: Rng): GameState['decks'] {
  const seq = (n: number) => rng.shuffle(Array.from({ length: n }, (_, i) => i));
  return { ME: buildMarketEventDeck(rng), FED: seq(CARDS.FED.length) };
}

export function freshIpos(): GameState['ipos'] {
  return IPO_DEFS.map((ip) => ({
    code: ip.code, startStep: ip.startStep, step: ip.startStep,
    supply: IPO_SUPPLY, revealed: false,
  }));
}

export function initialState(rng: Rng): GameState {
  const prices: Record<string, number> = {};
  const supply: Record<string, number> = {};
  for (const s of Object.values(STOCK_BY_CODE)) {
    prices[s.code] = s.step;
    supply[s.code] = REGULAR_SUPPLY;
  }
  return {
    phase: 'setup',
    numPlayers: 4,
    names: ['Morgan', 'Riley', 'Avery', 'Quinn', 'Sage', 'Devon'],
    pieces: [...DEFAULT_PIECES],
    players: [],
    cur: 0,
    turnPhase: 'preRoll',
    dice: [null, null],
    rolling: false,
    bonusRollPending: false,
    bonusRollUsed: false,
    prices, supply,
    skips: {}, soldOut: {}, bankPool: {}, bankSoldThisTurn: {}, auction: null, auctionQueue: [], marketOpenWindow: false, lap: 1,
    log: [],
    marketSignals: [],
    marketSignalSeq: 0,
    tradeLog: [],
    trade: null, pendingDraws: [], card: null, pick: null, shortPick: false,
    ipos: freshIpos(),
    ipoChoice: false, ipoListPick: false, ipoBuy: null,
    decks: freshDecks(rng), discard: { ME: [], FED: [] },
    shorts: [], closing: false, closeDrawer: null,
    extendedHoursAvailable: false, extendedRoundsLeft: 0,
    circuitBreakerHolder: null, circuitBreakerPrompt: null,
    etfPick: null,
    marginCall: null,
    insolvency: null,
    feeLog: [],
    lastDraw: null,
    p2pOffers: [],
    p2pSeq: 0,
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
      cash: s.opts.startCash, pos: 1, shares: {}, etfShares: {}, margin: 0, prevRank: null,
    });
  }
}
