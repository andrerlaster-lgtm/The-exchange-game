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

  // 2026-08-21 Deck Rebuild: Fixed Rounds owns its own ending (s.lap >=
  // closeRounds) — a randomly-drawn Market Close card must never also end
  // that kind of game early, so it's excluded from the deck entirely.
  it('excludes Market Close entirely in Fixed Rounds mode', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const deck = buildMarketEventDeck(makeRng(seed), 'rounds');
      expect(deck).not.toContain(closeIdx);
      expect(deck).toHaveLength(CARDS.ME.length - 1);
    }
  });
});
