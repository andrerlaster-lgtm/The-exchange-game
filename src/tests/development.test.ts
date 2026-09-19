// Company development on the percentage market (2026-09-19): upgrades, Market
// Protection, control-loss refunds, and downside protection.

import { describe, expect, it } from 'vitest';
import {
  DEVELOPMENT_MIN_CASH_AFTER, PAYOUT_CLAIM_TOTAL_CAP, PRICE_FLOOR, SHIELD_COST, UPGRADE_LEVELS, applyBasisPoints,
} from '../data';
import type { PriceMoveSource } from '../data';
import type { GameState } from '../engine';
import { developmentOf, shieldBlockReason, upgradeBlockReason } from '../engine';
import { applyPriceMove } from '../engine/stockState';
import { applyEffect } from '../engine/eventCardResolver';
import { payMarketOpen } from '../engine/playerState';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

const CODE = 'FTRB';
// A high round price keeps the arithmetic free of $25-grid rounding, so these
// tests isolate the protection rules. Grid effects get their own test below.
const P = 10_000;

/** Player 0 controls CODE outright, has rolled, and nothing is pending. */
function controlled(shares = 11, cash = 100_000): GameState {
  return patch(started(2), (d) => {
    d.opts.companyUpgrades = true;
    d.players[0].shares[CODE] = shares;
    d.players[0].cash = cash;
    d.supply[CODE] = 11 - shares;
    d.soldOut[CODE] = { code: CODE, claimHolder: 0 };
    d.turnPhase = 'acted';
    d.cur = 0;
  });
}

const up = (s: GameState) => dispatch(s, { t: 'upgradeCompany', code: CODE }, rng());
const shield = (s: GameState) => dispatch(s, { t: 'buyMarketProtection', code: CODE }, rng());
/** Simulate a later turn by clearing the per-turn upgrade limit. */
const nextTurn = (s: GameState) => patch(s, (d) => { d.upgradedThisTurn = false; });

function atLevel(level: 0 | 1 | 2 | 3, opts: { shield?: boolean; price?: number } = {}): GameState {
  return patch(controlled(), (d) => {
    const def = level === 0 ? null : UPGRADE_LEVELS[level - 1];
    d.development[CODE] = {
      level, shieldActive: !!opts.shield, fundedBy: 0, totalInvested: def?.totalInvested ?? 0,
    };
    d.prices[CODE] = opts.price ?? P;
  });
}

function moveWith(s: GameState, bp: number, source: PriceMoveSource): GameState {
  return patch(s, (d) => { applyPriceMove(d, CODE, bp, source); });
}

/** Run any harmless action so the reducer's control-loss check executes. */
const tick = (s: GameState) => dispatch(s, { t: 'skipShort' }, rng());

// ── Purchase and control ────────────────────────────────────────────────────

describe('Company Upgrades setting', () => {
  it('is off by default, and then nothing can be upgraded or shielded', () => {
    const s = patch(controlled(), (d) => { d.opts.companyUpgrades = false; });
    expect(started(2).opts.companyUpgrades).toBe(false);
    expect(upgradeBlockReason(s, CODE)).toMatch(/turned off/);
    expect(shieldBlockReason(s, CODE)).toMatch(/turned off/);
    expect(up(s).development[CODE].level).toBe(0);
    expect(shield(s).development[CODE].shieldActive).toBe(false);
    expect(up(s).players[0].cash).toBe(s.players[0].cash);
  });
});

describe('upgrade purchase and control', () => {
  it('only a 6+ share Controller can upgrade or buy a shield', () => {
    const five = controlled(5);
    expect(upgradeBlockReason(five, CODE)).toMatch(/6\+ shares/);
    expect(up(five).development[CODE].level).toBe(0);
    expect(shield(five).development[CODE].shieldActive).toBe(false);

    const six = controlled(6);
    expect(up(six).development[CODE].level).toBe(1);
    expect(shield(six).development[CODE].shieldActive).toBe(true);
  });

  it('IPOs cannot be upgraded', () => {
    const s = patch(controlled(), (d) => { d.ipos[0].revealed = true; d.players[0].shares[d.ipos[0].code] = 5; });
    const after = dispatch(s, { t: 'upgradeCompany', code: s.ipos[0].code }, rng());
    expect(after.players[0].cash).toBe(s.players[0].cash);
  });

  it('upgrades are bought in order and a fourth is impossible', () => {
    let s = controlled();
    s = up(s); expect(s.development[CODE].level).toBe(1);
    s = up(nextTurn(s)); expect(s.development[CODE].level).toBe(2);
    s = up(nextTurn(s)); expect(s.development[CODE].level).toBe(3);
    const cash = s.players[0].cash;
    s = up(nextTurn(s));
    expect(s.development[CODE].level).toBe(3);
    expect(s.players[0].cash).toBe(cash);
  });

  it('only one permanent upgrade per player turn', () => {
    let s = up(controlled());
    const cash = s.players[0].cash;
    s = up(s);
    expect(s.development[CODE].level).toBe(1);
    expect(s.players[0].cash).toBe(cash);
    expect(upgradeBlockReason(s, CODE)).toMatch(/already bought an upgrade/);
  });

  it('the limit clears when the turn passes to the next player', () => {
    let s = up(controlled());
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(1);
    expect(s.upgradedThisTurn).toBe(false);
  });

  it('a doubles re-roll does NOT clear the limit (same player, same turn)', () => {
    let s = up(patch(controlled(), (d) => { d.bonusRollPending = true; }));
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(0);                // still player 0's turn
    expect(s.upgradedThisTurn).toBe(true); // no second upgrade on the bonus roll
  });

  it('a shield purchase does not use up the upgrade allowance', () => {
    let s = shield(controlled());
    expect(s.upgradedThisTurn).toBe(false);
    s = up(s);
    expect(s.development[CODE]).toMatchObject({ level: 1, shieldActive: true });
  });

  it('requires $20,000 in cash left over after paying for an upgrade', () => {
    // Level I costs $2,000: $22,000 is exactly enough, $21,999 is not.
    const exact = up(controlled(11, 22_000));
    expect(exact.development[CODE].level).toBe(1);
    expect(exact.players[0].cash).toBe(DEVELOPMENT_MIN_CASH_AFTER);

    const short = controlled(11, 21_999);
    expect(upgradeBlockReason(short, CODE)).toMatch(/must keep \$20,000 in cash after upgrading/);
    expect(up(short).development[CODE].level).toBe(0);
    expect(up(short).players[0].cash).toBe(21_999);
  });

  it('the same $20,000 floor applies to shields', () => {
    // A shield costs $1,500: $21,500 is exactly enough, $21,499 is not.
    const exact = shield(controlled(11, 21_500));
    expect(exact.development[CODE].shieldActive).toBe(true);
    expect(exact.players[0].cash).toBe(DEVELOPMENT_MIN_CASH_AFTER);

    const short = controlled(11, 21_499);
    expect(shieldBlockReason(short, CODE)).toMatch(/must keep \$20,000 in cash after buying it/);
    expect(shield(short).development[CODE].shieldActive).toBe(false);
  });

  it('cannot upgrade before rolling or with a required action open', () => {
    const preRoll = patch(controlled(), (d) => { d.turnPhase = 'preRoll'; });
    expect(up(preRoll).development[CODE].level).toBe(0);
    const pending = patch(controlled(), (d) => { d.pendingDraws = ['ME']; });
    expect(up(pending).development[CODE].level).toBe(0);
  });

  it('a new game resets development state', () => {
    let s = shield(up(controlled()));
    s = dispatch(s, { t: 'startGame' }, rng());
    expect(Object.values(s.development).every((d) => d.level === 0 && !d.shieldActive && d.fundedBy === null)).toBe(true);
    expect(s.upgradedThisTurn).toBe(false);
  });
});

// ── Cash and payouts ────────────────────────────────────────────────────────

describe('upgrade costs and Market Open bonus', () => {
  it('each level charges its own cost', () => {
    let s = controlled();
    for (const def of UPGRADE_LEVELS) {
      const before = s.players[0].cash;
      s = up(nextTurn(s));
      expect(before - s.players[0].cash).toBe(def.cost);
      expect(s.development[CODE].totalInvested).toBe(def.totalInvested);
    }
    const before = s.players[0].cash;
    expect(before - shield(s).players[0].cash).toBe(SHIELD_COST);
  });

  it('pays the flat Market Open bonus per level, separate from dividends', () => {
    let baseDividends = 0;
    patch(atLevel(0), (d) => { baseDividends = payMarketOpen(d, 0).dividends; });

    for (const def of UPGRADE_LEVELS) {
      let income!: ReturnType<typeof payMarketOpen>;
      patch(atLevel(def.level), (d) => { income = payMarketOpen(d, 0); });
      expect(income.developmentBonus).toBe(def.marketOpenBonus);
      // Not multiplied into, or by, the Controller dividend.
      expect(income.dividends).toBe(baseDividends);
    }
  });

  it('the Market Open bonus is not scaled by a Market Condition', () => {
    let plain!: number; let windfall!: number;
    patch(atLevel(3), (d) => { plain = payMarketOpen(d, 0).developmentBonus; });
    patch(atLevel(3), (d) => {
      d.marketConditions[0] = { id: 'dividendWindfall', icon: '', color: '', title: 'Dividend Windfall', detail: '', remaining: 3 } as never;
      windfall = payMarketOpen(d, 0).developmentBonus;
    });
    expect(windfall).toBe(plain);
    expect(plain).toBe(UPGRADE_LEVELS[2].marketOpenBonus);
  });
});

/** Player 1 lands on CODE (owned by player 0) and owes a Payout Claim. */
function landingOwed(s: GameState): { owed: number; detail: string } {
  const landed = rollTo(patch(s, (d) => { d.cur = 1; d.turnPhase = 'preRoll'; d.players[1].cash = 100_000; }), 8);
  return { owed: landed.landingNotice!.amount, detail: landed.landingNotice!.detail };
}

describe('Payout Claim bonus and the $10,000 cap', () => {
  it('adds each level’s flat claim bonus on top of the normal claim', () => {
    const base = landingOwed(atLevel(0, { price: 1_000 })).owed;
    for (const def of UPGRADE_LEVELS) {
      const { owed, detail } = landingOwed(atLevel(def.level, { price: 1_000 }));
      expect(owed - base).toBe(def.claimBonus);
      expect(detail).toContain(`Level ${def.numeral} development bonus`);
    }
  });

  it('never lets the combined landing payment exceed $10,000, and discloses the usable bonus', () => {
    // FTRB opens at $1,000 (Premium). With the Finance Sector Portfolio the
    // Controller multiplier is 6x, and at $1,500 the space is worth 1.5x:
    // 6 x $1,000 x 1.5 = $9,000. Level III adds $1,250 for $10,250, which the
    // cap trims to $10,000 — only $1,000 of the bonus lands.
    const withPortfolio = (level: 0 | 3) => patch(atLevel(level, { price: 1_500 }), (d) => {
      d.players[0].shares.PAYW = 1;
      d.players[0].shares.APEX = 1;
    });
    expect(landingOwed(withPortfolio(0)).owed).toBe(9_000);
    const { owed, detail } = landingOwed(withPortfolio(3));
    expect(owed).toBe(PAYOUT_CLAIM_TOTAL_CAP);
    expect(detail).toContain('only $1,000 applies under the $10,000 cap');
  });
});

// ── Control loss ────────────────────────────────────────────────────────────

describe('control loss resets and refunds', () => {
  it.each([[1, 800], [2, 2_400], [3, 4_400]] as const)(
    'dropping below 6 shares at Level %i refunds %i and resets to Base',
    (level, refund) => {
      let s = atLevel(level, { shield: true });
      const cash = s.players[0].cash;
      s = tick(patch(s, (d) => { d.players[0].shares[CODE] = 5; }));
      expect(s.players[0].cash - cash).toBe(refund);
      expect(s.development[CODE]).toEqual({ level: 0, shieldActive: false, fundedBy: null, totalInvested: 0 });
    },
  );

  it('a real market sale that drops the funder below 6 triggers the refund', () => {
    let s = atLevel(2);
    s = patch(s, (d) => { d.players[0].shares[CODE] = 6; });
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'sell', code: CODE, qty: 1 }, rng());
    expect(s.players[0].shares[CODE]).toBe(5);
    expect(s.development[CODE].level).toBe(0);
    expect(s.players[0].cash - cash).toBeGreaterThanOrEqual(2_400); // refund + sale proceeds
  });

  it('a competing Controller refunds the ORIGINAL investor, not the new one', () => {
    let s = atLevel(2);
    const p0 = s.players[0].cash; const p1 = s.players[1].cash;
    s = tick(patch(s, (d) => { d.players[0].shares[CODE] = 5; d.players[1].shares[CODE] = 6; }));
    expect(s.players[0].cash - p0).toBe(2_400);
    expect(s.players[1].cash).toBe(p1);
    expect(s.development[CODE].level).toBe(0); // upgrades never transfer
  });

  it('contested ownership (nobody controls it) triggers the reset', () => {
    const s = tick(patch(atLevel(1), (d) => { d.players[0].shares[CODE] = 5; d.players[1].shares[CODE] = 5; }));
    expect(s.development[CODE].level).toBe(0);
  });

  it('a shield-only company loses its shield on control loss, with no refund', () => {
    let s = atLevel(0, { shield: true });
    const cash = s.players[0].cash;
    s = tick(patch(s, (d) => { d.players[0].shares[CODE] = 5; }));
    expect(s.development[CODE].shieldActive).toBe(false);
    expect(s.players[0].cash).toBe(cash);
  });

  it('regaining control starts again from Base', () => {
    let s = tick(patch(atLevel(3), (d) => { d.players[0].shares[CODE] = 5; }));
    s = tick(patch(s, (d) => { d.players[0].shares[CODE] = 11; }));
    expect(s.development[CODE].level).toBe(0);
    s = up(nextTurn(s));
    expect(s.development[CODE].level).toBe(1);
  });
});

// ── Percentage-market protection ────────────────────────────────────────────

describe('downside protection', () => {
  it.each([[1, 20], [2, 40], [3, 60]] as const)('Level %i removes %i%% of an eligible decline', (level, share) => {
    // A standard -5% and a large -10% decline, each shrunk proportionally.
    for (const bp of [-500, -1_000, -2_000]) {
      const s = moveWith(atLevel(level), bp, 'marketEvent');
      expect(s.prices[CODE]).toBe(applyBasisPoints(P, bp * (1 - share / 100)));
    }
  });

  it('every protected decline still lowers the price — no ratchet', () => {
    // The flat 600 bp version erased every standard -500 bp decline at Level
    // III. Proportional protection must leave a real (smaller) decline.
    const s = moveWith(atLevel(3), -500, 'weakDemand');
    expect(s.prices[CODE]).toBe(applyBasisPoints(P, -200));
    expect(s.prices[CODE]).toBeLessThan(P);
  });

  it.each(['weakDemand', 'marketMeter', 'marketEvent', 'fedCard', 'bearRun'] as const)('%s is protected', (source) => {
    expect(moveWith(atLevel(2), -1_000, source).prices[CODE]).toBe(applyBasisPoints(P, -600));
  });

  it.each(['bankSale', 'voluntarySale', 'cyberattackChoice', 'regulatoryChoice'] as const)('%s is NOT protected', (source) => {
    const s = moveWith(atLevel(3, { shield: true }), -500, source);
    expect(s.prices[CODE]).toBe(applyBasisPoints(P, -500));
    expect(s.development[CODE].shieldActive).toBe(true);
  });

  it('never softens a rise', () => {
    expect(moveWith(atLevel(3, { shield: true }), 500, 'bullRun').prices[CODE]).toBe(applyBasisPoints(P, 500));
  });
});

describe('Market Protection shield', () => {
  it('absorbs at most 500 bp and is consumed', () => {
    const s = moveWith(atLevel(0, { shield: true }), -1_000, 'marketEvent');
    expect(s.prices[CODE]).toBe(applyBasisPoints(P, -500));
    expect(s.development[CODE].shieldActive).toBe(false);
  });

  // The plan's own worked examples, with Level III resilience applied first.
  // Level III now leaves 40% of each decline, so the shield always has
  // something to absorb in these examples (under the flat rule, Weak Demand
  // was fully erased before the shield was reached and the shield survived).
  it('Level III + shield: Weak Demand -500 bp → -200 bp → shield absorbs it all and is consumed', () => {
    const s = moveWith(atLevel(3, { shield: true }), -500, 'weakDemand');
    expect(s.prices[CODE]).toBe(P);
    expect(s.development[CODE].shieldActive).toBe(false);
  });

  it('Level III + shield: Market Event -1,000 bp → -400 bp → 0, shield consumed', () => {
    const s = moveWith(atLevel(3, { shield: true }), -1_000, 'marketEvent');
    expect(s.prices[CODE]).toBe(P);
    expect(s.development[CODE].shieldActive).toBe(false);
  });

  it('Level III + shield: Bear Run -2,000 bp → -800 bp → -300 bp, shield consumed', () => {
    const s = moveWith(atLevel(3, { shield: true }), -2_000, 'bearRun');
    expect(s.prices[CODE]).toBe(applyBasisPoints(P, -300));
    expect(s.development[CODE].shieldActive).toBe(false);
  });

  it('a company on the floor keeps its shield — there was no real decline', () => {
    const s = moveWith(atLevel(0, { shield: true, price: PRICE_FLOOR }), -1_000, 'marketEvent');
    expect(s.prices[CODE]).toBe(PRICE_FLOOR);
    expect(s.development[CODE].shieldActive).toBe(true);
  });

  it('Circuit Breaker has priority: blocking the whole event leaves the shield intact', () => {
    const s = patch(atLevel(0, { shield: true }), (d) => {
      applyEffect(d, { k: 'sector', sec: 'finance', bp: -1_000 }, [CODE]);
    });
    expect(s.prices[CODE]).toBe(P);
    expect(s.development[CODE].shieldActive).toBe(true);
  });
});

describe('protection through the real game flow', () => {
  it('a Bear Run on the Market Swing space is softened by upgrades', () => {
    // CCAI is High risk (-2,000 bp in a Bear Run); FTRB is Low risk and sits
    // Runs out entirely, so this case uses CCAI.
    let s = patch(started(2), (d) => {
      d.players[0].shares.CCAI = 11; d.supply.CCAI = 0;
      d.soldOut.CCAI = { code: 'CCAI', claimHolder: 0 };
      d.prices.CCAI = 2_000;
      d.development.CCAI = { level: 2, shieldActive: false, fundedBy: 0, totalInvested: 6_000 };
      d.turnPhase = 'acted'; d.cur = 0; d.regimeRollPrompt = { player: 0 };
    });
    s = dispatch(s, { t: 'rollRegime' }, scriptedRng([1]));
    // Level II removes 40% of the High-risk -2,000 bp Bear Run: -1,200 bp.
    expect(s.prices.CCAI).toBe(applyBasisPoints(2_000, -1_200));
    expect(s.log.some((l) => /through Level Ⅱ resilience/.test(l.text))).toBe(true);
  });

  it('a Cyberattack stock-choice penalty is never softened', () => {
    let s = atLevel(3, { shield: true, price: 2_000 });
    s = patch(s, (d) => { d.cyberattackPrompt = { player: 0, fee: 500, codes: [CODE] }; });
    s = dispatch(s, { t: 'chooseCyberattackStock', code: CODE }, rng());
    expect(s.prices[CODE]).toBe(applyBasisPoints(2_000, -500));
    expect(s.development[CODE].shieldActive).toBe(true);
  });
});

describe('$25 grid interaction (documents a known limitation)', () => {
  it('at low prices a reduced decline can round to the same price as an unprotected one', () => {
    // $750 -5% = -$37.50 → $725. Every level's smaller decline (-4%, -3%,
    // -2%: -$30, -$22.50, -$15) also rounds — or is forced by the
    // min-one-step rule — to a -$25 move. The reduction is real in basis
    // points but invisible in dollars for a standard move at this price.
    for (const level of [0, 1, 2, 3] as const) {
      expect(moveWith(atLevel(level, { price: 750 }), -500, 'weakDemand').prices[CODE]).toBe(725);
    }
    // A larger decline at the same price does show the protection.
    expect(moveWith(atLevel(0, { price: 750 }), -2_000, 'bearRun').prices[CODE]).toBe(600);
    expect(moveWith(atLevel(3, { price: 750 }), -2_000, 'bearRun').prices[CODE]).toBe(700);
    expect(developmentOf(atLevel(2), CODE).level).toBe(2);
  });
});
