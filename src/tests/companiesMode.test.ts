import { describe, expect, it } from 'vitest';
import { companySharePrice, companyValue, reduce } from '../engine';
import { patch, scriptedRng, started } from './helpers';

describe('Companies Mode', () => {
  it('opens the player-company market after the first lap and keeps a 60/40 split', () => {
    const r = scriptedRng([1, 1, 1, 1]);
    let s = started(2, r);
    s = reduce(s, { t: 'setOpt', opt: { companiesMode: true } }, r);
    s = reduce(s, { t: 'startGame' }, r);
    expect(s.players[0].companyShares).toBe(60);
    expect(s.players[1].companyShares).toBe(60);
    expect(s.companyMarketOpen).toBe(false);

    s = patch(s, d => { d.cur = 1; d.turnPhase = 'acted'; d.lap = 1; });
    s = reduce(s, { t: 'endTurn' }, r);
    expect(s.lap).toBe(2);
    expect(s.companyMarketOpen).toBe(true);
  });

  it('offers one randomized emergency loan capped at 75% of starting value', () => {
    const r = scriptedRng([0, 0, 0, 22_500]);
    let s = started(2, r);
    s = reduce(s, { t: 'setOpt', opt: { companiesMode: true, startCash: 30_000 } }, r);
    s = reduce(s, { t: 'startGame' }, r);
    s = patch(s, d => {
      d.cur = 1;
      d.turnPhase = 'acted';
      d.lap = 2;
      d.companyMarketOpen = true;
      d.players[0].cash = 0;
      d.players[0].shares = {};
      d.players[0].etfShares = {};
    });

    s = reduce(s, { t: 'endTurn' }, r);
    expect(s.cur).toBe(0);
    expect(companyValue(s, 0)).toBe(0);
    expect(s.companyLoanOffer?.player).toBe(0);
    expect(s.companyLoanOffer?.amount).toBe(22_500);
    expect(s.companyLoanOffer!.amount).toBeLessThanOrEqual(22_500);

    s = reduce(s, { t: 'takeCompanyLoan' }, r);
    expect(s.players[0].cash).toBe(22_500);
    expect(s.players[0].companyLoanPrincipal).toBe(22_500);
    expect(s.companyLoanOffer).toBeNull();
    expect(companyValue(s, 0)).toBe(0);
    expect(companySharePrice(s, 0)).toBe(25);
  });

  it('does not allow a second emergency loan and requires repayment before a board buy', () => {
    const r = scriptedRng([0, 0, 0, 10_000]);
    let s = started(2, r);
    s = reduce(s, { t: 'setOpt', opt: { companiesMode: true } }, r);
    s = reduce(s, { t: 'startGame' }, r);
    s = patch(s, d => {
      d.cur = 0;
      d.turnPhase = 'acted';
      d.lap = 2;
      d.companyMarketOpen = true;
      d.players[0].cash = 0;
      d.players[0].shares = {};
      d.players[0].etfShares = {};
    });
    s = reduce(s, { t: 'endTurn' }, r); // move to player 1
    s = patch(s, d => { d.cur = 1; d.turnPhase = 'acted'; });
    s = reduce(s, { t: 'endTurn' }, r); // back to player 0; offer appears
    s = reduce(s, { t: 'takeCompanyLoan' }, r);
    const principal = s.players[0].companyLoanPrincipal;
    s = reduce(s, { t: 'takeCompanyLoan' }, r);
    expect(s.players[0].companyLoanPrincipal).toBe(principal);
    const before = s.supply['ALP'];
    s = patch(s, d => {
      d.cur = 0;
      d.turnPhase = 'acted';
      d.trade = { scope: 'stock', code: 'ALP', actionsLeft: 1 };
    });
    s = reduce(s, { t: 'buy', code: 'ALP' }, r);
    expect(s.supply['ALP']).toBe(before);
  });
});
