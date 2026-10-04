// Store barrel — convenience selectors re-exported alongside the store.
export { useGameStore } from './gameStore';
export type { GameStore } from './gameStore';
export { useSettings } from './settingsStore';

import { useGameStore } from './gameStore';
import type { Action, GameState } from '../engine';

export const useGameState = (): GameState => useGameStore((s) => s.state);
export const useDispatch = (): ((a: Action) => void) => useGameStore((s) => s.dispatch);
