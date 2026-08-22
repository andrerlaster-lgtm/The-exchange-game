// Pre-game "roll for order" ceremony: startGame lands in phase 'orderRoll'
// instead of 'play'; players roll 2d6 one at a time; ties re-roll among just
// the tied players; finishOrderRoll reorders players highest-to-lowest and
// starts play.

import { describe, expect, it } from 'vitest';
import { initialState } from '../engine';
import { dispatch, rng, scriptedRng } from './helpers';

// setNum/startGame consume the shared rng internally (deck shuffling), so
// setup uses a plain rng and every test scripts its own separate rng just
// for the rollForOrder dice it cares about — same pattern as resolveOrderRoll.
function setup(numPlayers: number) {
  const r = rng();
  let s = initialState(r);
  s = dispatch(s, { t: 'setNum', n: numPlayers }, r);
  s = dispatch(s, { t: 'startGame' }, r);
  return s;
}

describe('Roll for turn order', () => {
  it('enters phase "orderRoll" after startGame, one pending roll per player', () => {
    const s = setup(3);
    expect(s.phase).toBe('orderRoll');
    expect(s.orderRoll).toEqual({ rolls: [null, null, null], pending: [0, 1, 2] });
  });

  it('rolls one player at a time, recording the 2d6 sum and advancing pending', () => {
    let s = setup(2);
    const r = scriptedRng([6, 6, 3, 2]); // p0: 6+6=12, p1: 3+2=5

    s = dispatch(s, { t: 'rollForOrder' }, r);
    expect(s.orderRoll?.rolls[0]).toBe(12);
    expect(s.orderRoll?.pending).toEqual([1]);

    s = dispatch(s, { t: 'rollForOrder' }, r);
    expect(s.orderRoll?.rolls[1]).toBe(5);
    expect(s.orderRoll?.pending).toEqual([]);
  });

  it('finishOrderRoll reorders players highest-to-lowest and starts play', () => {
    let s = setup(3);
    const r = scriptedRng([2, 1, 6, 6, 4, 3]); // p0: 3, p1: 12, p2: 7
    s = dispatch(s, { t: 'rollForOrder' }, r);
    s = dispatch(s, { t: 'rollForOrder' }, r);
    s = dispatch(s, { t: 'rollForOrder' }, r);
    expect(s.orderRoll?.pending).toEqual([]);

    const namesBefore = s.players.map((p) => p.name);
    s = dispatch(s, { t: 'finishOrderRoll' }, r);

    expect(s.phase).toBe('play');
    expect(s.orderRoll).toBeNull();
    expect(s.cur).toBe(0);
    expect(s.turnPhase).toBe('preRoll');
    expect(s.players.map((p) => p.name)).toEqual([namesBefore[1], namesBefore[2], namesBefore[0]]);
  });

  it('a tie re-rolls only the tied players; everyone else stays locked in', () => {
    let s = setup(3);
    // Round 1 — p0: 4+3=7, p1: 5+2=7 (tie), p2: 1+2=3.
    // Round 2 (only p0 and p1 roll again) — p0: 2+2=4, p1: 6+6=12.
    const r = scriptedRng([4, 3, 5, 2, 1, 2, 2, 2, 6, 6]);

    s = dispatch(s, { t: 'rollForOrder' }, r); // p0 -> 7
    s = dispatch(s, { t: 'rollForOrder' }, r); // p1 -> 7
    s = dispatch(s, { t: 'rollForOrder' }, r); // p2 -> 3, round complete, tie detected, p0/p1 requeued
    expect(s.orderRoll?.pending).toEqual([0, 1]);
    expect(s.orderRoll?.rolls).toEqual([null, null, 3]);
    expect(s.log.some((l) => /tie/i.test(l.text))).toBe(true);

    s = dispatch(s, { t: 'rollForOrder' }, r); // p0 re-rolls -> 4
    s = dispatch(s, { t: 'rollForOrder' }, r); // p1 re-rolls -> 12, no more ties
    expect(s.orderRoll?.rolls).toEqual([4, 12, 3]);
    expect(s.orderRoll?.pending).toEqual([]);

    const namesBefore = s.players.map((p) => p.name);
    s = dispatch(s, { t: 'finishOrderRoll' }, r);
    expect(s.players.map((p) => p.name)).toEqual([namesBefore[1], namesBefore[0], namesBefore[2]]);
  });

  it('finishOrderRoll is a no-op while rolls are still pending', () => {
    let s = setup(2);
    const r = scriptedRng([6, 6]);
    s = dispatch(s, { t: 'rollForOrder' }, r); // only p0 has rolled; p1 still pending
    s = dispatch(s, { t: 'finishOrderRoll' }, r);
    expect(s.phase).toBe('orderRoll');
    expect(s.orderRoll?.pending).toEqual([1]);
  });

  it('rollForOrder is a no-op once the ceremony is over', () => {
    let s = setup(2);
    const r = scriptedRng([6, 6, 5, 5]);
    s = dispatch(s, { t: 'rollForOrder' }, r);
    s = dispatch(s, { t: 'rollForOrder' }, r);
    s = dispatch(s, { t: 'finishOrderRoll' }, r);
    const before = s;
    s = dispatch(s, { t: 'rollForOrder' }, r);
    expect(s).toEqual(before);
  });
});
