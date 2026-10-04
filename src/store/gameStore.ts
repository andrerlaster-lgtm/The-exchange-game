// Zustand store — wraps the pure engine reducer with a seeded RNG.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { initialState, reduce } from '../engine';
import { makeRng } from '../utils/rng';
import { soundForAction } from '../audio/sound';
import { botAction, botTurn } from '../ai/controller';
import type { Action, GameState } from '../engine';

export interface GameStore {
  state: GameState;
  /** Human input. Ignored while a computer player owns the current decision. */
  dispatch: (a: Action) => void;
  /** Play the computer player's next action; returns false if it had nothing to do. */
  botStep: () => boolean;
  resetRng: () => void;
}

let rng = makeRng(Date.now());
// Computer players' choices use their own random stream so they never shift the dice.
let botRng = makeRng(Date.now() ^ 0x5bd1e995);

export const useGameStore = create<GameStore>()(
  immer((set, get) => {
    const apply = (a: Action) => {
      const before = get().state;
      set((store) => {
        store.state = reduce(store.state, a, rng) as typeof store.state;
      });
      soundForAction(a, before, get().state);
    };
    return {
      state: initialState(rng),

      dispatch: (a: Action) => {
        if (botTurn(get().state)) return;
        apply(a);
      },

      botStep: () => {
        const s = get().state;
        const a = botAction(s, botRng);
        if (!a) return false;
        apply(a);
        return get().state !== s;
      },

      resetRng: () => {
        rng = makeRng(Date.now());
        botRng = makeRng(Date.now() ^ 0x5bd1e995);
        set((store) => {
          store.state = initialState(rng) as typeof store.state;
        });
      },
    };
  }),
);
