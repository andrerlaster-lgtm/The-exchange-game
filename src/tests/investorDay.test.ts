import { describe, expect, it } from 'vitest';
import { CEILING_TRIGGER, MOVE_BP, UPGRADE_LEVELS, applyBasisPoints, investorDayUpgradeCost } from '../data';
import { blocked, developmentOf, investorDayUpgradeTarget } from '../engine';
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

// 2026-09-20: revealed IPOs join Company Growth at half the move, and a third
// option buys a level for a controlled company at half price.

describe('Investor Day — IPOs and the half-price level', () => {
  const CODE = 'FTRB';

  /** Land player 0 on Investor Day with whatever holdings the test needs. */
  function onInvestorDay(extra: (d: ReturnType<typeof started>) => void = () => {}) {
    return rollTo(patch(started(2), (d) => { d.players[0].cash = 60_000; extra(d); }), 31);
  }
  const growth = (s: ReturnType<typeof started>) => dispatch(s, { t: 'chooseInvestorGrowth' }, rng());
  const pickCode = (s: ReturnType<typeof started>, code: string) => dispatch(s, { t: 'pickTarget', code }, rng());
  const takeUpgrade = (s: ReturnType<typeof started>) => dispatch(s, { t: 'chooseInvestorUpgrade' }, rng());
  const controlling = (extra: (d: ReturnType<typeof started>) => void = () => {}) => onInvestorDay((d) => {
    d.opts.companyUpgrades = true;
    d.players[0].shares = { [CODE]: 6 };
    extra(d);
  });

  it('offers a revealed IPO, and grows it half as far as a regular company', () => {
    const s = onInvestorDay((d) => {
      d.ipos[0].revealed = true;
      d.players[0].shares = { [d.ipos[0].code]: 1 };
    });
    const ipo = s.ipos[0];
    expect(s.investorDay?.eligibleCodes).toContain(ipo.code);
    const t = pickCode(growth(s), ipo.code);
    expect(t.ipos[0].price).toBe(applyBasisPoints(ipo.price, MOVE_BP.investorDayIpo));
    expect(MOVE_BP.investorDayIpo).toBe(MOVE_BP.investorDay / 2);
  });

  it('never offers an IPO that has not launched', () => {
    const s = onInvestorDay((d) => {
      d.ipos.forEach((ip) => { ip.revealed = false; });
      d.players[0].shares = { [d.ipos[0].code]: 1 };
    });
    expect(s.investorDay?.eligibleCodes).toEqual([]);
    expect(growth(s).players[0].cash).toBe(s.players[0].cash + 500); // the fallback
  });

  it('offers a half-price level on a company the player controls', () => {
    const s = controlling();
    expect(s.investorDay?.upgradeCode).toBe(CODE);
    expect(investorDayUpgradeTarget(s)).toBe(CODE);
  });

  it('charges half, rounded to $100, and does not use the turn’s upgrade', () => {
    const s = controlling();
    const cost = investorDayUpgradeCost(UPGRADE_LEVELS[0].cost);
    expect(cost).toBe(1_000); // Level I is $2,000
    const t = takeUpgrade(s);
    expect(developmentOf(t, CODE).level).toBe(1);
    expect(t.players[0].cash).toBe(s.players[0].cash - cost);
    expect(t.upgradedThisTurn).toBe(false); // the ordinary upgrade is still available
    expect(developmentOf(t, CODE).totalInvested).toBe(cost); // refunds follow what was paid
    expect(t.log.some((l) => /half price/.test(l.text))).toBe(true);
    expect(t.investorDay).toBeNull();
  });

  it('is not offered without control, at Level III, or with upgrades off', () => {
    expect(controlling((d) => { d.players[0].shares = { [CODE]: 5 }; }).investorDay?.upgradeCode).toBeNull();
    expect(controlling((d) => { d.opts.companyUpgrades = false; }).investorDay?.upgradeCode).toBeNull();
    const maxed = controlling((d) => {
      d.development[CODE] = { level: 3, shieldActive: false, fundedBy: 0, totalInvested: 11_000 };
    });
    expect(maxed.investorDay?.upgradeCode).toBeNull();
  });

  it('still respects the portfolio gate and the cash floor', () => {
    const broke = controlling((d) => { d.players[0].cash = 900; }); // under the $5,000 floor
    expect(broke.investorDay?.upgradeCode).toBeNull();
    expect(takeUpgrade(broke).players[0].cash).toBe(900);
  });
});
