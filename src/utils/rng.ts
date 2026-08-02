// Seeded pseudo-random number generator (Mulberry32).
// No external dependencies. Injected into the engine so behavior is deterministic.

export interface Rng {
  next(): number;                           // float in [0, 1)
  int(min: number, max: number): number;    // inclusive integer in [min, max]
  shuffle<T>(arr: readonly T[]): T[];       // returns new shuffled array
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h >>> 0;
}

export function makeRng(seed: string | number = Date.now()): Rng {
  let state = typeof seed === 'string' ? hash(seed) : seed >>> 0;

  function next(): number {
    state = (state + 0x6D2B79F5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    shuffle: <T,>(arr: readonly T[]): T[] => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}
