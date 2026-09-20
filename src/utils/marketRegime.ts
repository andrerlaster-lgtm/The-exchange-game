// Shared presentation for the Bull/Bear market marker (top banner, 2D board,
// 3D action center). The marker is the result of the last completed round's
// market resolution (engine/roundMarket.ts) — this module only maps it to
// labels, colors, glyphs and accessible text, so the surfaces never disagree.

import type { GameState } from '../engine/types';
import { SECTORS } from '../data';
import { moveSize } from './formatMoney';

export type MarketMarkerZone = 'bull' | 'bear' | 'none';

export interface MarketRegimeInfo {
  zone: MarketMarkerZone;
  // Deliberately NOT "BULL RUN"/"BEAR RUN" — those name the board spaces at
  // 16/26, a different mechanic entirely. The marker is how the last round
  // closed, so it reads as an adjective; a "Run" is always the board space.
  label: 'BULLISH' | 'BEARISH' | 'MARKET OPEN';
  detail: string;       // what the last round actually did
  color: string;
  glyph: string;        // a non-color signal, so meaning never depends on color alone
  ariaLabel: string;
}

const ZONE_META: Record<MarketMarkerZone, { label: MarketRegimeInfo['label']; color: string; glyph: string }> = {
  bull: { label: 'BULLISH', color: '#3ed598', glyph: '▲' },
  bear: { label: 'BEARISH', color: '#ef4444', glyph: '▼' },
  none: { label: 'MARKET OPEN', color: '#d4a535', glyph: '●' },
};

/** The single presentation model every surface derives from. */
export function marketRegimeInfo(round: GameState['marketRound']): MarketRegimeInfo {
  const zone: MarketMarkerZone = round ? round.direction : 'none';
  const meta = ZONE_META[zone];
  const detail = !round
    ? 'No round has closed yet'
    : round.sector
      ? `${SECTORS[round.sector].name} ${round.direction === 'bull' ? 'up' : 'down'} ${moveSize(round.bp)}`
      : 'Every sector was already at its limit';
  return {
    zone,
    label: meta.label,
    detail,
    color: meta.color,
    glyph: meta.glyph,
    ariaLabel: `Market marker: ${meta.label}. Last round: ${detail}.`,
  };
}
