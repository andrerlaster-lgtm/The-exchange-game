import type { GameState } from './types';

/** Short, shared round/player label used by both the 2D and 3D boards. */
export function gameProgressLabel(s: GameState): string {
  const player = `Player ${s.cur + 1} of ${s.players.length}`;

  if (s.opts.closeMode !== 'rounds') return `Round ${s.lap} · ${player}`;

  if (s.lap > s.opts.closeRounds) {
    return `Extended Round ${s.lap - s.opts.closeRounds} · ${player}`;
  }

  return `Round ${s.lap} of ${s.opts.closeRounds} · ${player}`;
}
