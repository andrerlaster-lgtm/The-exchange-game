// Device preferences — sound, board tiles and computer-player speed. Not game
// state: none of this is part of a saved game or synced to the 3D board.
// Zustand's persist middleware keeps it in localStorage on this device.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type BoardTheme = 'light' | 'dark';
export type BotSpeed = 'normal' | 'fast';

export interface Settings {
  muted: boolean;
  volume: number;
  boardTheme: BoardTheme;
  botSpeed: BotSpeed;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  setBoardTheme: (theme: BoardTheme) => void;
  setBotSpeed: (speed: BotSpeed) => void;
}

/** Preferences saved before 2026-10-04 lived under three separate keys; read
    them once so nobody loses their choices in the switch. */
function legacyDefaults(): Pick<Settings, 'muted' | 'volume' | 'boardTheme' | 'botSpeed'> {
  const d = { muted: false, volume: 0.7, boardTheme: 'light' as BoardTheme, botSpeed: 'normal' as BotSpeed };
  try {
    const sound = JSON.parse(localStorage.getItem('exchange-sound-v1') ?? 'null');
    if (sound && typeof sound.muted === 'boolean') d.muted = sound.muted;
    if (sound && typeof sound.volume === 'number') d.volume = Math.min(1, Math.max(0, sound.volume));
    if (localStorage.getItem('exchange.boardTheme') === 'dark') d.boardTheme = 'dark';
    if (localStorage.getItem('exchange-bot-speed-v1') === 'fast') d.botSpeed = 'fast';
  } catch { /* storage blocked: defaults */ }
  return d;
}

/** localStorage, or a throwaway stand-in where there is none (tests, blocked storage). */
export const deviceStorage = () => {
  try { if (typeof localStorage !== 'undefined') { localStorage.getItem('x'); return localStorage; } } catch { /* blocked */ }
  const mem = new Map<string, string>();
  return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } };
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      ...legacyDefaults(),
      setMuted: (muted) => set({ muted }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setBoardTheme: (boardTheme) => set({ boardTheme }),
      setBotSpeed: (botSpeed) => set({ botSpeed }),
    }),
    {
      name: 'exchange-settings-v1',
      storage: createJSONStorage(deviceStorage),
      partialize: ({ muted, volume, boardTheme, botSpeed }) => ({ muted, volume, boardTheme, botSpeed }),
    },
  ),
);
