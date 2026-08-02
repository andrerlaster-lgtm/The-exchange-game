// Phase 9: Extended Hours is now active in standard mode (rulebook §20/§21) —
// it's no longer excluded from the shuffled After-Hours deck.

import { describe, it, expect } from 'vitest';
import { CARDS } from '../data';
import { freshDecks } from '../engine/gameState';
import { dispatch, patch, rng, started } from './helpers';

describe('After-Hours deck', () => {
  it('the shuffled AH deck includes every AH card, including Extended Hours', () => {
    const decks = freshDecks(rng());
    expect(decks.AH.length).toBe(CARDS.AH.length);
    const drawnTitles = decks.AH.map((idx) => CARDS.AH[idx].title);
    expect(drawnTitles).toContain('Extended Hours');
  });

  it('Extended Hours is no longer flagged strategyOnly', () => {
    const extendedHours = CARDS.AH.find((c) => c.title === 'Extended Hours');
    expect(extendedHours).toBeDefined();
    expect(extendedHours?.strategyOnly).toBeUndefined();
  });
});

describe('deck recycling', () => {
  it('reshuffles the discard pile when a deck runs out (no repeated order)', () => {
    // Empty FED deck with a full, ordered discard pile; a draw must recycle it.
    const drawnOrder = Array.from({ length: CARDS.FED.length }, (_, i) => i);
    let s = started();
    s = patch(s, (d) => {
      d.decks.FED = [];
      d.discard.FED = [...drawnOrder];
      d.pendingDraws = ['FED'];
      d.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'draw', deck: 'FED' }, rng('recycle-seed'));

    // All cards preserved: the drawn card (in discard) + the rest of the deck.
    const recycled = [...s.discard.FED, ...s.decks.FED];
    expect([...recycled].sort((a, b) => a - b)).toEqual(drawnOrder);
    // And the recycled order is a genuine reshuffle, not the old drawn order.
    expect(recycled).not.toEqual(drawnOrder);
  });
});
