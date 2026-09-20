export interface EtfDef {
  code: string;
  name: string;
  space: number;
  price: number;   // fixed $3,000 for all
  color: string;
  glyph: string;
}

export const ETF_PRICE = 3_000;

// ETF Market Open distributions (2026-09-19 redesign). ETFs are the steady-
// income, lower-risk asset: they pay every Market Open without anyone landing
// on them. Each FUND pays by how many shares of it you hold, capped at 3+:
//   1 share  → $250    ($3,000 invested,  8.3%/lap)
//   2 shares → $500    ($6,000 invested,  8.3%/lap)
//   3+       → $750    ($9,000 invested,  8.3%/lap at 3; falls beyond 3)
// The cap pushes players to spread across funds rather than stack one.
// Replaces the old table keyed by TOTAL shares across all funds
// ($300/$700/$1,200/$1,800 for 1-4 shares).
export const ETF_FUND_DISTRIBUTION = [0, 250, 500, 750] as const;

// Diversification bonus for holding DIFFERENT funds (not more shares of one):
// 2 funds +$250, 3 funds +$500, all 4 funds +$750. Replaces the old flat $600
// paid only when all 4 were held.
export const ETF_DIVERSIFICATION_BONUS_BY_FUNDS: Record<number, number> = { 2: 250, 3: 500, 4: 750 };

// Railroad-style landing fee paid to the player who controls a fund space.
export const ETF_LANDING_FEES = [0, 750, 1_500, 2_500, 4_000];

export function etfLandingFee(distinctFunds: number): number {
  return ETF_LANDING_FEES[Math.max(0, Math.min(4, distinctFunds))];
}

export const ETF_DEFS: EtfDef[] = [
  { code: 'GRW',  name: 'Growth Fund',   space:  4, price: ETF_PRICE, color: '#4DA3FF', glyph: '◆' },
  { code: 'INC',  name: 'Income Fund',   space: 13, price: ETF_PRICE, color: '#3ED598', glyph: '■' },
  { code: 'PROP', name: 'Property Fund', space: 23, price: ETF_PRICE, color: '#A78BFA', glyph: '⌂' },
  { code: 'ENE',  name: 'Energy Fund',   space: 34, price: ETF_PRICE, color: '#FF9442', glyph: '▲' },
];

export const ETF_BY_CODE: Record<string, EtfDef> = Object.fromEntries(
  ETF_DEFS.map((e) => [e.code, e]),
);

export const ETF_BY_SPACE: Record<number, EtfDef> = Object.fromEntries(
  ETF_DEFS.map((e) => [e.space, e]),
);

export function isEtfCode(code: string): boolean {
  return code in ETF_BY_CODE;
}

/** Total ETF shares owned (all funds combined). */
export function totalEtfShares(etfShares: Record<string, number>): number {
  return Object.values(etfShares).reduce((s, n) => s + n, 0);
}

/** How many different funds the player holds at least one share of. */
export function distinctEtfFunds(etfShares: Record<string, number>): number {
  return ETF_DEFS.filter((e) => (etfShares[e.code] ?? 0) > 0).length;
}

/** One fund's distribution for its share count (capped at 3+). */
export function etfFundDistribution(shares: number): number {
  return ETF_FUND_DISTRIBUTION[Math.max(0, Math.min(shares, ETF_FUND_DISTRIBUTION.length - 1))];
}

/** ETF distributions for this Market Open: the sum over funds (no diversification bonus). */
export function calcEtfPayout(etfShares: Record<string, number>): number {
  return ETF_DEFS.reduce((sum, e) => sum + etfFundDistribution(etfShares[e.code] ?? 0), 0);
}

/** Whether the player holds at least 1 share in every fund. */
export function hasFullEtfDiversification(etfShares: Record<string, number>): boolean {
  return distinctEtfFunds(etfShares) === ETF_DEFS.length;
}

/** Diversification bonus for this Market Open, by number of different funds held. */
export function etfDiversificationBonus(etfShares: Record<string, number>): number {
  return ETF_DIVERSIFICATION_BONUS_BY_FUNDS[distinctEtfFunds(etfShares)] ?? 0;
}

/** Total ETF income (distributions + diversification bonus) for this Market Open. */
export function projectedEtfIncome(etfShares: Record<string, number>): number {
  return calcEtfPayout(etfShares) + etfDiversificationBonus(etfShares);
}

/** ETF portfolio value at purchase price (for net worth / scoring). */
export function etfValue(etfShares: Record<string, number>): number {
  return totalEtfShares(etfShares) * ETF_PRICE;
}
