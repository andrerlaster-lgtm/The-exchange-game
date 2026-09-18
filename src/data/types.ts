// Shared domain types for THE EXCHANGE.
// Static data uses these; the engine state (see engine/types.ts) builds on them.

export type Risk = 'Low' | 'Med' | 'High';

export type CompanyTier = 'Starter' | 'Growth' | 'Premium';

export type SectorId =
  | 'tech' | 'consumer' | 'health' | 'energy'
  | 'finance' | 'realestate' | 'industrials' | 'comm';

export type DeckId = 'ME' | 'FED';

export type Volatility = 'mod' | 'high' | 'spec';

export type SpaceType =
  | 'open' | 'stock' | 'event' | 'fed' | 'ipo'
  | 'bull' | 'bear'
  | 'tax' | 'free' | 'short' | 'investor' | 'placeholder'
  | 'etf' | 'audit';

export interface Sector {
  id: SectorId;
  name: string;
  color: string;
  glyph: string;
}

// Sector Control: an independent 2-company pairing layered on top of the
// broad 8-category Sector map above. Deliberately a separate id space —
// the broad SectorId groups (3-4 companies each) drive Market Event/Fed
// card targeting and Diversified/Broad Market bonuses, and reshuffling
// those to make every group exactly 2 companies would silently change what
// "all Finance stocks" etc. means on existing cards. Sector Control pairs
// instead cut across those groups purely for the landing-rent mechanic.
export type SectorPairId =
  | 'techSentinels' | 'consumerStaples' | 'healthEssentials' | 'healthInnovation'
  | 'energyComplex' | 'realEstateHoldings' | 'heavyIndustry' | 'mediaGames'
  | 'blueChipAlliance' | 'capitalGrowth' | 'speculativePlays';

export interface SectorPair {
  id: SectorPairId;
  name: string;
  tier: Risk;
  rent: number;
  codes: [string, string];
  color: string;
}

export interface Stock {
  code: string;        // ticker, e.g. 'CCAI'
  name: string;
  sector: SectorId;
  base: number;        // tier-aligned opening share price — defines starting ladder step
  risk: Risk;
  space: number;       // board space 1..36
  step: number;        // starting ladder step index (0..11)
  color: string;       // sector color (denormalized for convenience)
  div: number;         // printed dividend per share (placeholder: derived from risk)
  tier: CompanyTier;   // fixed acquisition-price tier while the company is untouched
}

export interface IpoDef {
  code: string;
  name: string;
  sector: SectorId;
  start: number;       // starting price (dollars)
  startStep: number;   // starting ladder step index (0..11)
  div: number;         // printed dividend per share
  vol: Volatility;     // volatility tier (amplifies event moves for high/spec)
  color: string;
}

// Card effect kinds. The engine interprets these.
export type Effect =
  | { k: 'sector'; sec: SectorId; d: number }
  | { k: 'all'; d: number; crash?: boolean }
  | { k: 'risk'; risk: Risk; d: number }
  | { k: 'multi'; m: Array<{ sec?: SectorId; risk?: Risk; d: number }> }
  | { k: 'lowest'; d: number }
  | { k: 'highest'; d: number }
  | { k: 'pick'; d: number; label: string }
  | { k: 'dividend' }
  | { k: 'cyberattack' }
  | { k: 'openingBell' }
  | { k: 'regulatoryInvestigation' }
  | { k: 'regime'; regime: 'bull' | 'bear' }
  | { k: 'circuitBreaker' }
  | { k: 'extend' }
  | { k: 'close' }
  | { k: 'meterDelta'; delta: number }         // 2026-08-21 Market Overhaul: additive, clamped meter move, no price change
  | { k: 'meterTowardNeutral'; amount: number } // moves the meter toward 0 by amount, never past it
  | { k: 'insiderPreview' }                     // real non-blocking peek at the next Market Event
  | { k: 'none' };

export interface Card {
  deck: DeckId;
  title: string;
  story: string;
  effect: string;       // human-readable effect text
  eff: Effect;          // machine-readable effect
  strategyOnly?: true;  // card is inactive in Fast Prototype Mode
  // Meter sentiment this card applies ONCE, after its immediate price effect
  // resolves — independent of `eff`'s own kind. Undefined/0 means no meter
  // effect. Never triggers the round-boundary repricing routine itself.
  meterSentiment?: number;
  signal?: {
    stance: 'hawkish' | 'dovish' | 'neutral' | 'mixed';
    insight: string;
  };
}

export interface BoardSpace {
  n: number;          // 1..36
  type: SpaceType;
  code?: string;      // for stock spaces
  name?: string;      // for special spaces
  glyph?: string;
  color?: string;
  corner?: boolean;
}

export interface DeckMeta {
  label: string;
  glyph: string;
  color: string;
}
