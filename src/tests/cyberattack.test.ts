import { describe, expect, it } from 'vitest';
import { ME_CARDS } from '../data';
import { reduce } from '../engine';
import { patch, rng, started } from './helpers';

describe('Cyberattack card', () => {
  it('pauses for a choice and drops an owned holding one price step', () => {
    const cardIndex = ME_CARDS.findIndex((card) => card.title === 'Cyberattack');
    expect(cardIndex).toBeGreaterThanOrEqual(0);
    const r = rng('cyberattack-choice');
    let s = started(2, r);
    s = patch(s, (d) => {
      d.players[0].cash = 10_000;
      d.players[0].shares = { MEDI: 5 };
      d.pendingDraws = ['ME'];
      d.decks.ME = [cardIndex];
      d.discard.ME = [];
      d.cur = 0;
    });

    const before = s.prices.MEDI;
    s = reduce(s, { t: 'draw', deck: 'ME' }, r);
    expect(s.card?.title).toBe('Cyberattack');
    expect(s.cyberattackPrompt?.fee).toBe(500);
    expect(s.cyberattackPrompt?.codes).toContain('MEDI');
    expect(s.cyberattackPrompt).not.toBeNull();

    s = reduce(s, { t: 'chooseCyberattackStock', code: 'MEDI' }, r);
    expect(s.cyberattackPrompt).toBeNull();
    expect(s.prices.MEDI).toBe(before - 1);
  });

  it('can be resolved by paying the fee instead', () => {
    const cardIndex = ME_CARDS.findIndex((card) => card.title === 'Cyberattack');
    const r = rng('cyberattack-fee');
    let s = started(2, r);
    s = patch(s, (d) => {
      d.players[0].cash = 10_000;
      d.players[0].shares = { MEDI: 5 };
      d.pendingDraws = ['ME'];
      d.decks.ME = [cardIndex];
      d.discard.ME = [];
      d.cur = 0;
    });

    s = reduce(s, { t: 'draw', deck: 'ME' }, r);
    s = reduce(s, { t: 'payCyberattackFee' }, r);
    expect(s.cyberattackPrompt).toBeNull();
    expect(s.players[0].cash).toBe(9_500);
  });
});
