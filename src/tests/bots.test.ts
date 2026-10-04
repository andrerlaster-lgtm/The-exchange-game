import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '../engine';
import type { GameState } from '../engine';
import { makeRng } from '../utils/rng';
import { botAction, botTurn, decisionOwner } from '../ai/controller';
import { useGameStore } from '../store';

function setupGame(bots: ('normal' | 'cash' | 'investor' | null)[], seed = 7): GameState {
  const rng = makeRng(seed);
  let s = initialState(rng);
  s = reduce(s, { t: 'setNum', n: bots.length }, rng);
  bots.forEach((style, i) => { s = reduce(s, { t: 'setBot', i, style }, rng); });
  s = reduce(s, { t: 'startGame' }, rng);
  return s;
}

describe('computer players', () => {
  it('carries the chosen style onto each player', () => {
    const s = setupGame(['investor', null, 'cash']);
    const styles = s.players.map((p) => p.bot ?? null).sort();
    expect(styles).toEqual(['cash', 'investor', null].sort());
  });

  it('an all-computer table keeps playing without stalling', () => {
    const rng = makeRng(11);
    const botRng = makeRng(12);
    let s = setupGame(['normal', 'cash', 'investor'], 11);
    let actions = 0;
    const startLap = s.lap;
    for (; actions < 4000 && s.phase === 'play'; actions += 1) {
      const a = botAction(s, botRng);
      expect(a, `bot had no move at action ${actions}`).not.toBeNull();
      const next = reduce(s, a!, rng);
      expect(next, `engine rejected ${a!.t} at action ${actions}`).not.toBe(s);
      s = next;
    }
    expect(s.lap).toBeGreaterThan(startLap + 1);
  });

  it('hands control back to a human and ignores human input during a computer turn', () => {
    const rng = makeRng(5);
    const botRng = makeRng(6);
    let s = setupGame(['normal', null], 5);
    // Play computer moves until the human owns the decision.
    for (let i = 0; i < 500 && botTurn(s); i += 1) s = reduce(s, botAction(s, botRng)!, rng);
    expect(botTurn(s)).toBe(false);
    expect(s.players[decisionOwner(s)!].bot ?? null).toBeNull();

    // Store-level guard: while a computer owns the decision, dispatch is a no-op.
    let botState = setupGame(['normal', null], 5);
    for (let i = 0; i < 500 && !botTurn(botState); i += 1) {
      const owner = decisionOwner(botState)!;
      // Let the human end their turn quickly by playing the bot policy for them too.
      botState = reduce(botState, { ...botAction({ ...botState, players: botState.players.map((p, j) => (j === owner ? { ...p, bot: 'normal' } : p)) }, botRng)! }, rng);
    }
    expect(botTurn(botState)).toBe(true);
    useGameStore.setState({ state: botState });
    useGameStore.getState().dispatch({ t: 'roll' });
    expect(useGameStore.getState().state).toBe(botState);
  });
});
