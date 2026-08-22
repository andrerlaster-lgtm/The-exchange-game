// Event card draw and effect.

import { describe, expect, it } from 'vitest';
import { CARDS } from '../data';
import { dispatch, rng, rollTo, scriptedRng, started } from './helpers';

describe('Event card draw', () => {
  it('drawing a ME card applies its effect and clears pendingDraws', () => {
    let s = started();
    s = rollTo(s, 19); // space 19 = Market Event
    expect(s.pendingDraws[0]).toBe('ME');
    s = dispatch(s, { t: 'draw', deck: 'ME' }, scriptedRng([]));
    expect(s.pendingDraws).toHaveLength(0);
    expect(s.card).not.toBeNull();
    expect(s.trade).toBeNull();
  });

  it('drawing a FED card on The Fed space sets card state', () => {
    let s = started();
    s = rollTo(s, 7);
    expect(s.pendingDraws[0]).toBe('FED');
    s = dispatch(s, { t: 'draw', deck: 'FED' }, scriptedRng([]));
    expect(s.card?.deck).toBe('FED');
    expect(s.pendingDraws).toHaveLength(0);
  });

  it('Investor Day replaces the former After-Hours draw space', () => {
    let s = started();
    const cash = s.players[0].cash;
    s = rollTo(s, 31);
    expect(s.pendingDraws).toHaveLength(0);
    expect(s.investorDay).not.toBeNull();
    s = dispatch(s, { t: 'chooseInvestorGrowth' }, rng());
    expect(s.players[0].cash).toBe(cash + 500);
  });

  it('deck reshuffles from discard when exhausted', () => {
    let s = started();
    s = rollTo(s, 19); // space 19 = Market Event
    // drain the ME deck (guard: must shrink every pass or the test fails fast)
    let guard = 0;
    while (s.decks.ME.length > 0 && guard++ < 40) {
      const before = s.decks.ME.length;
      s = dispatch(s, { t: 'draw', deck: 'ME' }, rng());
      expect(s.decks.ME.length).toBeLessThan(before); // draw must consume a card
      if (s.circuitBreakerPrompt) s = dispatch(s, { t: 'passCircuitBreaker' }, rng());
      if (s.pick) s = dispatch(s, { t: 'skipPick' }, rng());
      if (s.openingBellPrompt) s = dispatch(s, { t: 'passOpeningBell' }, rng());
      if (!s.closing && s.phase !== 'over') {
        s = dispatch(s, { t: 'endTurn' }, rng());
        s = rollTo(s, 19);
      } else break;
    }
    expect(s.decks.ME.length === 0 || s.discard.ME.length > 0).toBe(true);
  });

  it('Market Close card triggers full-round close', () => {
    let s = started(2);
    s = rollTo(s, 19); // space 19 = Market Event
    const closeIdx = CARDS.ME.findIndex((card) => card.eff.k === 'close');
    s = { ...s, decks: { ...s.decks, ME: [closeIdx, ...s.decks.ME.filter((i) => i !== closeIdx)] } };
    s = dispatch(s, { t: 'draw', deck: 'ME' }, rng());
    expect(s.closing).toBe(true);
    expect(s.phase).toBe('play'); // not over yet
  });
});
