// Personal Market Conditions — independent of the Market Event deck. Each
// player has their own slot (GameState.marketConditions[playerIdx]); a
// condition belongs exclusively to the player who triggered it and never
// affects anyone else, and one player's reroll never touches another
// player's still-active condition. (2026-09-18 redesign: this used to be a
// single s.marketCondition shared by the whole table, rerolled by whoever
// next reached Market Open — see git history for the old shared version.)

import { ETF_DEFS, IPO_BY_CODE, SECTORS, STOCK_BY_CODE } from '../data';
import type { Rng } from '../utils/rng';
import type { GameState, MarketCondition, MarketConditionId } from './types';

const IDS: readonly MarketConditionId[] = [
  'sectorSpotlight', 'dividendWindfall', 'etfInflows',
  'creditTightening', 'weakDemandBargains', 'riskOff', 'tollHike',
];


// Doubles Sector Control's flat per-tier rent ($200/$350/$550 -> $400/$700/
// $1,100) the OWNER collects, if they control a pair, while active.
export const TOLL_HIKE_MULTIPLIER = 2;

/**
 * How long each condition lasts, once it's personal to one player:
 * - 'turns': counts down by 1 each time the OWNER ends one of their own
 *   turns (bonus doubles rolls don't count as a separate turn). These are
 *   all situational — they only matter if the owner happens to trigger the
 *   right landing/purchase/loan within the window — so the window is short.
 * - 'rounds': counts down by 1 each time the OWNER reaches their OWN Market
 *   Open (passing or landing). These only ever pay off at Market Open, so
 *   "how many turns" doesn't apply — they get a number of paydays instead.
 * A condition is NOT automatically replaced just because the owner reaches
 * Market Open again — see ensureMarketCondition: a still-active condition
 * keeps running (and 'rounds' ones decrement) until it actually expires,
 * at which point the owner's next Market Open rolls a fresh one.
 */
const CONDITION_DURATION: Record<MarketConditionId, { unit: 'turns' | 'rounds'; amount: number }> = {
  sectorSpotlight:    { unit: 'turns', amount: 5 },
  weakDemandBargains: { unit: 'turns', amount: 5 },
  riskOff:            { unit: 'turns', amount: 5 },
  tollHike:           { unit: 'turns', amount: 5 },
  creditTightening:   { unit: 'turns', amount: 5 },
  dividendWindfall:   { unit: 'rounds', amount: 2 },
  etfInflows:         { unit: 'rounds', amount: 2 },
};

function addLog(s: GameState, text: string, kind: 'b' | 'y' = 'b'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

function conditionFor(s: GameState, pi: number): MarketCondition | null {
  return s.marketConditions[pi] ?? null;
}

function durationLabel(unit: 'turns' | 'rounds', amount: number): string {
  return unit === 'turns' ? `${amount} of your turns` : `your next ${amount} Market Open pass${amount === 1 ? '' : 'es'}`;
}

/** Roll and announce a brand-new condition, personal to player `pi`,
    replacing whatever (if anything, e.g. one that just expired) was there. */
function rollNewCondition(s: GameState, rng: Rng, pi: number): void {
  const id = IDS[rng.int(0, IDS.length - 1)];
  const { unit, amount } = CONDITION_DURATION[id];
  const base = { owner: pi, lap: s.lap, durationUnit: unit, remaining: amount };
  let condition: MarketCondition;

  switch (id) {
    case 'sectorSpotlight': {
      const sectorIds = Object.keys(SECTORS);
      const sector = sectorIds[rng.int(0, sectorIds.length - 1)];
      condition = {
        ...base, id, sector, icon: '◆', color: '#d4a535',
        title: `${SECTORS[sector as keyof typeof SECTORS].name} Spotlight`,
        detail: 'Your own Payout Claims in this sector pay you an extra $250.',
      };
      break;
    }
    case 'dividendWindfall':
      condition = { ...base, id, icon: '✦', color: '#4ade80', title: 'Dividend Windfall', detail: 'Your dividend-paying shares earn an extra $25 per share at your Market Open.' };
      break;
    case 'etfInflows':
      condition = { ...base, id, icon: '◆', color: '#60a5fa', title: 'ETF Inflows', detail: 'If you hold any ETF, you receive an extra $300 at your Market Open.' };
      break;
    case 'creditTightening':
      condition = { ...base, id, icon: '▣', color: '#f87171', title: 'Credit Tightening', detail: `You personally cannot take new Margin; if you negotiate a Payout Claim loan as debtor, you borrow at the Bank Rate with no premium.` };
      break;
    case 'weakDemandBargains':
      condition = { ...base, id, icon: '⌄', color: '#fbbf24', title: 'Weak Demand Bargains', detail: 'You get 10% off buying any company carrying a Weak Demand marker.' };
      break;
    case 'riskOff':
      condition = { ...base, id, icon: '⚠', color: '#fb923c', title: 'Risk-Off', detail: 'Your own High-risk Payout Claims pay you $250 less, to a minimum of $50.' };
      break;
    case 'tollHike':
      condition = { ...base, id, icon: '▲', color: '#f472b6', title: 'Toll Hike', detail: 'Sector Control rent you collect is doubled ($400/$700/$1,100).' };
      break;
  }

  s.marketConditions[pi] = condition;
  addLog(s, `${s.players[pi].name} — MARKET CONDITION: ${condition.title} (${durationLabel(unit, amount)}). ${condition.detail}`);
}

/** Called whenever player `pi` reaches Market Open. If they have no active
    condition (never had one, or their last one already expired), roll a
    fresh one. If they still have one running, it just continues — reaching
    Market Open is not itself a reroll trigger anymore — but a 'rounds'
    condition counts this pass toward its remaining life and may expire. */
export function ensureMarketCondition(s: GameState, rng: Rng, pi: number): void {
  const current = conditionFor(s, pi);
  if (!current) {
    rollNewCondition(s, rng, pi);
    return;
  }
  if (current.durationUnit === 'rounds') {
    current.remaining -= 1;
    if (current.remaining <= 0) {
      addLog(s, `${s.players[pi].name}'s ${current.title} ends.`, 'b');
      s.marketConditions[pi] = null;
    }
  }
}

/** Called when player `pi` ends one of their own turns (not a doubles bonus
    roll continuation). Ticks down a 'turns' condition and expires it at 0. */
export function tickMarketConditionTurn(s: GameState, pi: number): void {
  const current = conditionFor(s, pi);
  if (!current || current.durationUnit !== 'turns') return;
  current.remaining -= 1;
  if (current.remaining <= 0) {
    addLog(s, `${s.players[pi].name}'s ${current.title} ends.`, 'b');
    s.marketConditions[pi] = null;
  }
}

/** Extra income produced by player `pi`'s own condition, if any. Controller
    multipliers deliberately do not multiply this flat bonus. */
export function marketConditionIncome(s: GameState, pi: number): { dividend: number; etf: number } {
  const c = conditionFor(s, pi);
  const player = s.players[pi];
  if (c?.id === 'dividendWindfall') {
    const shares = Object.entries(player.shares).reduce((total, [code, qty]) => {
      const printed = STOCK_BY_CODE[code]?.div ?? IPO_BY_CODE[code]?.div ?? 0;
      return printed > 0 ? total + qty : total;
    }, 0);
    return { dividend: shares * 25, etf: 0 };
  }
  if (c?.id === 'etfInflows' && ETF_DEFS.some((fund) => (player.etfShares[fund.code] ?? 0) > 0)) {
    return { dividend: 0, etf: 300 };
  }
  return { dividend: 0, etf: 0 };
}

/** A live acquisition discount for player `pi`, if they're buying an
    untouched company already marked as weak and Weak Demand Bargains is
    their own active condition. */
export function marketConditionBuyoutDiscount(s: GameState, pi: number, code: string, normalCost: number): number {
  const c = conditionFor(s, pi);
  if (c?.id !== 'weakDemandBargains' || (s.skips[code] ?? 0) <= 0) return normalCost;
  return Math.round(normalCost * 0.9 / 50) * 50;
}

/** Flat adjustment to the Payout Claim component, before Sector Rent is
    added — based on the CLAIM HOLDER's (`holderIdx`) own condition, since
    Sector Spotlight/Risk-Off change what the holder receives, not what the
    landing player owes. */
export function marketConditionClaimAdjustment(s: GameState, holderIdx: number, code: string): number {
  const c = conditionFor(s, holderIdx);
  const stock = STOCK_BY_CODE[code];
  if (!stock || !c) return 0;
  if (c.id === 'sectorSpotlight' && c.sector === stock.sector) return 250;
  if (c.id === 'riskOff' && stock.risk === 'High') return -250;
  return 0;
}

export function marketConditionBlocksMargin(s: GameState, pi: number): boolean {
  return conditionFor(s, pi)?.id === 'creditTightening';
}

/** Credit Tightening's standard-mode effect (its Margin block is a no-op
    while Margin is off): the owner, as debtor, borrows at the Bank Rate with
    no rolled premium. */
export function marketConditionWaivesLoanPremium(s: GameState, debtorIdx: number): boolean {
  return conditionFor(s, debtorIdx)?.id === 'creditTightening';
}

/** Sector Control rent multiplier for the pair CONTROLLER (`controllerIdx`)
    collecting it — doubled while Toll Hike is their own active condition. */
export function marketConditionSectorRentMultiplier(s: GameState, controllerIdx: number): number {
  return conditionFor(s, controllerIdx)?.id === 'tollHike' ? TOLL_HIKE_MULTIPLIER : 1;
}
