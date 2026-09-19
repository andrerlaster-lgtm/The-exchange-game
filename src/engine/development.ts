// Company development: upgrades, Market Protection shields, control-loss
// refunds, and the downside protection applied inside applyPriceMove.
// Runs on Immer drafts.

import {
  CONTROL_THRESHOLD_REGULAR, MAX_DEVELOPMENT_LEVEL, SHIELD_ABSORB_BP, SHIELD_COST,
  DEVELOPMENT_MIN_CASH_AFTER, SHIELDABLE_SOURCES, STOCK_BY_CODE, UPGRADE_LEVELS, applyBasisPoints,
  developmentRefund, isIpoCode, upgradeLevel,
} from '../data';
import type { DevelopmentLevel, PriceMoveSource } from '../data';
import { money, pct } from '../utils/formatMoney';
import type { CompanyDevelopment, GameState, LogKind } from './types';
import { canMarketSell } from './rules';

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

const SOURCE_LABEL: Record<PriceMoveSource, string> = {
  weakDemand: 'Weak Demand', strongDemand: 'Strong Demand', marketMeter: 'Market Meter',
  marketEvent: 'Market Event', fedCard: 'Fed card', bullRun: 'Bull Run', bearRun: 'Bear Run',
  bankSale: 'bank sale', voluntarySale: 'sale', cyberattackChoice: 'Cyberattack penalty',
  regulatoryChoice: 'Regulatory penalty', investorDay: 'Investor Day',
};

// ── Purchase eligibility ────────────────────────────────────────────────────

/** Why the current player can't upgrade `code` right now, or null if they can. */
export function upgradeBlockReason(s: GameState, code: string): string | null {
  if (isIpoCode(code) || !STOCK_BY_CODE[code]) return 'Only regular companies can be upgraded.';
  if (!isController(s, s.cur, code)) return `You need ${CONTROL_THRESHOLD_REGULAR}+ shares to control ${code}.`;
  const dev = developmentOf(s, code);
  if (dev.level >= MAX_DEVELOPMENT_LEVEL) return `${code} is already at Level Ⅲ.`;
  if (s.upgradedThisTurn) return 'You have already bought an upgrade this turn.';
  if (!canMarketSell(s)) return 'Roll and resolve every required action first.';
  const next = UPGRADE_LEVELS[dev.level];
  if (s.players[s.cur].cash - next.cost < DEVELOPMENT_MIN_CASH_AFTER) {
    return `Level ${next.numeral} costs ${money(next.cost)}, and you must keep ${money(DEVELOPMENT_MIN_CASH_AFTER)} in cash after upgrading (need ${money(next.cost + DEVELOPMENT_MIN_CASH_AFTER)}).`;
  }
  return null;
}

/** Why the current player can't buy a shield for `code` right now, or null. */
export function shieldBlockReason(s: GameState, code: string): string | null {
  if (isIpoCode(code) || !STOCK_BY_CODE[code]) return 'Only regular companies can be protected.';
  if (!isController(s, s.cur, code)) return `You need ${CONTROL_THRESHOLD_REGULAR}+ shares to control ${code}.`;
  if (developmentOf(s, code).shieldActive) return `${code} already has an active shield.`;
  if (!canMarketSell(s)) return 'Roll and resolve every required action first.';
  if (s.players[s.cur].cash - SHIELD_COST < DEVELOPMENT_MIN_CASH_AFTER) {
    return `A shield costs ${money(SHIELD_COST)}, and you must keep ${money(DEVELOPMENT_MIN_CASH_AFTER)} in cash after buying it (need ${money(SHIELD_COST + DEVELOPMENT_MIN_CASH_AFTER)}).`;
  }
  return null;
}

export function upgradeCompany(s: GameState, code: string): void {
  if (upgradeBlockReason(s, code)) return;
  const p = s.players[s.cur];
  const dev = { ...developmentOf(s, code) };
  const next = UPGRADE_LEVELS[dev.level];
  p.cash -= next.cost;
  dev.level = next.level;
  dev.fundedBy = s.cur;
  dev.totalInvested += next.cost;
  s.development[code] = dev;
  s.upgradedThisTurn = true;
  addLog(s, `${p.name} upgrades ${code} to Level ${next.numeral} for ${money(next.cost)}.`, 'g');
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
    const label = SOURCE_LABEL[source];
    addLog(s, result === 0
      ? `${code} Level ${def.numeral} resilience fully absorbs a ${pct(bp / 100)} ${label}.`
      : `${code} reduces a ${pct(bp / 100)} ${label} to ${pct(result / 100)} through Level ${def.numeral} resilience.`, 'g');
  }

  if (result < 0 && dev.shieldActive && applyBasisPoints(before, result) < before) {
    const absorbed = Math.min(SHIELD_ABSORB_BP, -result);
    result += absorbed;
    s.development[code] = { ...dev, shieldActive: false };
    addLog(s, `${code} Market Protection absorbs ${pct(absorbed / 100).replace('+', '')} of the remaining decline.`, 'g');
  }
  return result;
}
