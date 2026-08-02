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
import { AH_CARDS } from './afterHoursDeck';

export { ME_CARDS, FED_CARDS, AH_CARDS };

export const CARDS: Record<DeckId, Card[]> = {
  ME:  ME_CARDS,
  FED: FED_CARDS,
  AH:  AH_CARDS,
};

/** Returns only cards that are active in Fast Prototype mode (filters out strategyOnly cards). */
export function getActiveAfterHoursDeck(): Card[] {
  return AH_CARDS.filter(c => !c.strategyOnly);
}
