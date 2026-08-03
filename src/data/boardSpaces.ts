import type { BoardSpace, DeckId, DeckMeta, IpoDef } from './types';
import { STOCK_BY_SPACE } from './stocks';

const SPECIAL: Record<number, [BoardSpace['type'], string, string, string]> = {
  1:  ['open',        'MARKET OPEN',      '▲', '#3ED598'],
  4:  ['etf',         'GROWTH FUND',      '◆', '#4DA3FF'],
  7:  ['fed',         'THE FED',          '%', '#E8B44C'],
  10: ['ipo',         'IPO',              '↑', '#3ED598'],
  13: ['etf',         'INCOME FUND',      '■', '#3ED598'],
  16: ['bull',         'BULL RUN',         '🐂', '#3ED598'],
  19: ['event',       'MARKET EVENT',     '◈', '#FF5C5C'],
  22: ['etf',         'PROPERTY FUND',    '⌂', '#A78BFA'],
  25: ['tax',         'PORTFOLIO TAX',    '$', '#9AA5B1'],
  26: ['bear',        'BEAR RUN',         '🐻', '#EF4444'],
  28: ['ipo',         'IPO',              '↑', '#3ED598'],
  30: ['etf',         'ENERGY FUND',      '▲', '#FF9442'],
  31: ['investor',    'INVESTOR DAY',     '★', '#C4B5FD'],
  34: ['audit',       'AUDIT NOTICE',     '⚑', '#E8B44C'],
};

const CORNERS: Record<number, true> = { 1: true, 10: true, 19: true, 28: true };

export const SPACES: BoardSpace[] = Array.from({ length: 36 }, (_, i) => {
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
