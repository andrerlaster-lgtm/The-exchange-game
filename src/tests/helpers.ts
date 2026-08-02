// Test helpers: deterministic state construction and dispatch.

import { initialState, reduce } from '../engine';
import type { Action, GameState } from '../engine';
import { makeRng } from '../utils/rng';
import type { Rng } from '../utils/rng';

export function rng(seed = 'test'): Rng {
  return makeRng(seed);
}

export function scriptedRng(ints: number[]): Rng {
  let i = 0;
  return {
    next: () => 0,
    int: () => (i < ints.length ? ints[i++] : 0),
    shuffle: <T,>(arr: readonly T[]) => arr.slice(),
  };
}

export function started(numPlayers = 4, r: Rng = rng()): GameState {
  let s = initialState(r);
  s = reduce(s, { t: 'setNum', n: numPlayers }, r);
  s = reduce(s, { t: 'startGame' }, r);
  return s;
}

export function dispatch(s: GameState, a: Action, r: Rng): GameState {
  return reduce(s, a, r);
}

export function patch(s: GameState, fn: (d: GameState) => void): GameState {
  const clone: GameState = structuredClone(s);
  fn(clone);
  return clone;
}

export function rollTo(s: GameState, targetSpace: number): GameState {
  if (targetSpace < 4) throw new Error('use targetSpace >= 4 to avoid Market Open pass');
  const a = 1;
  const b = targetSpace - (targetSpace - 2) - 1;
  const fromPos = targetSpace - (a + b);
  const r = scriptedRng([a, b]);
  const placed = patch(s, (d) => { d.players[d.cur].pos = fromPos; });
  return reduce(placed, { t: 'roll' }, r);
}
