// Motion staging (GSAP). The engine resolves a whole move in one step: the
// dice, the piece's new space, the card and the money all change at once.
// This module turns that into a sequence a person can follow — dice tumble,
// the piece hops space by space, then the card, buy panel, coins and number
// changes arrive. The store calls stageForAction() for every action; it
// announces the roll and the hops, and "holds the stage" until the piece
// lands. Overlays wait with useStageHeld(), number tweens and sounds start
// after stageDelayMs(), and computer players wait before their next move.
//
// Players who ask their system for reduced motion get no staging at all.

import { useSyncExternalStore } from 'react';
import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { BOARD_SIZE } from '../data';
import type { Action, GameState } from '../engine';

gsap.registerPlugin(Flip, SplitText);
export { gsap, Flip, SplitText };

export const DICE_MS = 700;
export const HOP_MS = 180;

export function reducedMotion(): boolean {
  return typeof window === 'undefined' || !window.matchMedia
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ---------- The hold: consequences wait until the piece lands ----------
let holdUntil = 0;
let held = false;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
const heldListeners = new Set<() => void>();
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function hold(ms: number) {
  if (ms <= 0) return;
  holdUntil = Math.max(holdUntil, now() + ms);
  held = true;
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => { held = false; heldListeners.forEach((l) => l()); }, holdUntil - now());
  heldListeners.forEach((l) => l());
}

/** Milliseconds until the current move has finished playing out (0 when idle). */
export function stageDelayMs(): number {
  return Math.max(0, holdUntil - now());
}

/** True while a move is still playing out; components re-render when it ends. */
export function useStageHeld(): boolean {
  return useSyncExternalStore(
    (fn) => { heldListeners.add(fn); return () => { heldListeners.delete(fn); }; },
    () => held,
    () => false,
  );
}

// ---------- Announcements: dice rolls and piece hops ----------
export interface Hop { id: number; player: number; path: number[]; startDelayMs: number }
let hopId = 0;
const rollListeners = new Set<() => void>();
const hopListeners = new Set<(hop: Hop) => void>();
const beforeListeners = new Set<() => void>();

export function onRoll(fn: () => void) { rollListeners.add(fn); return () => { rollListeners.delete(fn); }; }
export function onHop(fn: (hop: Hop) => void) { hopListeners.add(fn); return () => { hopListeners.delete(fn); }; }
/** Called just before the game state changes — the moment to record layouts for Flip. */
export function onBeforeChange(fn: () => void) { beforeListeners.add(fn); return () => { beforeListeners.delete(fn); }; }
export function beforeChange() { beforeListeners.forEach((fn) => { try { fn(); } catch { /* layout capture is best-effort */ } }); }

/** Spaces a piece passes through, start and end included. Short moves step
    space by space (forwards, or backwards for "go back" cards); anything
    else glides straight there. */
export function pathBetween(from: number, to: number): number[] {
  const fwd = (to - from + BOARD_SIZE) % BOARD_SIZE;
  const back = (from - to + BOARD_SIZE) % BOARD_SIZE;
  const wrap = (n: number) => ((n - 1 + BOARD_SIZE) % BOARD_SIZE) + 1;
  if (fwd >= 1 && fwd <= 14) return Array.from({ length: fwd + 1 }, (_, k) => wrap(from + k));
  if (back >= 1 && back <= 5) return Array.from({ length: back + 1 }, (_, k) => wrap(from - k));
  return [from, to];
}

/** Announce what this action looks like and hold the stage until it has
    played out. Returns how long (seconds) its consequences should wait. */
export function stageForAction(a: Action, before: GameState, after: GameState): number {
  if (reducedMotion() || before.phase !== 'play' || after.phase !== 'play') return 0;
  let start = 0;
  if (a.t === 'roll') {
    rollListeners.forEach((fn) => fn());
    start = DICE_MS;
  }
  let total = start;
  after.players.forEach((p, i) => {
    const from = before.players[i]?.pos;
    if (from == null || from === p.pos) return;
    const path = pathBetween(from, p.pos);
    hopId += 1;
    const hop: Hop = { id: hopId, player: i, path, startDelayMs: start };
    hopListeners.forEach((fn) => fn(hop));
    total = Math.max(total, start + (path.length - 1) * HOP_MS + 160);
  });
  hold(total);
  return total / 1000;
}
