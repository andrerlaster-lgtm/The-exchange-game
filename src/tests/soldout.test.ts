// Sold-Out / Payout Claim: an all-or-nothing company buy-out instantly sells the
// stock out (sole owner, no ties possible from the buy itself), landing rent by
// tier, insolvency floor, and claim transfers on later ownership changes.

import { describe, expect, it } from 'vitest';
import {
  PAYOUT_TIER_CONTROL, PAYOUT_TIER_CONTROL_SECTOR, PAYOUT_TIER_LOW,
  PAYOUT_TIER_LOW_SECTOR, PAYOUT_TIER_MID, PAYOUT_TIER_MID_SECTOR, REGULAR_SUPPLY,
} from '../data';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';
import { claimPayoutForLanding, landingValueMultiplier, shareholderLandingDiscount } from '../engine/soldOut';

// MEDI is a regular stock at board space 5 (safe for rollTo, which needs space >= 4).
const CODE = 'MEDI';
const SPACE = 5;

/** Set up an open stock-trade context for the current player on `code`. */
function withTrade(s: ReturnType<typeof started>, code = CODE) {
  return patch(s, (d) => {
    d.turnPhase = 'acted';
    d.trade = { scope: 'stock', code, actionsLeft: 1 };
  });
}

describe('Sold-Out detection & permanence', () => {
  it('marks the stock sold out — and the buyer the sole claim holder — on buy-out', () => {
    let s = started(2);
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.supply[CODE]).toBe(0);
    expect(s.soldOut[CODE]).toBeDefined();
    expect(s.soldOut[CODE].claimHolder).toBe(0);
    expect(s.players[0].shares[CODE]).toBe(REGULAR_SUPPLY);
  });

  it('stays sold out after a sell; sold-back shares become outstanding, not supply', () => {
    let s = started(2);
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng()); // sells out, p0 owns all 11
    s = withTrade(s);
    s = dispatch(s, { t: 'sell', code: CODE, qty: 1 }, rng());
    expect(s.soldOut[CODE]).toBeDefined();     // permanent
    expect(s.supply[CODE]).toBe(0);            // did not reopen normal supply
    expect(s.bankPool[CODE]).toBe(1);          // outstanding on the company space
  });

  it('does not move the share price on the fixed-price buyout', () => {
    let s = started(2);
    const before = s.prices[CODE];
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.prices[CODE]).toBe(before);
  });
});

describe('Payout Claim assignment', () => {
  it('a buy-out always makes the buyer the sole owner and claim holder (no partial stakes possible)', () => {
    let s = started(3);
    s = patch(s, (d) => { d.cur = 2; });
    s = withTrade(s);
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.soldOut[CODE].claimHolder).toBe(2);
    expect(s.players[2].shares[CODE]).toBe(REGULAR_SUPPLY);
    expect(s.players[0].shares[CODE] ?? 0).toBe(0);
    expect(s.players[1].shares[CODE] ?? 0).toBe(0);
  });

  it('becomes Contested (null) when a later ownership change ties the top owners', () => {
    // A tie can no longer arise from the buy itself (it always produces a sole
    // owner) — only from what happens afterward: the owner sells enough back
    // that a rival who bought in via an outstanding-share purchase/P2P now ties them.
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 0 };
      d.players[0].shares[CODE] = 6;
      d.players[1].shares[CODE] = 5;
      d.cur = 0;
      d.turnPhase = 'acted';
      d.trade = { scope: 'stock', code: CODE, actionsLeft: 1 };
    });
    s = dispatch(s, { t: 'sell', code: CODE, qty: 1 }, rng()); // p0 6 -> 5, ties p1's 5
    expect(s.soldOut[CODE].claimHolder).toBeNull();
    expect(s.log.some((l) => /Contested/i.test(l.text))).toBe(true);
  });
});

describe('Landing rent on a sold-out stock', () => {
  it('uses the approved higher-cash payout ladders', () => {
    expect([PAYOUT_TIER_LOW, PAYOUT_TIER_MID, PAYOUT_TIER_CONTROL]).toEqual([500, 1_000, 2_000]);
    expect([PAYOUT_TIER_LOW_SECTOR, PAYOUT_TIER_MID_SECTOR, PAYOUT_TIER_CONTROL_SECTOR]).toEqual([750, 1_500, 3_000]);
  });

  it('scales rent with market value and discounts shareholders', () => {
    expect(landingValueMultiplier(750, 750)).toBe(1);
    expect(landingValueMultiplier(1_000, 750)).toBe(1.5);
    expect(landingValueMultiplier(1_500, 750)).toBe(2);
    expect(shareholderLandingDiscount(3)).toBeCloseTo(0.3);
    expect(shareholderLandingDiscount(8)).toBe(0.5);
    expect(claimPayoutForLanding(2, false, 3, 2, 0)).toBe(750); // $500 × 1.5
    expect(claimPayoutForLanding(2, false, 3, 2, 3)).toBe(550); // 30% shareholder discount
  });

  function landOn(holderShares: number) {
    let s = started(2);
    // Preset: MEDI sold out (via an earlier buy-out), player 1 holds the claim
    // after selling down to `holderShares`.
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = holderShares;
      d.cur = 0;
    });
    return rollTo(s, SPACE); // player 0 lands on MEDI
  }

  it('grants the landing player a first-lap grace period', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = 2;
      d.players[0].pos = 2;
      d.players[0].hasCompletedLap = false;
    });
    const payerCash = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 2]));
    expect(s.players[0].cash).toBe(payerCash);
    expect(s.landingNotice).toBeNull();
    expect(s.log.some((l) => /first lap.*no Payout Claim/i.test(l.text))).toBe(true);

    s = patch(s, (d) => {
      d.players[0].pos = 2;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 2]));
    expect(s.landingNotice?.kind).toBe('payout');
  });

  it('charges $500 when the holder owns 1-2 shares', () => {
    const s0 = started(2);
    const payerCash = s0.players[0].cash;
    const holderCash = s0.players[1].cash;
    const s = landOn(2);
    expect(s.players[0].cash).toBe(payerCash - PAYOUT_TIER_LOW);
    expect(s.players[1].cash).toBe(holderCash + PAYOUT_TIER_LOW);
    const outs = s.tradeLog.filter((t) => t.kind === 'payout');
    expect(outs.length).toBe(2);
  });

  it('charges $1,000 when the holder owns 3-5 shares', () => {
    const s0 = started(2);
    const s = landOn(4);
    expect(s.players[0].cash).toBe(s0.players[0].cash - PAYOUT_TIER_MID);
    expect(s.players[1].cash).toBe(s0.players[1].cash + PAYOUT_TIER_MID);
  });

  it('charges $2,000 when the holder owns 6+ shares (Controller)', () => {
    const s0 = started(2);
    const s = landOn(6);
    expect(s.players[0].cash).toBe(s0.players[0].cash - PAYOUT_TIER_CONTROL);
    expect(s.players[1].cash).toBe(s0.players[1].cash + PAYOUT_TIER_CONTROL);
  });

  it('charges nothing when the landing player IS the claim holder, and no Trade Step opens', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 0 };
      d.players[0].shares[CODE] = 6;
      d.cur = 0;
    });
    const before = s.players[0].cash;
    s = rollTo(s, SPACE);
    expect(s.players[0].cash).toBe(before);
    // Already fully allocated — nothing to buy here, so no Trade Step opens.
    // (Selling remains available anytime via the Trading Market / Sell to Bank.)
    expect(s.trade).toBeNull();
  });

  it('charges nothing when the claim is Contested', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: null };
      d.cur = 0;
    });
    const before = s.players[0].cash;
    s = rollTo(s, SPACE);
    expect(s.players[0].cash).toBe(before);
  });

  it('floors an unaffordable payout at $0 and offers a loan when there is no stock to force-sell (cash never negative)', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = 6;   // owes $800
      d.players[0].cash = 300;         // can only pay 300
      d.cur = 0;
    });
    const holderBefore = s.players[1].cash;
    s = rollTo(s, SPACE);
    expect(s.players[0].cash).toBe(0);
    expect(s.players[1].cash).toBe(holderBefore + 300);
    expect(s.payoutShortfallChoice).toMatchObject({ player: 0, creditor: 1, owed: 1700, canForceSell: false });
  });

  it('landing on a sold-out stock never opens a Trade Step — buying it is simply unavailable', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 1 };
      d.players[1].shares[CODE] = 2;
      d.cur = 0;
    });
    s = rollTo(s, SPACE);
    expect(s.trade).toBeNull();
    const ownedBefore = s.players[0].shares[CODE] ?? 0;
    // With no Trade Step (and the company already owned), a buy attempt is a no-op.
    s = dispatch(s, { t: 'buy', code: CODE }, rng());
    expect(s.players[0].shares[CODE] ?? 0).toBe(ownedBefore);
  });
});

describe('Payout Claim transfer on ownership change', () => {
  it('moves the claim when a sell drops the holder below a rival', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 0 };
      d.players[0].shares[CODE] = 4;
      d.players[1].shares[CODE] = 3;
      d.cur = 0;
      d.turnPhase = 'acted';
      d.trade = { scope: 'stock', code: CODE, actionsLeft: 1 };
    });
    s = dispatch(s, { t: 'sell', code: CODE, qty: 2 }, rng()); // p0 -> 2, p1 -> 3
    expect(s.soldOut[CODE].claimHolder).toBe(1);
  });

  it('moves the claim when a P2P trade makes a new sole top owner', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE] = 0;
      d.soldOut[CODE] = { code: CODE, claimHolder: 0 };
      d.players[0].shares[CODE] = 5;
      d.players[1].shares[CODE] = 2;
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: CODE, qty: 4, direction: 'sell', price: 100 }, rng());
    const id = s.p2pOffers[0].id;
    s = dispatch(s, { t: 'acceptP2POffer', id }, rng()); // p0 -> 1, p1 -> 6
    expect(s.soldOut[CODE].claimHolder).toBe(1);
  });
});
