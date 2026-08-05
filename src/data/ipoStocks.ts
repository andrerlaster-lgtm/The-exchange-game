import type { IpoDef, SectorId } from './types';
import { ladderStep } from './priceTrack';
import { SECTORS } from './stocks';

// A single shared reveal queue of 4 IPOs, all entering the game at the same
// fixed $3,000 price (rulebook §16) — no tiered starting prices.
export const IPO_FIXED_PRICE = 3_000;

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
    opportunityText: '$50 per-share dividend. Control at 3+ shares doubles it.',
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
  startStep: ladderStep(IPO_FIXED_PRICE),
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
