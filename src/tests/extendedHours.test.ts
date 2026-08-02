// Phase 9: Extended Hours — drawing the card banks a 1-round Market Close
// extension; once Market Close actually triggers, everyone gets exactly one
// additional round before the game ends (rulebook §20).

import { describe, expect, it } from 'vitest';
import { CARDS } from '../data';
import { dispatch, patch, rng, started } from './helpers';

const ME_IDX = CARDS.ME.findIndex((c) => c.title === 'Extended Hours');

function drawExtendedHours(s: ReturnType<typeof started>) {
  const withDraw = patch(s, (d) => {
    d.pendingDraws = ['ME'];
    d.decks.ME = [ME_IDX, ...d.decks.ME.filter((i) => i !== ME_IDX)];
  });
  return dispatch(withDraw, { t: 'draw', deck: 'ME' }, rng());
}

describe('Extended Hours — banking the extension', () => {
  it('drawing the card banks an available extension', () => {
    let s = started(2);
    s = drawExtendedHours(s);
    expect(s.extendedHoursAvailable).toBe(true);
    expect(s.log.some((l) => /banks Extended Hours/i.test(l.text))).toBe(true);
  });

  it('is a no-op if drawn after Market Close has already been called', () => {
    let s = started(2);
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'callClose' }, rng());
    expect(s.closing).toBe(true);
    s = drawExtendedHours(s);
    expect(s.extendedHoursAvailable).toBe(false);
    expect(s.log.some((l) => /too late/i.test(l.text))).toBe(true);
  });
});

describe('Extended Hours — extends Market Close by exactly 1 round', () => {
  it('without Extended Hours, Market Close ends the game after everyone else takes one final turn', () => {
    let s = started(3);
    s = patch(s, (d) => { d.cur = 0; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'callClose' }, rng());
    expect(s.closeDrawer).toBe(0);

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // player 1's final turn
    expect(s.phase).toBe('play');
    expect(s.cur).toBe(1);

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // player 2's final turn
    expect(s.phase).toBe('play');
    expect(s.cur).toBe(2);

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // would wrap back to player 0 (closeDrawer) — game ends
    expect(s.phase).toBe('over');
  });

  it('with Extended Hours banked, every player gets one additional full round first', () => {
    let s = started(3);
    s = drawExtendedHours(s);
    expect(s.extendedHoursAvailable).toBe(true);

    s = patch(s, (d) => { d.cur = 0; d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'callClose' }, rng());
    expect(s.closeDrawer).toBe(0);
    expect(s.extendedHoursAvailable).toBe(false); // consumed
    expect(s.extendedRoundsLeft).toBe(1);

    // First pass: players 1, 2, then back to 0 — normally this would end the
    // game, but the extra round means it continues instead.
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → player 1
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → player 2
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → back to player 0 — extended round consumed, not over
    expect(s.phase).toBe('play');
    expect(s.cur).toBe(0);
    expect(s.extendedRoundsLeft).toBe(0);

    // Second pass: same cycle again — this time it actually ends.
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → player 1
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → player 2
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // → would wrap to player 0 — game ends
    expect(s.phase).toBe('over');
  });
});

describe('Standard mode defaults (rulebook §21)', () => {
  it('margin trading and short selling are off by default', () => {
    const s = started(2);
    expect(s.opts.margin).toBe(false);
    expect(s.opts.shorts).toBe(false);
  });
});
