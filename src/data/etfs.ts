export interface EtfDef {
  code: string;
  name: string;
  space: number;
  price: number;   // fixed $3,000 for all
  color: string;
  glyph: string;
}

export const ETF_PRICE = 3_000;

// Payout per Market Open pass/land, indexed by total ETF shares owned (capped at 4).
// Rebalanced for the $3,000 entry price (was tuned for $5,000): same escalating-yield
// shape as before — each additional fund pays a better rate, flattening at 4 —
// so ETFs stay a lower-risk, lower-effort income route relative to stock dividends.
//   1 fund  → $200  on $3,000 invested  (6.7%/lap)
//   2 funds → $500  on $6,000 invested  (8.3%/lap)
//   3 funds → $900  on $9,000 invested  (10%/lap)
//   4 funds → $1,200 on $12,000 invested (10%/lap)
export const ETF_PAYOUT = [0, 200, 500, 900, 1_200];

// Full-Diversification bonus: paid on top of the table above only when a player
// holds at least 1 share in EVERY one of the 4 distinct funds — not just 4 shares
// of a single fund. Mirrors the stock world's Sector Portfolio bonus and is what
// actually makes ETFs a "diversification route" per the rulebook, rather than
// just a flat income ladder that rewards raw share count.
export const ETF_DIVERSIFICATION_BONUS = 300;

// Railroad-style landing fee paid to the player who controls a fund space.
export const ETF_LANDING_FEES = [0, 500, 1_000, 1_500, 2_500];

export function etfLandingFee(distinctFunds: number): number {
  return ETF_LANDING_FEES[Math.max(0, Math.min(4, distinctFunds))];
}

export const ETF_DEFS: EtfDef[] = [
  { code: 'GRW',  name: 'Growth Fund',   space:  4, price: ETF_PRICE, color: '#4DA3FF', glyph: '◆' },
  { code: 'INC',  name: 'Income Fund',   space: 13, price: ETF_PRICE, color: '#3ED598', glyph: '■' },
  { code: 'PROP', name: 'Property Fund', space: 22, price: ETF_PRICE, color: '#A78BFA', glyph: '⌂' },
  { code: 'ENE',  name: 'Energy Fund',   space: 30, price: ETF_PRICE, color: '#FF9442', glyph: '▲' },
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

/** Total ETF shares owned (all funds combined), capped at payout table length. */
export function totalEtfShares(etfShares: Record<string, number>): number {
  return Object.values(etfShares).reduce((s, n) => s + n, 0);
}

/** ETF payout for this Market Open (share-count table only, no diversification bonus). */
export function calcEtfPayout(etfShares: Record<string, number>): number {
  const total = Math.min(totalEtfShares(etfShares), ETF_PAYOUT.length - 1);
  return ETF_PAYOUT[total];
}

/** Whether the player holds at least 1 share in every one of the 4 distinct funds. */
export function hasFullEtfDiversification(etfShares: Record<string, number>): boolean {
  return ETF_DEFS.every((e) => (etfShares[e.code] ?? 0) > 0);
}

/** Full-Diversification bonus for this Market Open — 0 unless all 4 funds are held. */
export function etfDiversificationBonus(etfShares: Record<string, number>): number {
  return hasFullEtfDiversification(etfShares) ? ETF_DIVERSIFICATION_BONUS : 0;
}

/** Total ETF income (table payout + diversification bonus) for this Market Open. */
export function projectedEtfIncome(etfShares: Record<string, number>): number {
  return calcEtfPayout(etfShares) + etfDiversificationBonus(etfShares);
}

/** ETF portfolio value at purchase price (for net worth / scoring). */
export function etfValue(etfShares: Record<string, number>): number {
  return totalEtfShares(etfShares) * ETF_PRICE;
}
