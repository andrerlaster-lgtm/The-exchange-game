import { describe, it, expect } from 'vitest';
import { buildMarketEventDeck } from '../engine/gameState';
import { CARDS } from '../data';
import { makeRng } from '../utils/rng';

describe('buildMarketEventDeck', () => {
  const closeIdx = CARDS.ME.findIndex(c => c.eff.k === 'close');

  it('Market Close appears exactly once in the deck', () => {
    const deck = buildMarketEventDeck(makeRng('test'));
    expect(deck.filter(i => i === closeIdx)).toHaveLength(1);
  });

  it('Market Close is never in the top 75% of the deck', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const deck = buildMarketEventDeck(makeRng(seed));
      const pos = deck.indexOf(closeIdx);
      const bottom25Start = Math.floor((deck.length - 1) * 0.75);
      expect(pos).toBeGreaterThanOrEqual(bottom25Start);
    }
  });

  it('deck contains all Market Event cards', () => {
    const deck = buildMarketEventDeck(makeRng('test'));
    expect(deck).toHaveLength(CARDS.ME.length);
    expect([...deck].sort((a, b) => a - b)).toEqual(
      Array.from({ length: CARDS.ME.length }, (_, i) => i),
    );
  });
});
