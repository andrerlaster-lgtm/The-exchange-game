// Sector Control: owning both companies in a rent pair (see SECTOR_PAIRS)
// stacks a flat Sector Rent on top of the normal Payout Claim when the pair
// owner is landed on. Since a whole company can only be acquired via the
// all-or-nothing 11-share buyout (which always sells it out), both pair
// members are necessarily sold out by the time anyone can control the pair
// — so this only ever fires alongside a sold-out landing, never on an
// untouched one.

import { describe, expect, it } from 'vitest';
import { ladderStep, PAYOUT_CLAIM_TOTAL_CAP, SECTOR_PAIRS, STOCK_BY_CODE } from '../data';
import { claimPayoutForLanding } from '../engine/soldOut';
import { controlledSectorPairs, sectorPairOwner } from '../engine';
import { dispatch, patch, rng, rollTo, started } from './helpers';

// blueChipAlliance pair: FTRB (finance, space 8) + IRON (industrials, space
// 11) — $200 rent. A cross-category pair, deliberately chosen so owning
// both never also completes either company's *broad* Sector Portfolio
// (finance and industrials each have 3 companies, not 2) — keeps this test
// isolated from that separate, pre-existing boost.
const PAIR = SECTOR_PAIRS.blueChipAlliance;
const [CODE_A, CODE_B] = PAIR.codes; // FTRB, IRON
const LANDING_SPACE = 11; // IRON

function expectedClaimOwed(holderShares: number, landingShares = 0) {
  const stock = STOCK_BY_CODE[CODE_B];
  return claimPayoutForLanding(holderShares, false, stock.step, stock.step, landingShares);
}

describe('Sector Control ownership', () => {
  it('sectorPairOwner finds the sole owner of both companies', () => {
    const s = patch(started(2), (d) => {
      d.players[1].shares[CODE_A] = 11;
      d.players[1].shares[CODE_B] = 11;
    });
    expect(sectorPairOwner(s, PAIR.id)).toBe(1);
    expect(controlledSectorPairs(s, 1)).toContain(PAIR.id);
  });

  it('returns null when only one company in the pair is owned', () => {
    const s = patch(started(2), (d) => {
      d.players[1].shares[CODE_A] = 11;
      // CODE_B untouched — nobody owns any shares of it yet.
    });
    expect(sectorPairOwner(s, PAIR.id)).toBeNull();
  });

  it('returns null (Contested) when the pair is split across two players', () => {
    const s = patch(started(2), (d) => {
      d.players[0].shares[CODE_A] = 11;
      d.players[1].shares[CODE_B] = 11;
    });
    expect(sectorPairOwner(s, PAIR.id)).toBeNull();
  });
});

describe('Sector Rent stacks on the Payout Claim', () => {
  function landOnB(holderIdx: 0 | 1, opts: { bothOwned: boolean }) {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE_A] = 0; d.soldOut[CODE_A] = { code: CODE_A, claimHolder: holderIdx };
      d.supply[CODE_B] = 0; d.soldOut[CODE_B] = { code: CODE_B, claimHolder: holderIdx };
      d.players[holderIdx].shares[CODE_A] = opts.bothOwned ? 11 : 0;
      d.players[holderIdx].shares[CODE_B] = 11;
      d.cur = holderIdx === 0 ? 1 : 0; // rollTo moves and lands whoever s.cur is
    });
    return rollTo(s, LANDING_SPACE);
  }

  it('charges Payout Claim + Sector Rent when the claim holder controls the full pair', () => {
    const s = landOnB(1, { bothOwned: true });
    const claimOwed = expectedClaimOwed(11);
    expect(s.landingNotice).toMatchObject({
      kind: 'payout',
      title: `Payout Claim + Sector Rent · ${CODE_B}`,
      amount: claimOwed + PAIR.rent,
      canDefer: false,
    });
    expect(s.payoutShortfallChoice).toMatchObject({
      owed: claimOwed + PAIR.rent,
      label: `Payout Claim + Sector Rent on ${CODE_B} to ${s.players[1].name}`,
    });
  });

  it('charges only the normal Payout Claim when the holder does not own the pair partner', () => {
    const s = landOnB(1, { bothOwned: false });
    const claimOwed = expectedClaimOwed(11);
    expect(s.landingNotice).toMatchObject({
      kind: 'payout',
      title: `Payout Claim · ${CODE_B}`,
      amount: claimOwed,
    });
    expect(s.payoutShortfallChoice?.owed).toBe(claimOwed);
  });

  it('caps the final combined Payout Claim and Sector Rent at $10,000', () => {
    const premiumPair = SECTOR_PAIRS.speculativePlays; // SNKR + APEX
    let s = started(2);
    s = patch(s, (d) => {
      for (const code of premiumPair.codes) {
        d.supply[code] = 0;
        d.soldOut[code] = { code, claimHolder: 1 };
        d.players[1].shares[code] = 11;
      }
      // Complete APEX's Finance sector so its boosted claim reaches $12,000
      // at 2× opening value, before the pair's $350 Sector Rent is added.
      d.players[1].shares.FTRB = 1;
      d.players[1].shares.PAYW = 1;
      d.prices.APEX = ladderStep(2_000);
      d.cur = 0;
    });
    s = rollTo(s, STOCK_BY_CODE.APEX.space);

    expect(s.landingNotice?.amount).toBe(PAYOUT_CLAIM_TOTAL_CAP);
    expect(s.payoutShortfallChoice?.owed).toBe(PAYOUT_CLAIM_TOTAL_CAP);
    expect(s.landingNotice?.detail).toContain('combined $12,350 charge is capped at $10,000');
  });

  it('never charges Sector Rent to a player landing on their own controlled pair', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply[CODE_A] = 0; d.soldOut[CODE_A] = { code: CODE_A, claimHolder: 0 };
      d.supply[CODE_B] = 0; d.soldOut[CODE_B] = { code: CODE_B, claimHolder: 0 };
      d.players[0].shares[CODE_A] = 11;
      d.players[0].shares[CODE_B] = 11;
      d.cur = 0;
    });
    const before = s.players[0].cash;
    s = rollTo(s, LANDING_SPACE);
    expect(s.players[0].cash).toBe(before);
    expect(s.landingNotice).toBeNull();
  });

  it('pays cash now for the combined amount via choosePayoutPayCash', () => {
    const s0 = landOnB(1, { bothOwned: true });
    const s = dispatch(s0, { t: 'ackLandingNotice' }, rng());
    const owed = s.payoutShortfallChoice!.owed;
    const debtorBefore = s.players[0].cash;
    const creditorBefore = s.players[1].cash;
    const paid = dispatch(s, { t: 'choosePayoutPayCash' }, rng());

    expect(paid.payoutShortfallChoice).toBeNull();
    expect(paid.players[0].cash).toBe(debtorBefore - owed);
    expect(paid.players[1].cash).toBe(creditorBefore + owed);
  });
});
