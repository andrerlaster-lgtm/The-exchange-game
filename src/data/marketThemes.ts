import type { SectorId } from './types';

/** A one-round investment environment. Its outlook is public while players
 * trade; it resolves at the end of that round. */
export interface MarketThemeDef {
  id: string;
  name: string;
  tailwinds: SectorId[];
  headwinds: SectorId[];
}

export const MARKET_THEMES: readonly MarketThemeDef[] = [
  { id: 'growth-rotation', name: 'Growth Rotation', tailwinds: ['tech', 'finance', 'comm'], headwinds: ['consumer', 'realestate'] },
  { id: 'defensive-rotation', name: 'Defensive Rotation', tailwinds: ['health', 'consumer', 'realestate'], headwinds: ['tech', 'comm'] },
  { id: 'energy-shock', name: 'Energy Shock', tailwinds: ['energy', 'industrials'], headwinds: ['consumer', 'realestate'] },
  { id: 'infrastructure-boom', name: 'Infrastructure Boom', tailwinds: ['industrials', 'energy', 'finance'], headwinds: ['consumer', 'comm'] },
  { id: 'credit-tightening', name: 'Credit Tightening', tailwinds: ['finance', 'consumer'], headwinds: ['tech', 'realestate'] },
  { id: 'healthcare-breakthrough', name: 'Healthcare Breakthrough', tailwinds: ['health', 'tech'], headwinds: ['energy', 'consumer'] },
];
