import { describe, expect, it } from 'vitest';
import { CEILING_TRIGGER, MOVE_BP, applyBasisPoints } from '../data';
import { blocked } from '../engine';
import { dispatch, patch, rng, rollTo, started } from './helpers';

describe('Investor Day — space 31', () => {
  it('offers Company Growth or Insider Information when the player owns no regular company', () => {
    let s = started(2);
    const cash = s.players[0].cash;
    s = rollTo(s, 31);

    expect(s.players[0].pos).toBe(31);
    expect(s.players[0].cash).toBe(cash);
    expect(s.investorDay?.eligibleCodes).toEqual([]);
    expect(blocked(s)).toBe(true);

    s = dispatch(s, { t: 'chooseInvestorGrowth' }, rng());
    expect(s.players[0].cash).toBe(cash + 500);
    expect(s.investorDay).toBeNull();
    expect(s.pick).toBeNull();
    expect(s.pendingDraws).toHaveLength(0);
  });

  it('requires the owner to choose one eligible regular company to move up', () => {
    let s = patch(started(2), (d) => { d.players[0].shares.MEDI = 11; });
    const before = s.prices.MEDI;
    s = rollTo(s, 31);

    expect(s.investorDay?.eligibleCodes).toEqual(['MEDI']);
    expect(s.pick).toBeNull();
    s = dispatch(s, { t: 'chooseInvestorGrowth' }, rng());
    expect(s.pick?.source).toBe('investor');
    expect(s.pick?.codes).toEqual(['MEDI']);
    expect(s.prices.MEDI).toBe(before);
    expect(blocked(s)).toBe(true);

    s = dispatch(s, { t: 'pickTarget', code: 'MEDI' }, rng());
    expect(s.prices.MEDI).toBe(applyBasisPoints(before, MOVE_BP.investorDay));
    expect(s.pick).toBeNull();
  });

  it('pays $500 when the player owns no regular company that can grow', () => {
    // The percentage redesign removed the hard ceiling, so "every owned company
    // is maxed out" is no longer reachable — a company can always rise. The
    // remaining way to have nothing eligible is to own no regular company at
    // all (IPOs are excluded from Company Growth).
    let s = patch(started(2), (d) => {
      d.players[0].shares = {};
    });
    const cash = s.players[0].cash;
    s = rollTo(s, 31);

    expect(s.investorDay?.eligibleCodes).toEqual([]);
    s = dispatch(s, { t: 'chooseInvestorGrowth' }, rng());
    expect(s.players[0].cash).toBe(cash + 500);
    expect(s.pick).toBeNull();
  });

  it('queues a Market Event when the selected company crosses the $5,000 mark', () => {
    let s = patch(started(2), (d) => {
      d.players[0].shares.MEDI = 11;
      d.prices.MEDI = CEILING_TRIGGER - 25;
    });
    s = rollTo(s, 31);
    s = dispatch(s, { t: 'chooseInvestorGrowth' }, rng());
    s = dispatch(s, { t: 'pickTarget', code: 'MEDI' }, rng());

    expect(s.prices.MEDI).toBeGreaterThan(CEILING_TRIGGER);
    expect(s.pendingDraws).toContain('ME');
  });

  it('previews the next Market Event without drawing, resolving, or removing it', () => {
    let s = started(2);
    s = rollTo(s, 31);
    const nextIndex = s.decks.ME[0];
    const deckLength = s.decks.ME.length;
    const prices = { ...s.prices };

    s = dispatch(s, { t: 'chooseInvestorTip' }, rng());

    expect(s.investorDay).toBeNull();
    expect(s.cardPreviewMode).toBe('insider');
    expect(s.card).not.toBeNull();
    expect(s.decks.ME[0]).toBe(nextIndex);
    expect(s.decks.ME).toHaveLength(deckLength);
    expect(s.discard.ME).toHaveLength(0);
    expect(s.prices).toEqual(prices);
    expect(blocked(s)).toBe(false);

    const previewedTitle = s.card!.title;
    s = patch(s, (draft) => { draft.pendingDraws = ['ME']; });
    s = dispatch(s, { t: 'draw', deck: 'ME' }, rng());
    expect(s.card?.title).toBe(previewedTitle);
    expect(s.cardPreviewMode).toBeNull();
    expect(s.decks.ME).toHaveLength(deckLength - 1);
  });
});
