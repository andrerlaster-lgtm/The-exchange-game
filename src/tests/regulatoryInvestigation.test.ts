import { describe, expect, it } from 'vitest';
import { ME_CARDS, SALARY } from '../data';
import { reduce } from '../engine';
import { payMarketOpen } from '../engine/playerState';
import { patch, rng, started } from './helpers';

function drawnState() {
  const cardIndex = ME_CARDS.findIndex((card) => card.title === 'Regulatory Investigation');
  expect(cardIndex).toBeGreaterThanOrEqual(0);
  const r = rng('regulatory-investigation');
  let s = started(2, r);
  s = patch(s, (d) => {
    d.players[0].cash = 10_000;
    d.players[0].shares = { MEDI: 5 };
    d.pendingDraws = ['ME'];
    d.decks.ME = [cardIndex];
    d.discard.ME = [];
    d.cur = 0;
  });
  return { s: reduce(s, { t: 'draw', deck: 'ME' }, r), r };
}

describe('Regulatory Investigation card', () => {
  it('offers a $5,000 settlement or a holding penalty', () => {
    let { s, r } = drawnState();
    expect(s.regulatoryInvestigationPrompt?.fee).toBe(5_000);
    const beforePrice = s.prices.MEDI;
    s = reduce(s, { t: 'chooseRegulatoryInvestigationStock', code: 'MEDI' }, r);
    expect(s.regulatoryInvestigationPrompt).toBeNull();
    expect(s.prices.MEDI).toBe(beforePrice - 1);
    expect(s.players[0].dividendCuts.MEDI).toBe(1);

    const beforeCash = s.players[0].cash;
    s = patch(s, (d) => payMarketOpen(d, 0));
    // 2026-09-18 cash-flow pass: MEDI (Med risk) is now $70/share, was $50.
    expect(s.players[0].cash - beforeCash).toBe(SALARY + 175); // salary + half of 5×$70 dividend
    expect(s.players[0].dividendCuts.MEDI).toBeUndefined();
  });

  it('settles the investigation for $5,000', () => {
    let { s, r } = drawnState();
    s = reduce(s, { t: 'payRegulatoryInvestigation' }, r);
    expect(s.regulatoryInvestigationPrompt).toBeNull();
    expect(s.players[0].cash).toBe(5_000);
    expect(s.players[0].dividendCuts).toEqual({});
  });
});
