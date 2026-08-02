// Seeded, deterministic RNG — no external dependency (mulberry32 + string hash).
// All randomness in the engine (dice, deck shuffles) MUST route through this so games
// are reproducible and tests are not flaky.

export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** Fisher–Yates shuffle; returns a new array, does not mutate input */
  shuffle<T>(arr: readonly T[]): T[];
}

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function makeRng(seed: string | number = Date.now()): Rng {
  let a = hashSeed(seed);
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number =>
    min + Math.floor(next() * (max - min + 1));
  const shuffle = <T,>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, shuffle };
}
