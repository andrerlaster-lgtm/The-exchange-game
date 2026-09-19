import { describe, expect, it } from 'vitest';
import { FED_CARDS, ME_CARDS } from '../data';
import type { Effect } from '../data/types';

function effectSignature(effect: Effect): string {
  if (effect.k !== 'multi') return JSON.stringify(effect);
  const moves = effect.m
    .map((move) => `${move.sec ?? `risk:${move.risk}`}:${move.bp}`)
    .sort();
  return JSON.stringify({ k: effect.k, moves });
}

describe('card pool', () => {
  it('does not repeat a card title across the Market Event and Fed decks', () => {
    const titles = [...ME_CARDS, ...FED_CARDS].map((card) => card.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('does not contain duplicate Fed effects', () => {
    const effects = FED_CARDS.map((card) => effectSignature(card.eff));
    expect(new Set(effects).size).toBe(effects.length);
  });

  it('gives the revised Fed cards distinct market roles', () => {
    expect(FED_CARDS.find((card) => card.title === 'Mortgage Pressure')?.eff).toEqual({
      k: 'multi',
      m: [{ sec: 'realestate', bp: -500 }, { sec: 'consumer', bp: -500 }],
    });
    expect(FED_CARDS.find((card) => card.title === 'Bond Yields Rise')?.eff).toEqual({
      k: 'multi',
      m: [{ risk: 'Low', bp: 500 }, { risk: 'High', bp: -500 }],
    });
  });
});
