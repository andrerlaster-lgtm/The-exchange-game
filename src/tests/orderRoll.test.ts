// Turn order settles itself inside startGame (2026-09-20): every player's 2d6
// is rolled in the background, ties re-roll among just the tied players, the
// table is seated highest first, and play begins. Nobody clicks a roll.

import { describe, expect, it } from 'vitest';
import { initialState } from '../engine';
import { settleTurnOrder } from '../engine/actionResolver';
import { dispatch, patch, rng, scriptedRng } from './helpers';

function setup(numPlayers: number) {
  const r = rng();
  let s = initialState(r);
  s = dispatch(s, { t: 'setNum', n: numPlayers }, r);
  return dispatch(s, { t: 'startGame' }, r);
}

describe('Turn order settles on startGame', () => {
  it('goes straight to play, with nothing left to roll', () => {
    const s = setup(3);
    expect(s.phase).toBe('play');
    expect(s.orderRoll).toBeNull();
    expect(s.cur).toBe(0);
    expect(s.turnPhase).toBe('preRoll');
  });

  it('seats the table highest roll first', () => {
    const s = setup(3);
    const namesBefore = s.players.map((p) => p.name);
    // p0: 1+2=3, p1: 6+6=12, p2: 4+3=7 → p1, p2, p0.
    const seated = patch(s, (d) => { settleTurnOrder(d, scriptedRng([1, 2, 6, 6, 4, 3])); });
    expect(seated.players.map((p) => p.name)).toEqual([namesBefore[1], namesBefore[2], namesBefore[0]]);
    expect(seated.phase).toBe('play');
  });

  it('re-rolls only the tied players, and keeps everyone else where they are', () => {
    const s = setup(3);
    const namesBefore = s.players.map((p) => p.name);
    // Round 1 — p0: 2+3=5, p1: 1+4=5 (tie), p2: 6+6=12.
    // Round 2 — only p0 and p1 roll again: p0: 4+5=9, p1: 1+3=4.
    // Final order: p2 (12), p0 (9), p1 (4).
    const seated = patch(s, (d) => {
      settleTurnOrder(d, scriptedRng([2, 3, 1, 4, 6, 6, 4, 5, 1, 3]));
    });
    expect(seated.players.map((p) => p.name)).toEqual([namesBefore[2], namesBefore[0], namesBefore[1]]);
    expect(seated.log.some((l) => /Tie — .* roll again/.test(l.text))).toBe(true);
  });

  it('records every roll in the log, so the order can be read back', () => {
    const s = setup(4);
    const rollLines = s.log.filter((l) => /rolls \d+ for turn order/.test(l.text));
    expect(rollLines.length).toBeGreaterThanOrEqual(4);
    expect(s.log.some((l) => /Market open\. .* starts\./.test(l.text))).toBe(true);
  });

  it('never loops on dice that always tie — it just seats the table', () => {
    const s = setup(2);
    // scriptedRng runs out immediately and then returns 0 forever, so every
    // re-roll ties again; the limit has to end it.
    const seated = patch(s, (d) => { settleTurnOrder(d, scriptedRng([])); });
    expect(seated.phase).toBe('play');
    expect(seated.players).toHaveLength(2);
  });
});
