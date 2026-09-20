// Company development: upgrades, Market Protection shields, control-loss
// refunds, and the downside protection applied inside applyPriceMove.
// Runs on Immer drafts.

import {
  CONTROL_THRESHOLD_REGULAR, MAX_DEVELOPMENT_LEVEL, SHIELD_ABSORB_BP, SHIELD_COST,
  DEVELOPMENT_MIN_CASH, DEVELOPMENT_MIN_GAIN, PRICE_MOVE_SOURCE_LABEL, investorDayUpgradeCost, SHIELDABLE_SOURCES, STOCK_BY_CODE, UPGRADE_LEVELS, applyBasisPoints,
  developmentRefund, isIpoCode, upgradeLevel,
} from '../data';
import type { DevelopmentLevel, PriceMoveSource } from '../data';
import { money, moveSize, pctBp } from '../utils/formatMoney';
import type { CompanyDevelopment, GameState, LogKind } from './types';
import { canMarketSell } from './rules';
import { netWorth } from './scoringEngine';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

const BASE: CompanyDevelopment = { level: 0, shieldActive: false, fundedBy: null, totalInvested: 0 };

/** Development record for a code. IPOs and ETFs are never developed, so they
    always read as Base. The fallback also covers saves from before upgrades. */
export function developmentOf(s: GameState, code: string): CompanyDevelopment {
  return s.development?.[code] ?? BASE;
}

/** Whether `player` currently controls a regular company (6+ shares). */
export function isController(s: GameState, player: number, code: string): boolean {
  if (isIpoCode(code) || !STOCK_BY_CODE[code]) return false;
  return (s.players[player]?.shares[code] ?? 0) >= CONTROL_THRESHOLD_REGULAR;
}

// ── Purchase eligibility ────────────────────────────────────────────────────

/** Why the current player can't upgrade `code` right now, or null if they can. */
export function upgradeBlockReason(s: GameState, code: string): string | null {
  if (!s.opts.companyUpgrades) return 'Company upgrades are turned off for this game.';
  if (isIpoCode(code) || !STOCK_BY_CODE[code]) return 'Only regular companies can be upgraded.';
  if (!isController(s, s.cur, code)) return `You need ${CONTROL_THRESHOLD_REGULAR}+ shares to control ${code}.`;
  const dev = developmentOf(s, code);
  if (dev.level >= MAX_DEVELOPMENT_LEVEL) return `${code} is already at Level Ⅲ.`;
  if (s.upgradedThisTurn) return 'You have already bought an upgrade this turn.';
  if (!canMarketSell(s)) return 'Roll and resolve every required action first.';
  const next = UPGRADE_LEVELS[dev.level];
  const gate = developmentGateReason(s, next.cost, `Level ${next.numeral}`);
  if (gate) return gate;
  return null;
}

/** The portfolio test both upgrades and shields must pass: the player has to
    be up at least DEVELOPMENT_MIN_GAIN on their starting cash by market value,
    and have the cash to pay. */
export function developmentMinNetWorth(s: GameState): number {
  return s.opts.startCash + DEVELOPMENT_MIN_GAIN;
}

function developmentGateReason(s: GameState, cost: number, what: string): string | null {
  const p = s.players[s.cur];
  const required = developmentMinNetWorth(s);
  const worth = netWorth(s, p);
  if (worth < required) {
    return `${what} needs a portfolio worth ${money(required)} — your starting cash plus ${money(DEVELOPMENT_MIN_GAIN)}. Yours is ${money(worth)}.`;
  }
  const cashNeeded = Math.max(cost, DEVELOPMENT_MIN_CASH);
  if (p.cash < cashNeeded) {
    return cost >= DEVELOPMENT_MIN_CASH
      ? `${what} costs ${money(cost)} and you have ${money(p.cash)} in cash.`
      : `${what} costs ${money(cost)}, and you need ${money(DEVELOPMENT_MIN_CASH)} in cash to develop at all. You have ${money(p.cash)}.`;
  }
  return null;
}

/** Investor Day's discounted level: the same rules as an ordinary upgrade,
    except the price is halved and the turn's upgrade allowance is ignored. */
export function investorDayUpgradeBlockReason(s: GameState, code: string): string | null {
  if (!s.opts.companyUpgrades) return 'Company upgrades are turned off for this game.';
  if (isIpoCode(code) || !STOCK_BY_CODE[code]) return 'Only regular companies can be upgraded.';
  if (!isController(s, s.cur, code)) return `You need ${CONTROL_THRESHOLD_REGULAR}+ shares to control ${code}.`;
  const dev = developmentOf(s, code);
  if (dev.level >= MAX_DEVELOPMENT_LEVEL) return `${code} is already at Level Ⅲ.`;
  const next = UPGRADE_LEVELS[dev.level];
  return developmentGateReason(s, investorDayUpgradeCost(next.cost), `Level ${next.numeral} at half price`);
}

/** The company Investor Day would offer a discounted level on: the one the
    player controls that can take one, cheapest level first so the offer is
    the most affordable one available. */
export function investorDayUpgradeTarget(s: GameState): string | null {
  const owned = Object.keys(s.players[s.cur].shares)
    .filter((code) => !investorDayUpgradeBlockReason(s, code));
  return owned.sort((a, b) => developmentOf(s, a).level - developmentOf(s, b).level)[0] ?? null;
}

/** Why the current player can't buy a shield for `code` right now, or null. */
export function shieldBlockReason(s: GameState, code: string): string | null {
  if (!s.opts.companyUpgrades) return 'Company upgrades are turned off for this game.';
  if (isIpoCode(code) || !STOCK_BY_CODE[code]) return 'Only regular companies can be protected.';
  if (!isController(s, s.cur, code)) return `You need ${CONTROL_THRESHOLD_REGULAR}+ shares to control ${code}.`;
  if (developmentOf(s, code).shieldActive) return `${code} already has an active shield.`;
  if (!canMarketSell(s)) return 'Roll and resolve every required action first.';
  const gate = developmentGateReason(s, SHIELD_COST, 'A shield');
  if (gate) return gate;
  return null;
}

/** Buying a level. Investor Day buys at half price and does not spend the
    turn's one upgrade — the space is the opportunity, not the allowance. */
export function upgradeCompany(
  s: GameState,
  code: string,
  opts: { discounted?: boolean; useTurnAllowance?: boolean } = {},
): void {
  const { discounted = false, useTurnAllowance = true } = opts;
  if (discounted ? investorDayUpgradeBlockReason(s, code) : upgradeBlockReason(s, code)) return;
  const p = s.players[s.cur];
  const dev = { ...developmentOf(s, code) };
  const next = UPGRADE_LEVELS[dev.level];
  const cost = discounted ? investorDayUpgradeCost(next.cost) : next.cost;
  p.cash -= cost;
  dev.level = next.level;
  dev.fundedBy = s.cur;
  // Refunds on losing control return a share of what was actually paid, so a
  // discounted level adds only its discounted price here.
  dev.totalInvested += cost;
  s.development[code] = dev;
  if (useTurnAllowance) s.upgradedThisTurn = true;
  addLog(s, `${p.name} upgrades ${code} to Level ${next.numeral} for ${money(cost)}${discounted ? ' — Investor Day half price' : ''}.`, 'g');
  addLog(s, `${code} Level ${next.numeral} adds ${money(next.marketOpenBonus)} at ${p.name}'s next Market Open.`, 'g');
}

export function buyMarketProtection(s: GameState, code: string): void {
  if (shieldBlockReason(s, code)) return;
  const p = s.players[s.cur];
  const dev = { ...developmentOf(s, code) };
  p.cash -= SHIELD_COST;
  dev.shieldActive = true;
  dev.fundedBy = s.cur;
  s.development[code] = dev;
  addLog(s, `${p.name} buys Market Protection for ${code} (${money(SHIELD_COST)}).`, 'g');
}

// ── Control loss ────────────────────────────────────────────────────────────

/**
 * Reset every developed company whose funder no longer controls it, paying the
 * 40% refund. Run after every action rather than at each share-moving call
 * site, so no sale, trade, forced sale, or auction path can be missed.
 *
 * With 11 shares a company can only ever have one 6+ holder, so "another player
 * became Controller" and "ownership became contested" both imply the funder
 * dropped below 6 — one check covers all three loss cases in the plan.
 */
export function enforceDevelopmentControl(s: GameState): void {
  if (!s.development) return;
  for (const [code, dev] of Object.entries(s.development)) {
    if (dev.fundedBy == null) continue;
    if (isController(s, dev.fundedBy, code)) continue;
    const funder = s.players[dev.fundedBy];
    const refund = developmentRefund(dev.totalInvested);
    const prior = upgradeLevel(dev.level as DevelopmentLevel);
    if (funder && refund > 0) funder.cash += refund;
    if (funder) {
      const what = prior ? `Level ${prior.numeral} resets` : 'its Market Protection is removed';
      addLog(s, `${funder.name} loses control of ${code}. ${what}${refund > 0 ? `; ${funder.name} receives a ${money(refund)} development refund` : ''}.`, 'r');
    }
    s.development[code] = { ...BASE };
  }
}

// ── Market Open ─────────────────────────────────────────────────────────────

/** Flat Market Open bonus from every company this player funded. Not
    multiplied by dividends, Controller status, price, or Market Conditions. */
export function developmentMarketOpenBonus(s: GameState, player: number): { total: number; codes: string[] } {
  let total = 0;
  const codes: string[] = [];
  for (const [code, dev] of Object.entries(s.development ?? {})) {
    if (dev.fundedBy !== player || dev.level === 0) continue;
    if (!isController(s, player, code)) continue;
    total += upgradeLevel(dev.level as DevelopmentLevel)!.marketOpenBonus;
    codes.push(code);
  }
  return { total, codes };
}

/** Flat Payout Claim bonus for a company's current level. */
export function developmentClaimBonus(s: GameState, code: string): number {
  return upgradeLevel(developmentOf(s, code).level as DevelopmentLevel)?.claimBonus ?? 0;
}

// ── Downside protection (called from applyPriceMove) ────────────────────────

/**
 * Apply upgrade downside reduction and the Market Protection shield to a move,
 * returning the basis points that should actually be applied. Order is fixed by
 * the plan: reduction first, then the shield on whatever real decline remains,
 * then (in the caller) grid rounding and the floor.
 *
 * The shield is consumed only when there was a real decline to prevent — the
 * reduced move would actually have lowered the price. A company sitting on the
 * floor therefore keeps its shield.
 */
export function protectMove(s: GameState, code: string, before: number, bp: number, source: PriceMoveSource): number {
  if (bp >= 0 || !SHIELDABLE_SOURCES.has(source)) return bp;
  const dev = s.development?.[code];
  if (!dev || (dev.level === 0 && !dev.shieldActive)) return bp;

  let result = bp;
  const def = upgradeLevel(dev.level as DevelopmentLevel);
  if (def) {
    // Remove a share of the decline; a decline shrinks but never flips to a rise.
    result = Math.min(0, Math.round(bp * (1 - def.downsidePct / 100)));
    const label = PRICE_MOVE_SOURCE_LABEL[source];
    addLog(s, result === 0
      ? `${code} Level ${def.numeral} resilience fully absorbs a ${pctBp(bp / 100)} ${label}.`
      : `${code} reduces a ${pctBp(bp / 100)} ${label} to ${pctBp(result / 100)} through Level ${def.numeral} resilience.`, 'g');
  }

  if (result < 0 && dev.shieldActive && applyBasisPoints(before, result) < before) {
    const absorbed = Math.min(SHIELD_ABSORB_BP, -result);
    result += absorbed;
    s.development[code] = { ...dev, shieldActive: false };
    addLog(s, `${code} Market Protection absorbs ${moveSize(absorbed)} of the remaining decline.`, 'g');
  }
  return result;
}
