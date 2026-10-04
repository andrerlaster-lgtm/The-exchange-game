import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../engine';
import type { GameState } from '../engine';
import { makeRng } from '../utils/rng';
import { botAction } from '../ai/controller';

function allComputerGame(seed: number): GameState {
  const rng = makeRng(seed);
  let s = initialState(rng);
  s = reduce(s, { t: 'setNum', n: 3 }, rng);
  (['normal', 'cash', 'investor'] as const).forEach((style, i) => { s = reduce(s, { t: 'setBot', i, style }, rng); });
  return reduce(s, { t: 'startGame' }, rng);
}

describe('save and resume', () => {
  it('a random stream restored from its saved position continues the same sequence', () => {
    const a = makeRng(42);
    for (let i = 0; i < 17; i += 1) a.next();
    const b = makeRng(a.state!());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(Array.from({ length: 20 }, () => a.next()));
  });

  it('a game saved mid-way and loaded back plays on exactly as if never saved', () => {
    let rng = makeRng(9), botRng = makeRng(10);
    let s = allComputerGame(9);
    for (let i = 0; i < 600 && s.phase === 'play'; i += 1) s = reduce(s, botAction(s, botRng)!, rng);

    // Save: JSON, as localStorage stores it.
    const saved = JSON.parse(JSON.stringify({ state: s, rng: rng.state!(), botRng: botRng.state!() }));
    // (Compared as JSON: saving turns -0 into 0, which is the same game.)
    expect(JSON.stringify(saved.state)).toBe(JSON.stringify(s));

    // Keep playing the original…
    let original = s;
    for (let i = 0; i < 400 && original.phase === 'play'; i += 1) original = reduce(original, botAction(original, botRng)!, rng);
    // …and the loaded copy, from its own restored streams.
    const rng2 = makeRng(saved.rng), botRng2 = makeRng(saved.botRng);
    let loaded: GameState = saved.state;
    for (let i = 0; i < 400 && loaded.phase === 'play'; i += 1) loaded = reduce(loaded, botAction(loaded, botRng2)!, rng2);

    expect(JSON.stringify(loaded)).toBe(JSON.stringify(original));
    expect(original.lap).toBeGreaterThan(s.lap);
  });
});
