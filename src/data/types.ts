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
  | 'open' | 'stock' | 'event' | 'fed' | 'ipo' | 'rateDecision'
  | 'regime' // combined Bull/Bear space (2026-09-18 board redesign) — landing here rolls a d6 to pick one, see actionResolver.ts's 'regime'/'rollRegime' cases
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
// "all Finance stocks" etc. means on existing cards. A Sector Control group
// now sits inside one sector (2026-09-20), so the board's colour blocks and
// the groups you can control are the same thing.
export type SectorPairId =
  | 'techSentinels' | 'consumerStaples' | 'healthEssentials' | 'healthInnovation'
  | 'energyComplex' | 'realEstateHoldings' | 'heavyIndustry' | 'mediaGames'
  | 'financialDistrict';

export interface SectorPair {
  id: SectorPairId;
  name: string;
  tier: Risk;
  rent: number;
  /** Every company in the group — two for the two-company sectors and for
      each half of Healthcare, three for a three-company sector. */
  codes: readonly string[];
  color: string;
}

export interface Stock {
  code: string;        // ticker, e.g. 'CCAI'
  name: string;
  sector: SectorId;
  base: number;        // opening share price in dollars — the company's live price starts here
  risk: Risk;
  space: number;       // board space 1..36
  color: string;       // sector color (denormalized for convenience)
  div: number;         // printed dividend per share (placeholder: derived from risk)
  tier: CompanyTier;   // fixed acquisition-price tier while the company is untouched
}

export interface IpoDef {
  code: string;
  name: string;
  sector: SectorId;
  start: number;       // starting price (dollars)
  div: number;         // printed dividend per share
  vol: Volatility;     // volatility tier (amplifies event moves for high/spec)
  color: string;
}

// Card effect kinds. The engine interprets these.
// Price-moving effects carry `bp` — a basis-point move (100 bp = 1%), not the
// old ladder-step delta. The field was renamed along with the unit change so
// no call site could keep reading a step count as though nothing had moved;
// the decks' former ±1/±2 steps map to ±500/±1,000 bp.
export type Effect =
  | { k: 'sector'; sec: SectorId; bp: number }
  | { k: 'all'; bp: number; crash?: boolean }
  | { k: 'risk'; risk: Risk; bp: number }
  | { k: 'multi'; m: Array<{ sec?: SectorId; risk?: Risk; bp: number }> }
  | { k: 'lowest'; bp: number }
  | { k: 'highest'; bp: number }
  | { k: 'pick'; bp: number; label: string }
  | { k: 'dividend' }
  | { k: 'cyberattack' }
  | { k: 'openingBell' }
  | { k: 'regulatoryInvestigation' }
  | { k: 'regime'; regime: 'bull' | 'bear' }
  | { k: 'circuitBreaker' }
  | { k: 'extend' }
  | { k: 'close' }
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
  // Bank Rate change (bp) this card makes when it resolves (Fed cards only).
  // Its price effect is then the rate shock — see data/rates.ts.
  rateBp?: number;
  // True when the card's whole price effect IS that rate shock, so a change
  // clamped by the rate's floor or ceiling shrinks the price moves to match.
  rateShock?: true;
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
