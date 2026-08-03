import type { CompanyTier, Risk, Sector, SectorId, Stock } from './types';
import { ladderStep } from './priceTrack';

export const START_CASH = 30_000;
export const SALARY = 500;
// ── Margin (replaces the old loan system) ──────────────────────────────────
export const MARGIN_INCREMENT = 2_000;       // borrow in $2,000 steps
export const MARGIN_MAX = 4_000;             // max outstanding margin at any time
export const MARGIN_DEFAULT_PENALTY = 1_000; // flat fee when a margin call defaults (tunable)
export const TAX_RATE = 0.10;
export const REGULAR_SUPPLY = 11;
// ── Fixed whole-company acquisition tiers ──────────────────────────────────
// The acquisition price is intentionally separate from the live per-share
// market price. Buying still grants the entire 11-share supply.
export const COMPANY_BUYOUT_BY_TIER: Record<CompanyTier, number> = {
  Starter: 5_000,
  Growth: 7_500,
  Premium: 10_000,
};
export const COMPANY_SHARE_PRICE_BY_TIER: Record<CompanyTier, number> = {
  Starter: 500,
  Growth: 750,
  Premium: 1_000,
};

export function companyTierForBase(basePrice: number): CompanyTier {
  if (basePrice <= 500) return 'Starter';
  if (basePrice <= 1_000) return 'Growth';
  return 'Premium';
}
export const IPO_SUPPLY = 5;
// ── Controlling Stake ───────────────────────────────────────────────────────
export const CONTROL_THRESHOLD_REGULAR = 6;  // shares of one regular stock for control
export const CONTROL_THRESHOLD_IPO = 3;      // shares of one IPO for control
export const CONTROL_DIVIDEND_MULTIPLIER = 2; // dividend multiplier while controlling
// ── Sold-Out Payout Claim (rent paid to the claim holder by tier) ────────────
export const PAYOUT_TIER_LOW = 500;       // holder owns 1-2 shares
export const PAYOUT_TIER_MID = 1_000;     // holder owns 3-5 shares
export const PAYOUT_TIER_CONTROL = 2_000; // holder owns 6+ shares (Controller)
// Boosted payouts when the holder also owns the completed Sector Portfolio.
export const PAYOUT_TIER_LOW_SECTOR = 750;
export const PAYOUT_TIER_MID_SECTOR = 1_500;
export const PAYOUT_TIER_CONTROL_SECTOR = 3_000;
// ── Diversification (Market Open income bonus) ───────────────────────────────
export const DIVERSIFIED_SECTORS = 3;    // distinct regular-stock sectors for Diversified status + bonus
export const BROAD_MARKET_SECTORS = 6;   // distinct sectors for the Broad Market bonus
export const DIVERSIFIED_BONUS = 300;    // paid at Market Open for 3-5 sectors
export const BROAD_MARKET_BONUS = 600;   // paid instead for 6+ sectors
// ── Market trade limits ─────────────────────────────────────────────────────
export const MAX_TRADE_QTY = Math.floor(REGULAR_SUPPLY / 2); // largest possible half-holding bank sale from the 11-share supply
// ── Weak Demand ──────────────────────────────────────────────────────────────
export const WEAK_DEMAND_THRESHOLD = 2; // markers before the price drops 1 step

export const SECTORS: Record<SectorId, Sector> = {
  tech:        { id: 'tech',        name: 'Technology',   color: '#4DA3FF', glyph: '◆' },
  consumer:    { id: 'consumer',    name: 'Consumer',     color: '#F0C53D', glyph: '●' },
  health:      { id: 'health',      name: 'Healthcare',   color: '#2DD4BF', glyph: '✚' },
  energy:      { id: 'energy',      name: 'Energy',       color: '#FF9442', glyph: '▲' },
  finance:     { id: 'finance',     name: 'Finance',      color: '#3ED598', glyph: '■' },
  realestate:  { id: 'realestate',  name: 'Real Estate',  color: '#A78BFA', glyph: '⌂' },
  industrials: { id: 'industrials', name: 'Industrials',  color: '#9AA5B1', glyph: '▮' },
  comm:        { id: 'comm',        name: 'Comms/Media',  color: '#F87171', glyph: '▶' },
};

const DIV_BY_RISK: Record<Risk, number> = { Low: 100, Med: 50, High: 0 };

// [space, name, sector, basePrice, risk, code]
// 22 regular stocks — uneven sector distribution:
//   tech 2 · comm 2 · energy 2 · consumer 3 · finance 3 · industrials 3 · realestate 3 · health 4
// Spaces 26 and 30 remain assigned to special spaces rather than regular stocks.
const RAW_STOCKS: Array<[number, string, SectorId, number, Risk, string]> = [
  [2,  'CloudCore AI',         'tech',        1000, 'High', 'CCAI'],
  [3,  'SafeMart Stores',      'consumer',     500, 'Low',  'SAFE'],
  [5,  'MediCore Health',      'health',       750, 'Med',  'MEDI'],
  [6,  'OilWorks Energy',      'energy',      1000, 'Med',  'OILW'],
  [8,  'FirstTrust Bank',      'finance',     1250, 'Low',  'FTRB'],
  [9,  'MetroHomes REIT',      'realestate',  1000, 'Low',  'MTRO'],
  [11, 'IronRail Logistics',   'industrials',  750, 'Low',  'IRON'],
  [12, 'StreamWave Media',     'comm',        1000, 'High', 'STRM'],
  [14, 'CyberShield Systems',  'tech',         750, 'High', 'CYBS'],
  [15, 'FreshBite Foods',      'consumer',     250, 'Low',  'FRSH'],
  [17, 'BioQuest Labs',        'health',      1000, 'High', 'BIOQ'],
  [18, 'SolarGrid Power',      'energy',       750, 'High', 'SOLR'],
  [20, 'PayWave Credit',       'finance',      750, 'Med',  'PAYW'],
  [21, 'TowerPoint Realty',    'realestate',  1250, 'Med',  'TWPT'],
  [23, 'BuildMax Materials',   'industrials',  500, 'Med',  'BLDM'],
  [24, 'VitalSign Devices',    'health',       750, 'Low',  'VSGN'],
  [27, 'SneakerStreet',        'consumer',     750, 'Med',  'SNKR'],
  [29, 'CarePlus Clinics',     'health',       500, 'Low',  'CARE'],
  [32, 'Apex Investments',     'finance',     1500, 'High', 'APEX'],
  [33, 'RentWell Properties',  'realestate',   750, 'Low',  'RENT'],
  [35, 'AeroLift Manufacturing','industrials', 1000, 'Med', 'AERO'],
  [36, 'GameBox Studios',      'comm',         500, 'High', 'GMBX'],
];

export const STOCKS: Stock[] = RAW_STOCKS.map(([space, name, sector, base, risk, code]) => {
  const tier = companyTierForBase(base);
  const openingPrice = COMPANY_SHARE_PRICE_BY_TIER[tier];
  return {
    code, name, sector, base: openingPrice, risk, space,
    step: ladderStep(openingPrice),
    color: SECTORS[sector].color,
    div: DIV_BY_RISK[risk],
    tier,
    buyout: COMPANY_BUYOUT_BY_TIER[tier],
  };
});

export const STOCK_BY_CODE: Record<string, Stock> = Object.fromEntries(
  STOCKS.map((s) => [s.code, s]),
);

export const STOCK_BY_SPACE: Record<number, Stock> = Object.fromEntries(
  STOCKS.map((s) => [s.space, s]),
);

/** Regular stock codes grouped by sector — the "color group" for Sector Portfolio. */
export const SECTOR_CODES: Record<SectorId, string[]> = STOCKS.reduce((acc, s) => {
  (acc[s.sector] ??= []).push(s.code);
  return acc;
}, {} as Record<SectorId, string[]>);

export const PLAYER_COLORS = [
  '#3ED598', '#4DA3FF', '#F0C53D', '#FF5C5C', '#A78BFA', '#2DD4BF',
];

export const STOCK_NOTES: Record<string, string> = {
  CCAI: 'AI infrastructure company. Strong upside, higher volatility.',
  SAFE: 'Consumer staples anchor. Steady performer with low risk.',
  MEDI: 'Healthcare services. Moderate growth, recession-resistant.',
  OILW: 'Energy producer. Price sensitive to global supply shifts.',
  FTRB: 'Regional bank. Reliable dividend, rate-sensitive.',
  MTRO: 'Urban REIT. Low risk, slow and steady growth.',
  IRON: 'Logistics and rail. Defensive industrials play.',
  STRM: 'Streaming media. High growth potential, volatile.',
  CYBS: 'Cybersecurity firm. Tech sector, high demand in downturns.',
  FRSH: 'Food and grocery. Low price point, very stable.',
  BIOQ: 'Biotech lab. Binary outcomes — high risk, high reward.',
  SOLR: 'Solar energy. High growth potential, capital-intensive.',
  PAYW: 'Digital payments. Moderate growth, broad market exposure.',
  TWPT: 'Commercial REIT. Mid-risk, income-generating.',
  BLDM: 'Construction materials. Cyclical, infrastructure-linked.',
  VSGN: 'Medical devices. Defensive healthcare, steady demand.',
  SNKR: 'Retail apparel. Consumer discretionary, trend-sensitive.',
  CARE: 'Primary care clinics. Low risk, defensive healthcare.',
  APEX: 'Investment fund. High-risk finance play.',
  RENT: 'Residential REIT. Low risk, dividend-focused.',
  AERO: 'Aerospace manufacturing. Long-cycle industrial.',
  GMBX: 'Video game studio. High volatility, entertainment sector.',
};
