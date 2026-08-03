// Phase 8: Insolvency / Forced Sale. A player who can't fully cover a required
// payment (Portfolio Tax, Audit Notice, or a Sold-Out Payout Claim landing
// payment) must force-sell regular stock — never IPO/ETF — until it's covered
// or they run out, at which point any remainder is waived (rulebook §17).

import { describe, expect, it } from 'vitest';
import { PAYOUT_TIER_CONTROL } from '../data';
import { blocked } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

describe('Insolvency — Portfolio Tax (space 25)', () => {
  it('opens a forced-sale insolvency when cash falls short, and blocks End Turn', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 100;
      d.players[0].shares = { MEDI: 3 }; // net worth pushes tax well above $100
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1])); // → space 25, Portfolio Tax
    expect(s.players[0].cash).toBe(0); // paid what it had
    expect(s.insolvency).not.toBeNull();
    expect(s.insolvency!.reason).toBe('tax');
    expect(blocked(s)).toBe(true);
  });

  it('force-selling a share raises cash and follows normal sell-back mechanics', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 100;
      d.players[0].shares = { MEDI: 3 };
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    const supplyBefore = s.supply.MEDI;
    s = dispatch(s, { t: 'forcedSell', code: 'MEDI' }, rng());
    expect(s.players[0].cash).toBeGreaterThan(0);
    expect(s.players[0].shares.MEDI).toBe(2);
    expect(s.supply.MEDI).toBe(supplyBefore + 1); // normal sell-back mechanics — returns to supply
  });

  it('selling enough shares lets payInsolvency fully settle with no waiver', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 0;
      d.players[0].shares = { MEDI: 10 };
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.insolvency).not.toBeNull();
    let guard = 0;
    while (s.players[0].cash < s.insolvency!.owed && guard++ < 10) {
      s = dispatch(s, { t: 'forcedSell', code: 'MEDI' }, rng());
    }
    s = dispatch(s, { t: 'payInsolvency' }, rng());
    expect(s.insolvency).toBeNull();
    expect(blocked(s)).toBe(false);
    expect(s.log.some((l) => /waived/i.test(l.text))).toBe(false);
  });

  it('running out of regular stock waives the remainder and closes insolvency', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 32; // → Audit Notice at space 34 (flat $500, +$250 with margin)
      d.players[0].cash = 0;
      d.players[0].shares = { FRSH: 1 }; // one Starter-tier share, nowhere near the $750 owed
      d.players[0].margin = 2000;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1])); // → space 34
    expect(s.players[0].pos).toBe(34);
    expect(s.insolvency!.owed).toBe(750);
    s = dispatch(s, { t: 'forcedSell', code: 'FRSH' }, rng());
    expect(s.players[0].shares.FRSH ?? 0).toBe(0);
    // Starter-tier FRSH opens at $500; sell-back pays one step below → $250.
    expect(s.players[0].cash).toBe(250);
    s = dispatch(s, { t: 'payInsolvency' }, rng());
    expect(s.insolvency).toBeNull();
    expect(s.players[0].cash).toBe(0);
    expect(s.log.some((l) => /waived/i.test(l.text))).toBe(true);
    expect(blocked(s)).toBe(false);
  });

  it('auto-waives immediately at landing when the player has no regular stock to sell', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 50;
      d.players[0].shares = {};
      d.players[0].etfShares = { GRW: 2 }; // ETFs can't be force-sold
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    expect(s.insolvency).toBeNull(); // never opened — nothing sellable
    expect(s.players[0].cash).toBe(0);
    expect(s.log.some((l) => /waived/i.test(l.text))).toBe(true);
  });
});

describe('Insolvency — Audit Notice (space 34)', () => {
  it('opens insolvency for the audit shortfall', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 32;
      d.players[0].cash = 100;
      d.players[0].shares = { MEDI: 2 };
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1])); // → space 34, Audit Notice ($500)
    expect(s.players[0].pos).toBe(34);
    expect(s.players[0].cash).toBe(0);
    expect(s.insolvency).not.toBeNull();
    expect(s.insolvency!.reason).toBe('audit');
    expect(s.insolvency!.owed).toBe(400); // $500 - $100 paid from cash
  });
});

describe('Insolvency — Payout Claim landing payment', () => {
  const CODE = 'FTRB';
  const SPACE = 8;

  it('opens insolvency (rather than silently waiving) when the payer has other regular stock to sell', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = 6; // Controller tier
      d.players[0].cash = 100;
      d.players[0].shares = { MEDI: 5 }; // sellable regular stock
      d.players[0].pos = 6;
      d.turnPhase = 'preRoll';
    });
    const holderBefore = s.players[1].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1])); // 6 + 2 → space 8 (FTRB)
    expect(s.players[0].pos).toBe(SPACE);
    expect(s.players[0].cash).toBe(0);
    expect(s.players[1].cash).toBe(holderBefore + 100); // partial payment already made
    expect(s.insolvency).not.toBeNull();
    expect(s.insolvency!.reason).toBe('payout');
    expect(s.insolvency!.payTo).toBe(1);
    expect(s.insolvency!.owed).toBe(PAYOUT_TIER_CONTROL - 100);
  });

  it('paying down insolvency routes cash to the Payout Claim holder, not the bank', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = 6;
      d.players[0].cash = 0;
      d.players[0].shares = { MEDI: 10 };
      d.players[0].pos = 6;
      d.turnPhase = 'preRoll';
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1]));
    const owed = s.insolvency!.owed;
    let guard = 0;
    while (s.players[0].cash < owed && guard++ < 10) {
      s = dispatch(s, { t: 'forcedSell', code: 'MEDI' }, rng());
    }
    const holderBefore = s.players[1].cash;
    s = dispatch(s, { t: 'payInsolvency' }, rng());
    expect(s.insolvency).toBeNull();
    expect(s.players[1].cash).toBe(holderBefore + owed);
  });
});

describe('Insolvency — IPO/ETF cannot be force-sold', () => {
  it('forcedSell on an IPO code is a no-op', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].pos = 23;
      d.players[0].cash = 0;
      d.players[0].shares = { NDRV: 3, MEDI: 1 };
      d.players[0].margin = 0;
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 1])); // Portfolio Tax
    expect(s.insolvency).not.toBeNull();
    const cashBefore = s.players[0].cash;
    s = dispatch(s, { t: 'forcedSell', code: 'NDRV' }, rng());
    expect(s.players[0].cash).toBe(cashBefore); // rejected — IPO shares excluded
    expect(s.players[0].shares.NDRV).toBe(3);
  });
});
