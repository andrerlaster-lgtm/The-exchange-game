// Former After-Hours cards now live in the single Market Event deck.

import { describe, it, expect } from 'vitest';
import { CARDS } from '../data';
import { freshDecks } from '../engine/gameState';
import { dispatch, patch, rng, started } from './helpers';

describe('merged Market Event deck', () => {
  it('includes every Market Event card, including Extended Hours and Circuit Breaker', () => {
    const decks = freshDecks(rng());
    expect(decks.ME.length).toBe(CARDS.ME.length);
    const drawnTitles = decks.ME.map((idx) => CARDS.ME[idx].title);
    expect(drawnTitles).toContain('Extended Hours');
    expect(drawnTitles).toContain('Circuit Breaker');
  });

  it('Extended Hours is no longer flagged strategyOnly', () => {
    const extendedHours = CARDS.ME.find((c) => c.title === 'Extended Hours');
    expect(extendedHours).toBeDefined();
    expect(extendedHours?.strategyOnly).toBeUndefined();
  });

  it('has no separate After-Hours deck', () => {
    expect('AH' in CARDS).toBe(false);
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
