import { describe, expect, it } from 'vitest';
import { ME_CARDS } from '../data';
import { reduce } from '../engine';
import { patch, rng, started } from './helpers';

describe('Dividend Payment card', () => {
  it('pays current stock dividends immediately without salary or ETF bonuses', () => {
    const cardIndex = ME_CARDS.findIndex((card) => card.title === 'Dividend Payment');
    expect(cardIndex).toBeGreaterThanOrEqual(0);
    const r = rng('dividend-card');
    let s = started(2, r);
    s = patch(s, (d) => {
      d.players[0].cash = 1_000;
      d.players[0].shares = { MEDI: 5 };
      d.players[0].salaryCollected = 0;
      d.pendingDraws = ['ME'];
      d.decks.ME = [cardIndex];
      d.discard.ME = [];
      d.cur = 0;
    });

    s = reduce(s, { t: 'draw', deck: 'ME' }, r);

    expect(s.card?.title).toBe('Dividend Payment');
    expect(s.players[0].cash).toBe(1_250); // 5 MEDI shares × $50
    expect(s.players[0].salaryCollected).toBe(0);
    expect(s.log.some((entry) => /Dividend Payment/.test(entry.text))).toBe(true);
  });
});
