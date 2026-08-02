// Barrel re-export for all static game data.
export * from './types';
export * from './priceTrack';
export * from './stocks';
export * from './ipoStocks';
export * from './etfs';
export * from './boardSpaces';
export * from './pieces';

import type { Card, DeckId } from './types';
import { ME_CARDS } from './marketEventDeck';
import { FED_CARDS } from './fedRateDeck';

export { ME_CARDS, FED_CARDS };
export { CIRCUIT_BREAKER_INDEX } from './marketEventDeck';

export const CARDS: Record<DeckId, Card[]> = {
  ME:  ME_CARDS,
  FED: FED_CARDS,
};
