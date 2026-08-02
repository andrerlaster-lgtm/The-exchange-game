// Store barrel — convenience selectors re-exported alongside the store.
export { useGameStore } from './gameStore';
export type { GameStore } from './gameStore';

import { useGameStore } from './gameStore';
import type { Action, GameState } from '../engine';

export const useGameState = (): GameState => useGameStore((s) => s.state);
export const useDispatch = (): ((a: Action) => void) => useGameStore((s) => s.dispatch);
export const useCurPlayer = () => useGameStore((s) => s.state.players[s.state.cur]);
export const usePlayer = (i: number) => useGameStore((s) => s.state.players[i]);
