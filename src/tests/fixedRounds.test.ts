import { describe, expect, it } from 'vitest';
import { gameProgressLabel, initialState } from '../engine';
import type { GameState } from '../engine';
import { dispatch, patch, rng, started } from './helpers';

function finishFixedGame(numPlayers: number, rounds: number, extendedHours = false): { state: GameState; turns: number } {
  const setupRng = rng(`setup-${numPlayers}-${rounds}`);
  let state = initialState(setupRng);
  state = dispatch(state, { t: 'setNum', n: numPlayers }, setupRng);
  state = dispatch(state, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: rounds } }, setupRng);
  state = dispatch(state, { t: 'startGame' }, setupRng);
  if (extendedHours) state = patch(state, (draft) => { draft.extendedHoursAvailable = true; });
  let turns = 0;

  while (state.phase === 'play' && turns < numPlayers * (rounds + 3)) {
    state = patch(state, (draft) => { draft.turnPhase = 'acted'; });
    state = dispatch(state, { t: 'endTurn' }, rng(`turn-${turns}`));
    turns += 1;
  }

  return { state, turns };
}

describe('fixed-round games', () => {
  it('supports a one-round configuration without adding a second round', () => {
    const { state, turns } = finishFixedGame(2, 1);

    expect(turns).toBe(2);
    expect(state.lap).toBe(1);
  });

  it.each([2, 4, 6])('ends a five-round %i-player game after exactly five complete rounds', (numPlayers) => {
    const { state, turns } = finishFixedGame(numPlayers, 5);

    expect(state.phase).toBe('over');
    expect(turns).toBe(numPlayers * 5);
    expect(state.lap).toBe(5);
  });

  it('adds exactly one complete round when Extended Hours is banked', () => {
    const { state, turns } = finishFixedGame(4, 5, true);

    expect(state.phase).toBe('over');
    expect(turns).toBe(4 * 6);
    expect(state.lap).toBe(6);
  });
});

describe('game progress label', () => {
  it('shows round and player progress for fixed games', () => {
    const state = patch(started(4), (draft) => {
      draft.opts.closeMode = 'rounds';
      draft.opts.closeRounds = 5;
      draft.lap = 3;
      draft.cur = 1;
    });

    expect(gameProgressLabel(state)).toBe('Round 3 of 5 · Player 2 of 4');
  });

  it('labels a round beyond the configured limit as Extended Hours', () => {
    const state = patch(started(2), (draft) => {
      draft.opts.closeMode = 'rounds';
      draft.opts.closeRounds = 5;
      draft.lap = 6;
    });

    expect(gameProgressLabel(state)).toBe('Extended Round 1 · Player 1 of 2');
  });

  it('shows the current round without a false limit in Market Close card mode', () => {
    const state = patch(started(3), (draft) => {
      draft.opts.closeMode = 'card';
      draft.lap = 4;
      draft.cur = 2;
    });

    expect(gameProgressLabel(state)).toBe('Round 4 · Player 3 of 3');
  });
});
