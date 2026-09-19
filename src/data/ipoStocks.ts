import type { IpoDef, SectorId } from './types';
import { CONTROL_DIVIDEND_MULTIPLIER, CONTROL_THRESHOLD_IPO, SECTORS } from './stocks';

// A single shared reveal queue of 4 IPOs, all entering the game at the same
// fixed $3,000 price (rulebook §16) — no tiered starting prices.
export const IPO_FIXED_PRICE = 3_000;

// ── IPO growth & milestones (2026-09-19 redesign) ───────────────────────────
// IPO prices move with the market like any stock, but in a 20-round game that
// alone almost never carries one past +25% (3-10% of revealed IPOs) and never
// to +100%. Shareholders can therefore fund growth directly, and milestones
// reward the climb.

/** A shareholder's growth investment: cash in, a basis-point price rise out. */
export const IPO_GROWTH_INVESTMENTS = {
  standard: { label: 'Growth Investment', cost: 500, bp: 250 },
  major: { label: 'Major Growth Investment', cost: 1_000, bp: 500 },
} as const;
export type IpoGrowthSize = keyof typeof IPO_GROWTH_INVESTMENTS;

/**
 * One-time rewards as an IPO climbs from its launch price, paid per share to
 * every holder (shares held before that turn began only). The +100% "Breakout"
 * is meant to graduate the IPO into an off-board Listed Company; graduation is
 * NOT implemented yet — the plan leaves a Listed Company's income undecided —
 * so Breakout currently pays its cash and the IPO stays an IPO.
 */
export const IPO_MILESTONES = [
  { name: 'Early Growth', pct: 25, perShare: 250 },
  { name: 'Expansion', pct: 50, perShare: 500 },
  { name: 'Breakout', pct: 100, perShare: 750 },
] as const;

export interface IpoPresentation {
  icon: string;
  volatilityLabel: string;
  opportunityTitle: 'CAPITAL GAIN PLAY' | 'INCOME + GROWTH';
  opportunityText: string;
  flavor: string;
}

/** Player-facing copy for the four IPO cards. Game values still come from IPO_DEFS/state. */
export const IPO_PRESENTATION: Record<string, IpoPresentation> = {
  NDRV: {
    icon: '⚡',
    volatilityLabel: 'SPECULATIVE',
    opportunityTitle: 'CAPITAL GAIN PLAY',
    opportunityText: 'No dividend — profit comes from price growth.',
    flavor: 'May accelerate faster than your risk tolerance.',
  },
  QCRT: {
    icon: '◈',
    volatilityLabel: 'HIGH VOLATILITY',
    opportunityTitle: 'CAPITAL GAIN PLAY',
    opportunityText: 'No dividend — profit comes from price growth.',
    flavor: 'Fast delivery. Due diligence may arrive later.',
  },
  RNST: {
    icon: '⌂',
    volatilityLabel: 'MODERATE',
    opportunityTitle: 'INCOME + GROWTH',
    // Multiplier and threshold are interpolated from the constants the engine
    // actually pays on, so this copy can't drift from them again (it claimed
    // control "doubles" the dividend while the engine paid 1.5×).
    opportunityText: `$50 per-share dividend. Control at ${CONTROL_THRESHOLD_IPO}+ shares pays ${CONTROL_DIVIDEND_MULTIPLIER}× that.`,
    flavor: 'Finally, a landlord that pays you.',
  },
  BBPY: {
    icon: '▦',
    volatilityLabel: 'HIGH VOLATILITY',
    opportunityTitle: 'CAPITAL GAIN PLAY',
    opportunityText: 'No dividend — profit comes from price growth.',
    flavor: 'The bridge is digital. The risk is very real.',
  },
};

// [code, name, sector, div, vol]
const RAW_IPOS: Array<[string, string, SectorId, number, IpoDef['vol']]> = [
  ['NDRV', 'NovaDrive EV',        'tech',        0,  'spec'],
  ['QCRT', 'QuickCart Delivery',  'consumer',    0,  'high'],
  ['RNST', 'RentNest Homes',      'realestate',  50, 'mod'],
  ['BBPY', 'BlockBridge Pay',     'finance',     0,  'high'],
];

export const IPO_DEFS: IpoDef[] = RAW_IPOS.map(([code, name, sector, div, vol]) => ({
  code, name, sector, div, vol,
  start: IPO_FIXED_PRICE,
  color: SECTORS[sector].color,
}));

export const IPO_BY_CODE: Record<string, IpoDef> = Object.fromEntries(
  IPO_DEFS.map((ip) => [ip.code, ip]),
);

export const IPO_INDEX: Record<string, number> = Object.fromEntries(
  IPO_DEFS.map((ip, i) => [ip.code, i]),
);

export const IPO_CODES: Record<string, true> = Object.fromEntries(
  IPO_DEFS.map((ip) => [ip.code, true as const]),
);

export function isIpoCode(code: string): boolean {
  return !!IPO_CODES[code];
}
