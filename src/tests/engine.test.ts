// Engine correctness: determinism, initial state sanity.

import { describe, expect, it } from 'vitest';
import { REGULAR_SUPPLY, STOCK_BY_CODE } from '../data';
import { getPlayerNetWorthMovement, initialState, reduce } from '../engine';
import { rng, started } from './helpers';

describe('Determinism', () => {
  it('same seed produces identical deck order', () => {
    const a = started(2, rng('seed-A'));
    const b = started(2, rng('seed-A'));
    expect(a.decks).toEqual(b.decks);
  });

  it('different seeds generally differ', () => {
    const a = started(2, rng('seed-A'));
    const b = started(2, rng('seed-Z'));
    expect(a.decks).not.toEqual(b.decks);
  });
});

describe('Initial state', () => {
  it('every regular stock starts with full supply', () => {
    const s = started();
    for (const code of Object.keys(STOCK_BY_CODE)) {
      expect(s.supply[code]).toBe(REGULAR_SUPPLY);
    }
  });

  it('all players start at position 1 with the default $30k cash', () => {
    const s = started(4);
    for (const p of s.players) {
      expect(p.pos).toBe(1);
      expect(p.cash).toBe(30_000);
      expect(p.margin).toBe(0);
      expect(Object.keys(p.shares)).toHaveLength(0);
    }
  });

  it.each([30_000, 40_000, 50_000])('starts every player with the selected $%i cash', (startCash) => {
    const r = rng(`cash-${startCash}`);
    let s = initialState(r);
    s = reduce(s, { t: 'setNum', n: 4 }, r);
    s = reduce(s, { t: 'setOpt', opt: { startCash } }, r);
    s = reduce(s, { t: 'startGame' }, r);
    expect(s.players.every((p) => p.cash === startCash)).toBe(true);
    expect(s.players.every((_, i) => getPlayerNetWorthMovement(i, s).direction === 'flat')).toBe(true);
  });

  it('phase is play after startGame', () => {
    expect(started().phase).toBe('play');
  });
});
