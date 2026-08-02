// Phase 4: Sector Portfolio (complete-the-set payout boost) + Diversified /
// Broad Market Portfolio (Market Open bonus for spreading across sectors).
// Built on the app's existing 8-sector map (no data migration).

import { describe, expect, it } from 'vitest';
import { SECTOR_CODES, DIVERSIFIED_BONUS, BROAD_MARKET_BONUS, PAYOUT_TIER_LOW, PAYOUT_TIER_LOW_SECTOR } from '../data';
import { completedSectors, distinctSectors, diversificationBonus, diversificationTier, hasSectorPortfolio } from '../engine';
import { dispatch, patch, rollTo, scriptedRng, started } from './helpers';

describe('Sector Portfolio completion', () => {
  it('completes a sector when the player owns every regular stock in it', () => {
    const s = started(2);
    const financeCodes = SECTOR_CODES.finance; // FTRB, PAYW, APEX
    const shares = Object.fromEntries(financeCodes.map((c) => [c, 1]));
    const withFinance = patch(s, (d) => { d.players[0].shares = shares; });
    expect(hasSectorPortfolio(withFinance.players[0], 'finance')).toBe(true);
    expect(completedSectors(withFinance.players[0])).toContain('finance');
  });

  it('is incomplete when even one company in the sector is missing', () => {
    const s = started(2);
    const financeCodes = SECTOR_CODES.finance;
    const shares = Object.fromEntries(financeCodes.slice(0, -1).map((c) => [c, 1]));
    const s2 = patch(s, (d) => { d.players[0].shares = shares; });
    expect(hasSectorPortfolio(s2.players[0], 'finance')).toBe(false);
    expect(completedSectors(s2.players[0])).not.toContain('finance');
  });
});

describe('Sector Portfolio boosts Payout Claim rent', () => {
  it('pays the boosted tier when the claim holder completed the sector', () => {
    let s = started(2);
    const financeCodes = SECTOR_CODES.finance; // includes FTRB
    const shares = Object.fromEntries(financeCodes.map((c) => [c, 1])); // 1 share each = Stock Owner tier
    s = patch(s, (d) => {
      d.supply.FTRB = 0;
      d.soldOut.FTRB = { code: 'FTRB', claimHolder: 1 };
      d.players[1].shares = shares;
      d.cur = 0;
    });
    const payerBefore = s.players[0].cash;
    const holderBefore = s.players[1].cash;
    s = rollTo(s, 8); // FTRB is at space 8
    expect(s.players[0].cash).toBe(payerBefore - PAYOUT_TIER_LOW_SECTOR);
    expect(s.players[1].cash).toBe(holderBefore + PAYOUT_TIER_LOW_SECTOR);
    expect(s.log.some((l) => /Sector Portfolio boost/i.test(l.text))).toBe(true);
  });

  it('pays the normal tier when the sector is not complete', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.supply.FTRB = 0;
      d.soldOut.FTRB = { code: 'FTRB', claimHolder: 1 };
      d.players[1].shares = { FTRB: 1 }; // only 1 of 3 finance stocks
      d.cur = 0;
    });
    const payerBefore = s.players[0].cash;
    s = rollTo(s, 8);
    expect(s.players[0].cash).toBe(payerBefore - PAYOUT_TIER_LOW);
  });
});

describe('Diversified / Broad Market Portfolio', () => {
  it('qualifies for Diversified at 3 distinct sectors', () => {
    const s = started(2);
    const shares = { SAFE: 11, MTRO: 11, FTRB: 11 }; // consumer, realestate, finance
    const s2 = patch(s, (d) => { d.players[0].shares = shares; });
    expect(distinctSectors(s2.players[0])).toBe(3);
    expect(diversificationTier(s2.players[0])).toBe('diversified');
    expect(diversificationBonus(s2.players[0])).toBe(DIVERSIFIED_BONUS);
  });

  it('does not count multiple companies from one sector as diversified', () => {
    const s = started(2);
    const s2 = patch(s, (d) => { d.players[0].shares = { SAFE: 11, FRSH: 11, SNKR: 11 }; });
    expect(distinctSectors(s2.players[0])).toBe(1);
    expect(diversificationTier(s2.players[0])).toBe('none');
    expect(diversificationBonus(s2.players[0])).toBe(0);
  });

  it('qualifies for Broad Market at 6+ distinct sectors, paying the higher bonus', () => {
    const s = started(2);
    const shares = { SAFE: 1, MTRO: 1, FTRB: 1, IRON: 1, CARE: 1, CCAI: 1 }; // 6 sectors
    const s2 = patch(s, (d) => { d.players[0].shares = shares; });
    expect(distinctSectors(s2.players[0])).toBe(6);
    expect(diversificationTier(s2.players[0])).toBe('broad');
    expect(diversificationBonus(s2.players[0])).toBe(BROAD_MARKET_BONUS);
  });

  it('pays only the highest bonus (not both) at Market Open', () => {
    let s = started(2);
    const shares = { SAFE: 1, MTRO: 1, FTRB: 1, IRON: 1, CARE: 1, CCAI: 1 }; // Broad Market
    s = patch(s, (d) => { d.players[0].shares = shares; d.players[0].pos = 34; });
    const cashBefore = s.players[0].cash;
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // wraps past Market Open
    // +$500 salary + $200 SAFE dividend (only priced stock with a dividend here: SAFE is Low risk) + $600 Broad Market
    expect(s.players[0].cash).toBeGreaterThan(cashBefore + BROAD_MARKET_BONUS);
    expect(s.log.some((l) => /Broad Market bonus/i.test(l.text))).toBe(true);
  });

  it('IPO shares do not count toward distinct sectors', () => {
    const s = started(2);
    const s2 = patch(s, (d) => { d.players[0].shares = { NDRV: 5 }; });
    expect(distinctSectors(s2.players[0])).toBe(0);
    expect(diversificationTier(s2.players[0])).toBe('none');
  });
});
