// Deterministic auto-player used by the balance simulation.
//
// Not a strategy engine: it answers whatever the engine is currently blocking
// on, using simple, seeded, non-adversarial choices, so a run measures the
// MARKET model rather than a bot's cleverness. Every decision goes through the
// seeded Rng, so a given seed replays identically.

import { blocked, reduce, shieldBlockReason, upgradeBlockReason } from '../../engine';
import type { Action, GameState } from '../../engine';
import type { Rng } from '../../utils/rng';
import { SHIELD_COST, UPGRADE_LEVELS } from '../../data';

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

  if (s.marginCall) {
    const code = pick(rng, owned(s));
    return code ? { t: 'marginSell', code } : { t: 'payMarginCall' };
  }
  if (s.insolvency) {
    const code = pick(rng, owned(s));
    return code ? { t: 'forcedSell', code } : { t: 'payInsolvency' };
  }
  if (s.payoutShortfallChoice) {
    return owned(s).length > 0 ? { t: 'choosePayoutForceSell' } : { t: 'choosePayoutLoan' };
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

  if (s.ipoChoice || s.ipoListPick) return { t: 'skipIpo' };
  if (s.ipoBuy) return { t: 'ipoBuyDone' };
  if (s.outstandingBuy) return { t: 'outstandingBuyDone' };
  if (s.etfPick) return { t: 'skipEtf' };
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
  if (!blocked(s) && development.enabled) {
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

  if (!blocked(s)) return { t: 'endTurn' };
  return null;
}

/** Development policy for a simulation run. */
export const development = { enabled: true, shields: true, reserve: 6_000 };

/** Called after every accepted action, for measurement. */
export type Observer = (before: GameState, action: Action, after: GameState) => void;

/** Play one turn to completion. Returns the state after End Turn. */
export function playTurn(s: GameState, rng: Rng, observe?: Observer): GameState {
  let state = s;
  const startingPlayer = state.cur;
  // Generous guard: a single turn can chain several prompts (card -> pick ->
  // circuit breaker -> notice), plus doubles re-rolls.
  for (let i = 0; i < 200; i += 1) {
    const action = nextAction(state, rng);
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
