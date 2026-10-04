// Zustand store — wraps the pure engine reducer with a seeded RNG.
//
// Save and resume: the game is saved on this device after every move (Zustand's
// persist middleware, localStorage) together with both random streams, so a
// reload carries on exactly where it left off — same dice to come.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { initialState, reduce } from '../engine';
import { makeRng } from '../utils/rng';
import { soundForAction } from '../audio/sound';
import { beforeChange, stageForAction } from '../anim/stage';
import { botAction, botTurn } from '../ai/controller';
import { deviceStorage } from './settingsStore';
import type { Action, GameState } from '../engine';

export interface GameStore {
  state: GameState;
  /** Human input. Ignored while a computer player owns the current decision. */
  dispatch: (a: Action) => void;
  /** Play the computer player's next action; returns false if it had nothing to do. */
  botStep: () => boolean;
  /** Leave the current game for the setup screen, even mid-way through a computer's turn. */
  newGame: () => void;
  resetRng: () => void;
}

/** Bump when GameState changes shape in a way old saves can't be read as. */
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'exchange-save-v1';

let rng = makeRng(Date.now());
// Computer players' choices use their own random stream so they never shift the dice.
let botRng = makeRng(Date.now() ^ 0x5bd1e995);

interface Saved { state: GameState; rng: number; botRng: number }

/** Only accept a save that looks like a game this version can run. */
function readable(saved: unknown): saved is Saved {
  const v = saved as Partial<Saved> | null;
  return !!v && typeof v.rng === 'number' && typeof v.botRng === 'number'
    && !!v.state && typeof v.state.phase === 'string' && Array.isArray(v.state.players) && v.state.players.length > 0;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      const apply = (a: Action) => {
        const before = get().state;
        const next = reduce(before, a, rng);
        if (next === before) { soundForAction(a, before, next); return; }
        // Tell the motion layer first: it records layouts for Flip, starts the
        // dice and piece hops, and says how long the move's results should wait.
        beforeChange();
        const wait = stageForAction(a, before, next);
        set({ state: next });
        soundForAction(a, before, next, wait);
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

        newGame: () => apply({ t: 'newGame' }),

        resetRng: () => {
          rng = makeRng(Date.now());
          botRng = makeRng(Date.now() ^ 0x5bd1e995);
          set({ state: initialState(rng) });
        },
      };
    },
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(deviceStorage),
      partialize: (st) => ({ state: st.state, rng: rng.state?.() ?? 0, botRng: botRng.state?.() ?? 0 }),
      // A save from an older, incompatible version is dropped (fresh game).
      migrate: () => undefined as unknown as Saved,
      merge: (persisted, current) => {
        if (!readable(persisted)) return current;
        rng = makeRng(persisted.rng);
        botRng = makeRng(persisted.botRng);
        return { ...current, state: persisted.state };
      },
    },
  ),
);
