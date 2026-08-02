import { describe, expect, it } from 'vitest';
import { dispatch, rng, scriptedRng, started } from './helpers';

describe('doubles bonus roll', () => {
  it('earns exactly one bonus roll for the same player after resolving the landing', () => {
    let s = started(2);

    s = dispatch(s, { t: 'roll' }, scriptedRng([6, 6]));
    expect(s.dice).toEqual([6, 6]);
    expect(s.players[0].pos).toBe(13);
    expect(s.bonusRollPending).toBe(true);
    expect(s.bonusRollUsed).toBe(true);

    // The Income Fund's buy-or-skip prompt still blocks the bonus roll.
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(0);
    expect(s.turnPhase).toBe('acted');

    s = dispatch(s, { t: 'skipEtf' }, rng());
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(0);
    expect(s.turnPhase).toBe('preRoll');
    expect(s.dice).toEqual([null, null]);
    expect(s.bonusRollPending).toBe(false);
    expect(s.bonusRollUsed).toBe(true);
  });

  it('does not chain when the bonus roll is also doubles', () => {
    let s = started(2);
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    s = dispatch(s, { t: 'skipStock', code: 'MEDI' }, rng());
    s = dispatch(s, { t: 'endTurn' }, rng());

    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));
    expect(s.players[0].pos).toBe(9);
    expect(s.bonusRollPending).toBe(false);
    expect(s.bonusRollUsed).toBe(true);

    s = dispatch(s, { t: 'skipStock', code: 'MTRO' }, rng());
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(1);
    expect(s.turnPhase).toBe('preRoll');
    expect(s.bonusRollUsed).toBe(false);
  });

  it('passes to the next player normally after a non-doubles roll', () => {
    let s = started(2);
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 3]));
    expect(s.players[0].pos).toBe(6);
    expect(s.bonusRollPending).toBe(false);

    s = dispatch(s, { t: 'skipStock', code: 'OILW' }, rng());
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(1);
    expect(s.bonusRollUsed).toBe(false);
  });

  it('recognizes double sixes as doubles', () => {
    let s = started(2);
    s = dispatch(s, { t: 'roll' }, scriptedRng([6, 6]));

    expect(s.dice).toEqual([6, 6]);
    expect(s.bonusRollPending).toBe(true);
    expect(s.bonusRollUsed).toBe(true);
  });
});
