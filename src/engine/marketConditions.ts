// Temporary Market Conditions — independent of the Market Event deck.
// A condition starts when a player reaches Market Open and is replaced by the
// next Market Open, so conditions never stack or permanently alter prices.

import { ETF_DEFS, IPO_BY_CODE, SECTORS, STOCK_BY_CODE } from '../data';
import type { Rng } from '../utils/rng';
import type { GameState, MarketCondition, MarketConditionId, Player } from './types';

const IDS: readonly MarketConditionId[] = [
  'sectorSpotlight', 'dividendWindfall', 'etfInflows',
  'creditTightening', 'weakDemandBargains', 'riskOff',
];

function addLog(s: GameState, text: string): void {
  s.log.unshift({ text, kind: 'b', t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

/** Pick and announce the next temporary condition. This is intentionally not
    a card draw: it never touches either deck or discard pile. */
export function beginMarketCondition(s: GameState, rng: Rng, startedBy: string): void {
  const id = IDS[rng.int(0, IDS.length - 1)];
  let condition: MarketCondition;

  switch (id) {
    case 'sectorSpotlight': {
      const sectorIds = Object.keys(SECTORS);
      const sector = sectorIds[rng.int(0, sectorIds.length - 1)];
      condition = {
        id, sector, startedBy, lap: s.lap, icon: '◆', color: '#d4a535',
        title: `${SECTORS[sector as keyof typeof SECTORS].name} Spotlight`,
        detail: 'Payout Claims on this sector pay an extra $250.',
      };
      break;
    }
    case 'dividendWindfall':
      condition = { id, startedBy, lap: s.lap, icon: '✦', color: '#4ade80', title: 'Dividend Windfall', detail: 'Dividend-paying shares earn an extra $25 per share at Market Open.' };
      break;
    case 'etfInflows':
      condition = { id, startedBy, lap: s.lap, icon: '◆', color: '#60a5fa', title: 'ETF Inflows', detail: 'Any player holding an ETF receives an extra $300 at Market Open.' };
      break;
    case 'creditTightening':
      condition = { id, startedBy, lap: s.lap, icon: '▣', color: '#f87171', title: 'Credit Tightening', detail: 'No new Margin may be taken while this condition is active.' };
      break;
    case 'weakDemandBargains':
      condition = { id, startedBy, lap: s.lap, icon: '⌄', color: '#fbbf24', title: 'Weak Demand Bargains', detail: 'Companies carrying Weak Demand markers cost 10% less to buy.' };
      break;
    case 'riskOff':
      condition = { id, startedBy, lap: s.lap, icon: '⚠', color: '#fb923c', title: 'Risk-Off', detail: 'High-risk Payout Claims are reduced by $250, to a minimum of $50.' };
      break;
  }

  const replaced = s.marketCondition ? ` ${s.marketCondition.title} ends.` : '';
  s.marketCondition = condition;
  addLog(s, `MARKET CONDITION — ${condition.title}: ${condition.detail}${replaced}`);
}

/** Extra income produced by a temporary Market Condition. Controller multipliers
    deliberately do not multiply this flat bonus. */
export function marketConditionIncome(s: GameState, player: Player): { dividend: number; etf: number } {
  if (s.marketCondition?.id === 'dividendWindfall') {
    const shares = Object.entries(player.shares).reduce((total, [code, qty]) => {
      const printed = STOCK_BY_CODE[code]?.div ?? IPO_BY_CODE[code]?.div ?? 0;
      return printed > 0 ? total + qty : total;
    }, 0);
    return { dividend: shares * 25, etf: 0 };
  }
  if (s.marketCondition?.id === 'etfInflows' && ETF_DEFS.some((fund) => (player.etfShares[fund.code] ?? 0) > 0)) {
    return { dividend: 0, etf: 300 };
  }
  return { dividend: 0, etf: 0 };
}

/** A live acquisition discount for an untouched company already marked as weak. */
export function marketConditionBuyoutDiscount(s: GameState, code: string, normalCost: number): number {
  if (s.marketCondition?.id !== 'weakDemandBargains' || (s.skips[code] ?? 0) <= 0) return normalCost;
  return Math.round(normalCost * 0.9 / 50) * 50;
}

/** Flat adjustment to the Payout Claim component, before Sector Rent is added. */
export function marketConditionClaimAdjustment(s: GameState, code: string): number {
  const stock = STOCK_BY_CODE[code];
  if (!stock) return 0;
  if (s.marketCondition?.id === 'sectorSpotlight' && s.marketCondition.sector === stock.sector) return 250;
  if (s.marketCondition?.id === 'riskOff' && stock.risk === 'High') return -250;
  return 0;
}

export function marketConditionBlocksMargin(s: GameState): boolean {
  return s.marketCondition?.id === 'creditTightening';
}
