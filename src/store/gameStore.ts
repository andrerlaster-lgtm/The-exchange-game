// Zustand store — wraps the pure engine reducer with a seeded RNG.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { initialState, reduce } from '../engine';
import { makeRng } from '../utils/rng';
import type { Action, GameState } from '../engine';

export interface GameStore {
  state: GameState;
  dispatch: (a: Action) => void;
  resetRng: () => void;
}

let rng = makeRng(Date.now());

export const useGameStore = create<GameStore>()(
  immer((set) => ({
    state: initialState(rng),

    dispatch: (a: Action) =>
      set((store) => {
        store.state = reduce(store.state, a, rng) as typeof store.state;
      }),

    resetRng: () => {
      rng = makeRng(Date.now());
      set((store) => {
        store.state = initialState(rng) as typeof store.state;
      });
    },
  })),
);
