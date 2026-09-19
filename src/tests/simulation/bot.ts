// Deterministic auto-player used by the balance simulation.
//
// Not a strategy engine: it answers whatever the engine is currently blocking
// on, using simple, seeded, non-adversarial choices, so a run measures the
// MARKET model rather than a bot's cleverness. Every decision goes through the
// seeded Rng, so a given seed replays identically.

import { blocked, ipoGrowthBlockReason, ipoPctFromLaunch, nextIpoMilestone, reduce, shieldBlockReason, upgradeBlockReason } from '../../engine';
import type { Action, GameState } from '../../engine';
import type { Rng } from '../../utils/rng';
import { ETF_PRICE, IPO_GROWTH_INVESTMENTS, SHIELD_COST, UPGRADE_LEVELS, isIpoCode } from '../../data';

/** Codes the current player owns at least one share of. */
function owned(s: GameState, player = s.cur): string[] {
  const p = s.players[player];
  return Object.keys(p.shares).filter((code) => (p.shares[code] ?? 0) > 0);
}

function pick<T>(rng: Rng, arr: readonly T[]): T | null {
  return arr.length === 0 ? null : arr[rng.int(0, arr.length - 1)];
}

/**
 * The single action that resolves whatever the engine is currently waiting on,
 * or null when nothing is pending. Order matters: it mirrors `blocked()`, so
 * the most urgent prompt is always answered first.
 */
function nextAction(s: GameState, rng: Rng): Action | null {
  if (s.pendingDraws.length > 0) return { t: 'draw', deck: s.pendingDraws[0] };
  if (s.marketOpenReport) return { t: 'dismissMarketOpenReport' };
  // A deferrable notice (audit, tax, fund fee) needs an explicit pay/defer
  // choice and ignores a plain acknowledgement. Pay only when the engine would
  // actually accept it — the notice belongs to this player and the cash covers
  // it — otherwise defer, which is what a real player is forced to do.
  if (s.landingNotice?.canDefer) {
    const notice = s.landingNotice;
    const payer = s.players[s.cur];
    const payable = payer.name === notice.player && payer.cash >= notice.amount
      && (notice.kind === 'audit' || notice.kind === 'tax' || notice.kind === 'fund');
    return payable ? { t: 'payLandingFee' } : { t: 'deferLandingFee' };
  }
  if (s.landingNotice) return { t: 'ackLandingNotice' };
  if (s.regimeRollPrompt) return { t: 'rollRegime' };
  if (s.loanRatePrompt) return { t: 'rollLoanRate' };

  // Debts are paid from cash whenever cash covers them, and stock is sold only
  // until it does. An earlier version chose "force-sell" for every Payout
  // Claim while owning any stock (even holding $26,000 against a $4,000 claim)
  // and then kept selling until it owned nothing — liquidating its whole
  // portfolio on every claim and inflating insolvency and forced-sale counts
  // in every balance run before 2026-09-19.
  const cash = s.players[s.cur].cash;
  if (s.marginCall) {
    if (cash >= s.marginCall.owed) return { t: 'payMarginCall' };
    const code = pick(rng, owned(s));
    return code ? { t: 'marginSell', code } : { t: 'payMarginCall' };
  }
  if (s.insolvency) {
    if (s.players[s.insolvency.player].cash >= s.insolvency.owed) return { t: 'payInsolvency' };
    const code = pick(rng, owned(s, s.insolvency.player).filter((c) => !isIpoCode(c)));
    return code ? { t: 'forcedSell', code } : { t: 'payInsolvency' };
  }
  if (s.payoutShortfallChoice) {
    if (cash >= s.payoutShortfallChoice.owed) return { t: 'choosePayoutPayCash' };
    return s.payoutShortfallChoice.canForceSell ? { t: 'choosePayoutForceSell' } : { t: 'choosePayoutLoan' };
  }

  if (s.circuitBreakerPrompt) return { t: 'passCircuitBreaker' };
  if (s.cyberattackPrompt) {
    const code = pick(rng, s.cyberattackPrompt.codes);
    return code ? { t: 'chooseCyberattackStock', code } : { t: 'payCyberattackFee' };
  }
  if (s.regulatoryInvestigationPrompt) {
    const code = pick(rng, s.regulatoryInvestigationPrompt.codes);
    return code ? { t: 'chooseRegulatoryInvestigationStock', code } : { t: 'payRegulatoryInvestigation' };
  }
  if (s.openingBellPrompt) return { t: 'passOpeningBell' };
  if (s.investorDay) return { t: 'chooseInvestorGrowth' };
  if (s.pick) {
    const code = pick(rng, s.pick.codes ?? []);
    return code ? { t: 'pickTarget', code } : { t: 'skipPick' };
  }

  // IPOs: buy when offered and the purchase keeps the cash cushion.
  const affordsWithCushion = (cost: number) => s.players[s.cur].cash - cost >= markets.reserve;
  const active = markets.onlyPlayers === null || markets.onlyPlayers.includes(s.cur);
  if (s.ipoListPick) {
    const options = s.ipos.filter((ip) => ip.revealed && ip.supply > 0 && affordsWithCushion(ip.price));
    const choice = markets.ipos && active ? pick(rng, options) : null;
    return choice ? { t: 'pickKnownIpo', code: choice.code } : { t: 'skipIpo' };
  }
  if (s.ipoChoice) return { t: 'skipIpo' };
  if (s.ipoBuy) {
    const b = s.ipoBuy;
    const supply = s.ipos.find((ip) => ip.code === b.code)?.supply ?? 0;
    return markets.ipos && active && b.bought < b.max && supply > 0 && affordsWithCushion(b.price)
      ? { t: 'ipoBuyShare' } : { t: 'ipoBuyDone' };
  }
  if (s.outstandingBuy) return { t: 'outstandingBuyDone' };
  if (s.etfPick) {
    return markets.etfs && active && !s.landingNotice && affordsWithCushion(ETF_PRICE) ? { t: 'buyEtf', code: s.etfPick } : { t: 'skipEtf' };
  }
  if (s.companyLoanOffer) return { t: 'takeCompanyLoan' };
  if (s.shortPick) return { t: 'skipShort' };
  if (s.auction) return { t: 'auctionPass' };

  if (s.turnPhase === 'preRoll') return { t: 'roll' };

  // A landed-on company: buy it when affordable, otherwise skip (which is what
  // feeds Weak Demand). Buying keeps companies moving into play so Payout
  // Claims, Sector Control, and Strong Demand all actually get exercised.
  const t = s.trade;
  if (t && t.scope === 'stock' && t.code && t.actionsLeft > 0) {
    const code = t.code;
    const affordable = s.players[s.cur].cash >= 11 * (s.prices[code] ?? 0);
    return affordable ? { t: 'buy', code } : { t: 'skipStock', code };
  }

  // Company development, once everything required is resolved: upgrade a
  // controlled company when the purchase still leaves a cash cushion, and
  // sometimes buy a shield. The cushion keeps the bot from upgrading itself
  // into the very Payout Claim shortfalls the simulation is measuring.
  if (!blocked(s) && development.enabled && (development.onlyPlayers === null || development.onlyPlayers.includes(s.cur))) {
    const cash = s.players[s.cur].cash;
    for (const code of owned(s)) {
      if (!upgradeBlockReason(s, code)) {
        const cost = UPGRADE_LEVELS[s.development[code].level].cost;
        if (cash - cost >= development.reserve) return { t: 'upgradeCompany', code };
      }
      if (development.shields && !shieldBlockReason(s, code) && cash - SHIELD_COST >= development.reserve && rng.int(0, 3) === 0) {
        return { t: 'buyMarketProtection', code };
      }
    }
  }

  // IPO growth: fund the held IPO closest to its next milestone, if the
  // investment keeps the cash cushion. One per turn (the engine enforces it).
  const growthActive = markets.growthPlayers === null || markets.growthPlayers.includes(s.cur);
  if (!blocked(s) && markets.ipoGrowth && active && growthActive) {
    const held = owned(s).filter((c) => isIpoCode(c) && !ipoGrowthBlockReason(s, c, 'major'));
    const target = held
      .map((c) => ({ c, gap: (nextIpoMilestone(s, c)?.pct ?? Infinity) - ipoPctFromLaunch(s, c) }))
      .filter((x) => Number.isFinite(x.gap))
      .sort((a, b) => a.gap - b.gap)[0];
    // `growthOnlyToTrigger`: invest only when one Major investment's +5% would
    // reach the next milestone — the way a player would use it to cash one in.
    const worthIt = target && (!markets.growthOnlyToTrigger || target.gap <= IPO_GROWTH_INVESTMENTS.major.bp / 100);
    if (target && worthIt && affordsWithCushion(IPO_GROWTH_INVESTMENTS.major.cost)) {
      return { t: 'investIpoGrowth', code: target.c, size: 'major' };
    }
  }

  if (!blocked(s)) return { t: 'endTurn' };
  return null;
}

/** Buying policy for IPOs, ETFs, and IPO growth (switchable for sweeps). */
export const markets = {
  etfs: true,
  ipos: true,
  ipoGrowth: true,
  reserve: 6_000,
  // Restrict ETF/IPO/growth activity to these seats (null = everyone), for
  // paired "does this pay for the player who does it" runs.
  onlyPlayers: null as number[] | null,
  // Separately restrict IPO growth investing, so a run can compare growth vs
  // no growth for a player who buys IPOs either way.
  growthPlayers: null as number[] | null,
  // Invest in IPO growth only when it would tip the IPO over its next milestone.
  growthOnlyToTrigger: false,
};

/** Development policy for a simulation run. */
export const development = {
  enabled: true,
  shields: true,
  reserve: 6_000,
  // Restrict development to these seats (null = everyone), so a run can measure
  // whether upgrading pays for the player who does it, not just the table.
  onlyPlayers: null as number[] | null,
};

/** Called after every accepted action, for measurement. */
export type Observer = (before: GameState, action: Action, after: GameState) => void;

/**
 * Play one turn to completion. Returns the state after End Turn.
 *
 * `decisionRng` gives the bot's own choices (which code to pick, whether to buy
 * a shield) a separate random stream from the engine's dice and cards. Without
 * it, a single extra bot action shifts every later die roll, so two runs of the
 * "same" seed that differ only in one policy play out as unrelated games — a
 * paired comparison then measures dice luck, not the policy. A null test showed
 * that noise alone produced average net-worth gaps up to $8,000.
 */
export function playTurn(s: GameState, rng: Rng, observe?: Observer, decisionRng: Rng = rng): GameState {
  let state = s;
  const startingPlayer = state.cur;
  // Generous guard: a single turn can chain several prompts (card -> pick ->
  // circuit breaker -> notice), plus doubles re-rolls.
  for (let i = 0; i < 200; i += 1) {
    const action = nextAction(state, decisionRng);
    if (!action) break;
    const next = reduce(state, action, rng);
    // A no-op means the bot asked for something the engine rejected; stop
    // rather than spinning, so a run can never hang silently.
    if (next === state) break;
    observe?.(state, action, next);
    state = next;
    if (state.cur !== startingPlayer || state.phase === 'over') break;
  }
  return state;
}
