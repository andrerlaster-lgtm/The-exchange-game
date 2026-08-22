import { describe, expect, it } from 'vitest';
import { ME_CARDS } from '../data';
import { reduce } from '../engine';
import { patch, rng, started } from './helpers';

describe('Opening Bell Market Event card', () => {
  function drawCard() {
    const cardIndex = ME_CARDS.findIndex((card) => card.title === 'Opening Bell');
    expect(cardIndex).toBeGreaterThanOrEqual(0);
    const r = rng('opening-bell-card');
    let s = started(2, r);
    s = patch(s, (d) => {
      d.pendingDraws = ['ME'];
      d.decks.ME = [cardIndex];
      d.discard.ME = [];
      d.cur = 0;
    });
    return { s: reduce(s, { t: 'draw', deck: 'ME' }, r), r };
  }

  it('reveals an untouched company and buys the full company at tier price', () => {
    let { s, r } = drawCard();
    expect(s.card?.title).toBe('Opening Bell');
    expect(s.openingBellPrompt).not.toBeNull();
    const offer = s.openingBellPrompt!;
    const cash = s.players[0].cash;
    s = reduce(s, { t: 'buyOpeningBell' }, r);
    expect(s.openingBellPrompt).toBeNull();
    expect(s.players[0].shares[offer.code]).toBe(11);
    expect(s.players[0].cash).toBe(cash - offer.price);
    expect(s.soldOut[offer.code]?.claimHolder).toBe(0);
  });

  it('allows the player to pass without changing ownership', () => {
    let { s, r } = drawCard();
    const offer = s.openingBellPrompt!;
    s = reduce(s, { t: 'passOpeningBell' }, r);
    expect(s.openingBellPrompt).toBeNull();
    expect(s.players[0].shares[offer.code] ?? 0).toBe(0);
    expect(s.supply[offer.code]).toBe(11);
  });
});
