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
  | 'tax' | 'free' | 'short' | 'investor' | 'placeholder'
  | 'etf' | 'audit';

export interface Sector {
  id: SectorId;
  name: string;
  color: string;
  glyph: string;
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
  buyout: number;      // fixed cost to acquire all 11 shares and the Payout Claim
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
  | { k: 'cash'; amt: number }
  | { k: 'margin'; amt: number }
  | { k: 'circuitBreaker' }
  | { k: 'extend' }
  | { k: 'close' }
  | { k: 'none' };

export interface Card {
  deck: DeckId;
  title: string;
  story: string;
  effect: string;       // human-readable effect text
  eff: Effect;          // machine-readable effect
  strategyOnly?: true;  // card is inactive in Fast Prototype Mode
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
