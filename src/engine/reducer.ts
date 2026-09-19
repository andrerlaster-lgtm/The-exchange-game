// Public reduce function — wraps resolveAction in an Immer produce call.

import { produce } from 'immer';
import type { Rng } from '../utils/rng';
import type { Action, GameState } from './types';
import { resolveAction } from './actionResolver';
import { recordPortfolioMilestones } from './marketSignals';
import { enforceDevelopmentControl } from './development';
import { payIpoMilestones } from './ipoGrowth';

export function reduce(state: GameState, action: Action, rng: Rng): GameState {
  return produce(state, (draft) => {
    // IPO milestones pay on holdings from before the turn the move happened
    // in. Copied before the action because End Turn replaces the snapshot for
    // the next turn after any round-end repricing has already run.
    const turnStart = JSON.parse(JSON.stringify(draft.ipoSharesAtTurnStart ?? {})) as GameState['ipoSharesAtTurnStart'];
    resolveAction(draft as GameState, action, rng);
    payIpoMilestones(draft as GameState, turnStart);
    // After every action, so no share-moving path can skip the control-loss
    // reset and refund.
    enforceDevelopmentControl(draft as GameState);
    recordPortfolioMilestones(draft as GameState);
  });
}

// Re-exports for consumers that previously imported from reducer.ts
export { initialState, freshDecks, freshIpos } from './gameState';
export { netWorth, sharesValue, isDiversified } from './scoringEngine';
export { priceOf, canFall, canRise, canTradeNow, blocked } from './rules';
export { money } from '../utils/formatMoney';
