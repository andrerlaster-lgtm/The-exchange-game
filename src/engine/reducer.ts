// Public reduce function — wraps resolveAction in an Immer produce call.

import { produce } from 'immer';
import type { Rng } from '../utils/rng';
import type { Action, GameState } from './types';
import { resolveAction } from './actionResolver';

export function reduce(state: GameState, action: Action, rng: Rng): GameState {
  return produce(state, (draft) => {
    resolveAction(draft as GameState, action, rng);
  });
}

// Re-exports for consumers that previously imported from reducer.ts
export { initialState, freshDecks, freshIpos } from './gameState';
export { netWorth, sharesValue, isDiversified } from './scoringEngine';
export { priceOf, stepOf, canTradeNow, blocked } from './rules';
export { money } from '../utils/formatMoney';
