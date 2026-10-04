// Board tile theme — parchment ("light") or slate ("dark"). A view
// preference, not game state: it lives in the settings store (saved on this
// device), so the header toggle and the board agree without prop-drilling.

import { useSettings } from '../../store/settingsStore';
import type { BoardTheme } from '../../store/settingsStore';

export type { BoardTheme };
export const setBoardTheme = (theme: BoardTheme) => useSettings.getState().setBoardTheme(theme);
export const useBoardTheme = (): BoardTheme => useSettings((st) => st.boardTheme);

/** Every colour the board tiles differ on between the two themes. Sector,
    player and risk colours are deliberately NOT here — they are the point of
    the dark board, and stay exactly as they are on both. */
export interface BoardPalette {
  tile: string;          // regular company tile
  tileEtf: string;       // ETF tile
  tileSpecial: string;   // other special spaces
  ink: string;           // primary text on a tile
  inkSoft: string;       // secondary text
  letterpress: string;   // text shadow that fakes the pressed-in look
  vignette: string;
  edge: string;          // tile border when nothing else claims it
  keyline: string;       // inner hairline
  glowAlpha: string;     // suffix applied to sector colours for fills
  up: string;            // a rise, on a tile
  down: string;          // a fall
  flatText: string;      // no movement
  riskChip: Record<'Low' | 'Med' | 'High', string>;
}

export const BOARD_PALETTES: Record<BoardTheme, BoardPalette> = {
  light: {
    tile: '#f0e7d1',
    tileEtf: '#eddbb0',
    tileSpecial: '#e9dec3',
    ink: '#2b2016',
    inkSoft: '#6f5a38',
    letterpress: '1px 1px 0 rgba(255,250,235,0.7)',
    vignette: 'radial-gradient(circle at 50% 42%, rgba(255,255,255,0.05) 10%, rgba(60,40,20,0.10) 72%)',
    edge: 'rgba(43,32,22,0.22)',
    keyline: 'rgba(43,32,22,0.18)',
    glowAlpha: '22',
    up: '#1e7a4a',
    down: '#b03a2c',
    flatText: '#8a795e',
    riskChip: { Low: '#5f7a52', Med: '#9c6f1f', High: '#a83a2c' },
  },
  dark: {
    // Slate, warmed slightly so it sits with the walnut surround rather than
    // reading as a hole in the board.
    tile: '#1d1a15',
    tileEtf: '#221c13',
    tileSpecial: '#1a1713',
    ink: '#f2e8d2',
    inkSoft: '#b5a78c',
    letterpress: '0 1px 0 rgba(0,0,0,0.8)',
    vignette: 'radial-gradient(circle at 50% 38%, rgba(255,235,190,0.07) 10%, rgba(0,0,0,0.35) 78%)',
    edge: 'rgba(240,231,209,0.16)',
    keyline: 'rgba(240,231,209,0.12)',
    glowAlpha: '33',
    // Brightened so a rise or fall still reads at 6px on slate; the muted
    // greens and reds of the parchment board disappear against it.
    up: '#5fd39a',
    down: '#ff8c7a',
    flatText: '#a1937c',
    riskChip: { Low: '#4d6b41', Med: '#8a6119', High: '#9b3225' },
  },
};
