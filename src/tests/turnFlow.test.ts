// Rule 10 — Market Close: finish the current round, then final scores.

import { describe, expect, it } from 'vitest';
import { dispatch, patch, rng, started } from './helpers';

describe('Rule 10 — Market Close', () => {
  it('drawing Market Close always triggers a full-round finish (no immediate end)', () => {
    let s = started(3);
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'callClose' }, rng());
    // Must finish the round — not over yet.
    expect(s.phase).toBe('play');
    expect(s.closing).toBe(true);
    expect(s.closeDrawer).toBe(0);
  });

  it('game ends after all remaining players take their final turn', () => {
    let s = started(3);
    // Player 0 draws close during their turn.
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'callClose' }, rng());
    expect(s.phase).toBe('play');

    // Player 1 takes their turn.
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.phase).toBe('play');

    // Player 2 takes their turn.
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.phase).toBe('play');

    // Player 0's turn would wrap back — game ends.
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.phase).toBe('over');
  });

  it('Market Close mid-round lets players 2+ still take their turn before game ends', () => {
    let s = started(4);
    // Player 1 triggers close.
    s = patch(s, (d) => { d.cur = 1; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'callClose' }, rng());
    expect(s.closing).toBe(true);
    expect(s.closeDrawer).toBe(1);

    // Players 2 and 3 still get turns.
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → player 2
    expect(s.phase).toBe('play');
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → player 3
    expect(s.phase).toBe('play');
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → player 0
    expect(s.phase).toBe('play');
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → next would be player 1 === closeDrawer → over
    expect(s.phase).toBe('over');
  });
});
