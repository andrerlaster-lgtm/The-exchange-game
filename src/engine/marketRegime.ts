import type { MarketStance, Player } from './types';

export type MarketRegime = 'bull' | 'bear';

export interface MarketStanceMeta {
  label: 'Bullish' | 'Balanced' | 'Bearish';
  glyph: '🐂' | '⚖' | '🐻';
  color: string;
}

const STANCE_META: Record<MarketStance, MarketStanceMeta> = {
  bullish: { label: 'Bullish', glyph: '🐂', color: '#3ed598' },
  balanced: { label: 'Balanced', glyph: '⚖', color: '#d4a535' },
  bearish: { label: 'Bearish', glyph: '🐻', color: '#ef4444' },
};

const REGIME_CASH: Record<MarketRegime, Record<MarketStance, number>> = {
  bull: { bullish: 1_500, balanced: 500, bearish: -750 },
  bear: { bullish: -1_500, balanced: -500, bearish: 1_500 },
};

export function marketStanceMeta(stance: MarketStance): MarketStanceMeta {
  return STANCE_META[stance];
}

export function regimeCashDelta(stance: MarketStance, regime: MarketRegime): number {
  return REGIME_CASH[regime][stance];
}

/** The latest qualifying action sets the position held for the next regime card. */
export function setMarketStance(player: Player, stance: Exclude<MarketStance, 'balanced'>): void {
  player.marketStance = stance;
}
