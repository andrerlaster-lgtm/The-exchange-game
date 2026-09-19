import type { CompanyTier, Risk, Sector, SectorId, SectorPair, SectorPairId, Stock } from './types';
import { RUN_BP } from './priceModel';

export const START_CASH = 35_000; // default starting cash — must match DEFAULT_OPTIONS.startCash (engine/types.ts)
// Market Open salary; landing exactly on Market Open pays double. Raised from
// $2,000 on 2026-09-19: once the simulation bot stopped liquidating its whole
// portfolio on every Payout Claim, a salary sweep showed $3,000 cuts
// insolvencies about 25-45% across 2-6 players.
export const SALARY = 3_000;
// ── Recovery Bonus (2026-09-18 cash-flow pass) ──────────────────────────────
// A live 200-turn trace found average Payout Claim hits of $4,000-4,300 —
// roughly 8x a single salary payment — with players landing at literal $0
// cash in every run, most often in 6-player games (more sold-out companies
// on the board means more spaces that can charge a claim). This is the
// targeted half of the fix: whoever reaches their OWN Market Open still
// sitting below the threshold (i.e. a recent big claim hasn't been made up
// by salary/dividends yet) gets a one-time top-up on top of normal income,
// right when it actually matters, instead of crawling back at $750/lap.
export const RECOVERY_BONUS_THRESHOLD = 3_000; // cash below this at Market Open qualifies
export const RECOVERY_BONUS = 2_000;           // flat top-up paid on top of normal income
// ── Margin (replaces the old loan system) ──────────────────────────────────
export const MARGIN_INCREMENT = 2_000;       // borrow in $2,000 steps
export const MARGIN_MAX = 4_000;             // max outstanding margin at any time
export const MARGIN_DEFAULT_PENALTY = 1_000; // flat fee when a margin call defaults (tunable)
export const TAX_RATE = 0.10;
export const AUDIT_RATE = 0.05;
export const AUDIT_MINIMUM = 500;
export const AUDIT_MARGIN_RATE = 0.075;
export const AUDIT_MARGIN_MINIMUM = 750;
export const FEE_DEBT_MIN_INTEREST = 100;
export const FEE_DEBT_INSTALLMENT = 500;
// ── Player-to-player Payout Claim loans ─────────────────────────────────────
// When a landing player can't fully cover a Payout Claim in cash, they may
// negotiate a loan instead of force-selling stock. The creditor (the player
// owed the claim) rolls a premium over the Bank Rate (data/rates.ts); unpaid balance at game end counts
// against the debtor's score and for the creditor's.
export const PLAYER_LOAN_MIN_INTEREST = 20; // was $100 — floored out the 1-5% rate roll at realistic loan sizes (see accruePlayerDebt)
export const PLAYER_LOAN_INSTALLMENT = 500;
export const REGULAR_SUPPLY = 11;
// ── Fixed whole-company acquisition tiers ──────────────────────────────────
// The acquisition price itself is REGULAR_SUPPLY × the tier's opening share
// price, computed live off the ladder (rules.ts:companyBuyoutCost) rather
// than a separate fixed table — a standalone COMPANY_BUYOUT_BY_TIER constant
// used to exist here but nothing in the engine ever read it (the live-price
// formula superseded it), so it silently drifted from what the game actually
// charges and only the test suite still asserted its stale numbers.
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
export const CONTROL_DIVIDEND_MULTIPLIER = 1.5; // dividend multiplier while controlling

/** Dividend paid each Market Open immediately after acquiring a full company.
    Rounded to the nearest whole dollar — the 1.5x multiplier does not always
    land on an integer (e.g. a single High-risk share: 15 × 1 × 1.5 = 22.5). */
export function fullCompanyDividendPerMarketOpen(stock: Pick<Stock, 'div'>): number {
  return Math.round(stock.div * REGULAR_SUPPLY * CONTROL_DIVIDEND_MULTIPLIER);
}
// ── Sold-Out Payout Claim (rent paid to the claim holder) ───────────────────
// 2026-09-18 balance pass (Option 4): expressed as a MULTIPLE of the specific
// company's own opening per-share price, not a flat dollar table. A flat
// $2,000 Controller rent was 36.4% of a Starter company's $5,500 buyout but
// only 18.2% of a Premium company's $11,000 — cheap companies returned 2x the
// rent-per-dollar-invested of expensive ones, making Starter-tier strictly
// dominant regardless of risk. Since buyout = REGULAR_SUPPLY x share price,
// rent = multiplier x share price keeps the SAME ratio-to-buyout-cost across
// every tier. Starter's own numbers are unchanged by this (4 x $500 = the
// same $2,000 Controller rent it always paid) — only Growth ($3,000, was
// $2,000 flat) and Premium ($4,000, was $2,000 flat) move, because they were
// the tiers being shortchanged.
export const PAYOUT_MULT_LOW = 1;          // holder owns 1-2 shares
export const PAYOUT_MULT_MID = 2;          // holder owns 3-5 shares
export const PAYOUT_MULT_CONTROL = 4;      // holder owns 6+ shares (Controller)
// Boosted multipliers when the holder also owns the completed Sector Portfolio.
export const PAYOUT_MULT_LOW_SECTOR = 1.5;
export const PAYOUT_MULT_MID_SECTOR = 3;
export const PAYOUT_MULT_CONTROL_SECTOR = 6;
/** Maximum combined amount owed from one sold-out landing, after the Payout
    Claim, shareholder discount, Market Condition adjustment, and Sector Rent. */
export const PAYOUT_CLAIM_TOTAL_CAP = 10_000;

/**
 * Bull/Bear Run movement by risk tier, in basis points (100 bp = 1%).
 *
 * 2026-09-18 balance pass (Option 1): Low risk's Bear Run move was +1 step —
 * strictly better than "no change," so a Low-risk holding could never lose
 * value to either Run while simultaneously earning the highest dividend yield
 * in the game (see DIV_BY_RISK below). "Low risk" is now genuinely stable —
 * zero Run exposure in both directions — rather than risk-free. The
 * percentage redesign keeps exactly that shape, restated as 0/±1,000/±2,000 bp.
 */
// `|| 0` keeps a zero tier as +0 rather than JavaScript's -0, which is not
// Object.is-equal to 0 and would surface in equality assertions and displays.
const down = (bp: number) => -bp || 0;

export const MARKET_RUN_MOVE_BY_RISK = {
  bull: { Low: RUN_BP.Low, Med: RUN_BP.Med, High: RUN_BP.High },
  bear: { Low: down(RUN_BP.Low), Med: down(RUN_BP.Med), High: down(RUN_BP.High) },
} satisfies Record<'bull' | 'bear', Record<Risk, number>>;

export interface StockOpportunity {
  title: 'GROWTH POTENTIAL' | 'BALANCED OPPORTUNITY' | 'INCOME & STABILITY';
  tone: 'growth' | 'balanced' | 'income';
  dividendPerLap: number;
  bullMove: number;
  bearMove: number;
  landingPayout: number;
  sectorPayout: number;
}

/** Player-facing reason to buy a company, derived from the same values used by the engine. */
export function stockOpportunityFor(stock: Pick<Stock, 'div' | 'risk' | 'base'>): StockOpportunity {
  const title = stock.risk === 'High'
    ? 'GROWTH POTENTIAL'
    : stock.risk === 'Low'
      ? 'INCOME & STABILITY'
      : 'BALANCED OPPORTUNITY';
  const tone = stock.risk === 'High' ? 'growth' : stock.risk === 'Low' ? 'income' : 'balanced';
  return {
    title,
    tone,
    dividendPerLap: fullCompanyDividendPerMarketOpen(stock),
    bullMove: MARKET_RUN_MOVE_BY_RISK.bull[stock.risk],
    bearMove: MARKET_RUN_MOVE_BY_RISK.bear[stock.risk],
    // This THIS company's own real Controller rent, not a flat number that
    // was only ever accurate for a Starter-tier company (see the Payout
    // Claim comment above) — stock.base is its opening per-share price.
    landingPayout: PAYOUT_MULT_CONTROL * stock.base,
    sectorPayout: PAYOUT_MULT_CONTROL_SECTOR * stock.base,
  };
}
// ── Diversification (Market Open income bonus) ───────────────────────────────
export const DIVERSIFIED_SECTORS = 3;    // distinct regular-stock sectors for Diversified status + bonus
export const BROAD_MARKET_SECTORS = 6;   // distinct sectors for the Broad Market bonus
export const DIVERSIFIED_BONUS = 300;    // paid at Market Open for 3-5 sectors
export const BROAD_MARKET_BONUS = 600;   // paid instead for 6+ sectors
// ── Market trade limits ─────────────────────────────────────────────────────
export const MAX_TRADE_QTY = Math.floor(REGULAR_SUPPLY / 2); // largest possible half-holding bank sale from the 11-share supply
// ── Weak Demand ──────────────────────────────────────────────────────────────
export const WEAK_DEMAND_THRESHOLD = 2; // markers before the price drops 1 step
// ── Strong Demand (2026-09-18 balance pass, Option C) ───────────────────────
// The positive mirror of Weak Demand, for the OTHER half of a stock's life:
// Weak Demand only ever applies BEFORE a company sells out (it tracks skips on
// an untouched company); Strong Demand only ever applies AFTER — it tracks
// Payout Claim landings on an already-sold-out one. The two never overlap on
// the same company. Investigated first (see the price-drift trace): buying a
// company never moved its own price up, so all organic upward pressure had to
// come from the Market Meter/cards/Runs — this gives repeat landings on a
// popular, already-sold-out company their own ongoing upward pull too.
export const STRONG_DEMAND_THRESHOLD = 2; // Payout Claim landings before the price rises 1 step

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

// High risk earns a small but nonzero dividend so the tier isn't strictly
// dominated on income (Stage A finding: at Low:100/Med:50/High:0, buying a
// High-risk company had no reason to ever be the better choice). The bulk
// of High risk's return is meant to come from price movement instead.
// Raised from Low:50/Med:30/High:15 (2026-09-15 balance pass) — full-company
// payback at the old rates ran 7-17 laps for Low/Med risk, so buying even a
// couple of companies left a player cash-starved for laps at a time.
// Raised again from Low:80/Med:50/High:20 (2026-09-18 cash-flow pass — a
// live 200-turn trace showed average Payout Claim hits of $4,000-4,300
// against $500/lap salary, driving players to literal $0 cash in every run;
// see SALARY and recoveryBonus for the other two legs of that same pass).
const DIV_BY_RISK: Record<Risk, number> = { Low: 110, Med: 70, High: 30 };

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
    color: SECTORS[sector].color,
    div: DIV_BY_RISK[risk],
    tier,
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

// ── Sector Control (landing rent for owning both companies in a pair) ──────
// Flat toll by tier — paid straight to the owner, no forced-sale/loan
// complexity like Payout Claims have. Kept modest since this fires on every
// landing (not just sold-out ones), so it needs to stay in the background
// rather than dominate the economy.
export const SECTOR_PAIR_RENT: Record<Risk, number> = { Low: 200, Med: 350, High: 550 };

export const SECTOR_PAIRS: Record<SectorPairId, SectorPair> = {
  techSentinels:      { id: 'techSentinels',      name: 'Tech Sentinels',      tier: 'High', rent: SECTOR_PAIR_RENT.High, codes: ['CCAI', 'CYBS'], color: '#38BDF8' },
  consumerStaples:    { id: 'consumerStaples',    name: 'Consumer Staples',    tier: 'Low',  rent: SECTOR_PAIR_RENT.Low,  codes: ['SAFE', 'FRSH'], color: '#FBBF24' },
  healthEssentials:   { id: 'healthEssentials',   name: 'Health Essentials',   tier: 'Low',  rent: SECTOR_PAIR_RENT.Low,  codes: ['CARE', 'VSGN'], color: '#34D399' },
  healthInnovation:   { id: 'healthInnovation',   name: 'Health Innovation',   tier: 'Med',  rent: SECTOR_PAIR_RENT.Med,  codes: ['MEDI', 'BIOQ'], color: '#A78BFA' },
  energyComplex:      { id: 'energyComplex',      name: 'Energy Complex',      tier: 'Med',  rent: SECTOR_PAIR_RENT.Med,  codes: ['OILW', 'SOLR'], color: '#FB923C' },
  realEstateHoldings: { id: 'realEstateHoldings', name: 'Real Estate Holdings', tier: 'Low', rent: SECTOR_PAIR_RENT.Low,  codes: ['MTRO', 'RENT'], color: '#60A5FA' },
  heavyIndustry:      { id: 'heavyIndustry',      name: 'Heavy Industry',      tier: 'Med',  rent: SECTOR_PAIR_RENT.Med,  codes: ['BLDM', 'AERO'], color: '#94A3B8' },
  mediaGames:         { id: 'mediaGames',         name: 'Media & Games',       tier: 'High', rent: SECTOR_PAIR_RENT.High, codes: ['STRM', 'GMBX'], color: '#F472B6' },
  blueChipAlliance:   { id: 'blueChipAlliance',   name: 'Blue Chip Alliance',  tier: 'Low',  rent: SECTOR_PAIR_RENT.Low,  codes: ['FTRB', 'IRON'], color: '#2DD4BF' },
  capitalGrowth:      { id: 'capitalGrowth',      name: 'Capital Growth',      tier: 'Med',  rent: SECTOR_PAIR_RENT.Med,  codes: ['PAYW', 'TWPT'], color: '#FACC15' },
  speculativePlays:   { id: 'speculativePlays',   name: 'Speculative Plays',   tier: 'Med',  rent: SECTOR_PAIR_RENT.Med,  codes: ['SNKR', 'APEX'], color: '#F87171' },
};

/** Reverse lookup: regular stock code -> the Sector Control pair it belongs
    to. Every regular stock is in exactly one pair; IPO/ETF codes never
    appear here (Sector Control ownership never counts those). */
export const SECTOR_PAIR_BY_CODE: Record<string, SectorPairId> = Object.fromEntries(
  (Object.values(SECTOR_PAIRS) as SectorPair[]).flatMap((pair) => pair.codes.map((code) => [code, pair.id])),
);

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
