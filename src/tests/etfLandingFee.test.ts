import { describe, expect, it } from 'vitest';
import { ETF_DEFS, etfLandingFee } from '../data';
import { reduce } from '../engine';
import { patch, scriptedRng, started } from './helpers';

describe('railroad-style ETF landing fees', () => {
  it('pays the fund owner a fee based on distinct funds controlled', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 10_000;
      d.players[1].cash = 10_000;
      d.players[1].etfShares = { GRW: 1, INC: 1, PROP: 1 };
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // 1 + 3 = fund space 4
    // The share is still on offer — a fund another player owns is not locked.
    expect(s.etfPick).toBe('GRW');
    expect(s.landingNotice?.amount).toBe(2_500);
    // ...but not until the fee is settled.
    const blockedBuy = reduce(s, { t: 'buyEtf', code: 'GRW' }, scriptedRng([]));
    expect(blockedBuy.players[0].etfShares.GRW ?? 0).toBe(0);
    expect(blockedBuy.players[0].cash).toBe(10_000);

    s = reduce(s, { t: 'payLandingFee' }, scriptedRng([]));
    expect(s.players[0].cash).toBe(7_500);
    expect(s.players[1].cash).toBe(12_500);
    expect(s.log.some((entry) => /lands on .* owes/.test(entry.text))).toBe(true);

    s = reduce(s, { t: 'buyEtf', code: 'GRW' }, scriptedRng([]));
    expect(s.players[0].etfShares.GRW).toBe(1);
    expect(s.players[0].cash).toBe(4_500);
  });

  it('carrying the fee as debt still pays the fund owner', () => {
    // Deferring used to call addFeeDebt alone, turning a debt owed to ANOTHER
    // PLAYER into a debt owed to the bank — the creditor was never paid and the
    // money simply left the game.
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 0;
      d.players[1].cash = 10_000;
      d.players[1].etfShares = { GRW: 1, INC: 1, PROP: 1, ENE: 1 };
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // fund space 4
    expect(s.landingNotice?.amount).toBe(4_000);
    expect(s.landingNotice?.payTo).toBe(1);

    s = reduce(s, { t: 'deferLandingFee' }, scriptedRng([]));
    expect(s.players[1].cash).toBe(14_000);                 // creditor made whole
    expect(s.players[0].feeDebtPrincipal).toBe(4_000);      // debtor owes the bank
    expect(s.players[0].cash).toBe(0);
  });

  it('a tied top holding is Contested and pays nobody', () => {
    let s = started(3);
    s = patch(s, (d) => {
      d.players[0].cash = 10_000;
      d.players[1].etfShares = { GRW: 2 };
      d.players[2].etfShares = { GRW: 2 };
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // fund space 4
    expect(s.landingNotice).toBeNull();
    expect(s.etfPick).toBe('GRW');
  });

  it('pays the largest holder, not whoever sits earliest in turn order', () => {
    let s = started(3);
    s = patch(s, (d) => {
      d.players[0].cash = 10_000;
      d.players[1].etfShares = { GRW: 1 };            // earliest seat, smaller stake
      d.players[2].etfShares = { GRW: 3, INC: 1 };    // real owner
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // fund space 4
    expect(s.landingNotice?.payTo).toBe(2);
    expect(s.landingNotice?.amount).toBe(etfLandingFee(2)); // player 2 holds 2 distinct funds
  });

  it('uses the agreed fee ladder', () => {
    expect(etfLandingFee(1)).toBe(750);
    expect(etfLandingFee(2)).toBe(1_500);
    expect(etfLandingFee(3)).toBe(2_500);
    expect(etfLandingFee(4)).toBe(4_000);
    expect(ETF_DEFS).toHaveLength(4);
  });
});
