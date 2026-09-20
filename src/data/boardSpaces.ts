import type { BoardSpace, DeckId, DeckMeta, IpoDef } from './types';
import { STOCK_BY_SPACE } from './stocks';

/** Spaces on the board. 40 as of 2026-09-20 (was 36): a corner plus nine
    spaces on each side, matching a Monopoly board's shape, drawn on an 11x11
    grid. The four added spaces became a third Technology company, a third
    Comms/Media company, a second Rate Decision and a third Market Event. */
export const BOARD_SIZE = 40;
/** Spaces along one edge of the square, corners included. */
export const BOARD_SIDE = BOARD_SIZE / 4 + 1;

const SPECIAL: Record<number, [BoardSpace['type'], string, string, string]> = {
  1:  ['open',        'MARKET OPEN',      '▲', '#3ED598'],
  4:  ['etf',         'GROWTH FUND',      '◆', '#4DA3FF'],
  7:  ['fed',         'THE FED',          '%', '#E8B44C'],
  11: ['ipo',         'IPO',              '↑', '#3ED598'],
  13: ['etf',         'INCOME FUND',      '■', '#3ED598'],
  16: ['event',       'MARKET EVENT',     '◈', '#FF5C5C'],
  19: ['rateDecision', 'RATE DECISION',  '%', '#E8B44C'],
  21: ['regime',      'MARKET SWING',     '⚡', '#A78BFA'],
  23: ['etf',         'PROPERTY FUND',    '⌂', '#A78BFA'],
  26: ['tax',         'PORTFOLIO TAX',    '$', '#9AA5B1'],
  29: ['event',       'MARKET EVENT',     '◈', '#FF5C5C'],
  31: ['rateDecision', 'RATE DECISION',  '%', '#E8B44C'],
  34: ['etf',         'ENERGY FUND',      '▲', '#FF9442'],
  35: ['audit',       'AUDIT NOTICE',     '⚑', '#E8B44C'],
  38: ['investor',    'INVESTOR DAY',     '★', '#C4B5FD'],
  40: ['event',       'MARKET EVENT',     '◈', '#FF5C5C'],
};

const CORNERS: Record<number, true> = { 1: true, 11: true, 21: true, 31: true };

export const SPACES: BoardSpace[] = Array.from({ length: BOARD_SIZE }, (_, i) => {
  const n = i + 1;
  const stock = STOCK_BY_SPACE[n];
  if (stock) return { n, type: 'stock', code: stock.code };
  const [type, name, glyph, color] = SPECIAL[n];
  return { n, type, name, glyph, color, corner: !!CORNERS[n] };
});

export const DECK_META: Record<DeckId, DeckMeta> = {
  ME:  { label: 'MARKET EVENT', glyph: '◈', color: '#FF5C5C' },
  FED: { label: 'FED RATE',     glyph: '%',  color: '#E8B44C' },
};

export const VOL_NAME: Record<IpoDef['vol'], string> = {
  mod: 'Moderate', high: 'High-Vol', spec: 'Speculative',
};
