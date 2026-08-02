import type { IpoDef, SectorId } from './types';
import { ladderStep } from './priceTrack';
import { SECTORS } from './stocks';

// A single shared reveal queue of 4 IPOs, all entering the game at the same
// fixed $3,000 price (rulebook §16) — no tiered starting prices.
export const IPO_FIXED_PRICE = 3_000;

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
