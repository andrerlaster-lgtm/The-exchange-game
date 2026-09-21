// The persistent Bull/Bear marker display. 2026-09-19: the marker is the
// result of the last completed round's market resolution, not a −3..+3
// needle, and every surface (banner, 2D board, 3D action center) reads the
// same presentation model.

import { describe, it, expect } from 'vitest';
import { marketRegimeInfo } from '../utils/marketRegime';
import { buildActionCenter } from '../utils/buildBoard3DActionCenter';
import { resolveRoundEndMarket, tallyRoundDice } from '../engine/roundMarket';
import { DEFAULT_OPTIONS } from '../engine/types';
import { initialState } from '../engine';
import type { GameState } from '../engine';
import { SECTORS } from '../data';
import { makeRng } from '../utils/rng';
import { dispatch, patch, scriptedRng, started } from './helpers';

const bull: GameState['marketRound'] = { direction: 'bull', bloc: 'Tech & Communications', sectors: ['tech', 'comm'], bp: 500, sectorTotal: 7, moveAvg: 5.0, lap: 1 };
const bear: GameState['marketRound'] = { direction: 'bear', bloc: 'Finance', sectors: ['finance'], bp: 250, sectorTotal: 5, moveAvg: 3.0, lap: 2 };
const clamped: GameState['marketRound'] = { direction: 'bear', bloc: 'Finance', sectors: [], bp: 750, sectorTotal: 5, moveAvg: 1.0, lap: 3 };

describe('marketRegimeInfo — single source of truth for all three surfaces', () => {
  it('labels the marker by how the last round closed, and MARKET OPEN before any', () => {
    expect(marketRegimeInfo(bull).label).toBe('BULLISH');
    expect(marketRegimeInfo(bear).label).toBe('BEARISH');
    expect(marketRegimeInfo(null).label).toBe('MARKET OPEN');
  });

  it('never reuses the Bull Run / Bear Run board-space names', () => {
    // Those name spaces 16 and 26, a different mechanic (risk-tier price
    // moves + stance cash). Sharing the words made the banner read
    // "BEAR RUN" while a player landed on the "BULL RUN" space.
    for (const round of [bull, bear, clamped, null]) {
      expect(marketRegimeInfo(round).label).not.toMatch(/RUN/i);
    }
  });

  it('spells out what the round actually did', () => {
    expect(marketRegimeInfo(bull).detail).toBe(`${SECTORS.tech.name} & ${SECTORS.comm.name} up 5% (500 bp)`);
    expect(marketRegimeInfo(bear).detail).toBe(`${SECTORS.finance.name} down 2.5% (250 bp)`);
    expect(marketRegimeInfo(clamped).detail).toMatch(/already at its limit/);
    expect(marketRegimeInfo(null).detail).toMatch(/No round has closed yet/);
  });

  it('accessible text contains both the label and what happened', () => {
    for (const round of [bull, bear, clamped, null]) {
      const info = marketRegimeInfo(round);
      expect(info.ariaLabel).toContain(info.label);
      expect(info.ariaLabel).toContain(info.detail);
    }
  });

  it('the 3D action center exposes the exact same data the 2D banner and board use', () => {
    const s = patch(started(2), (d) => { d.marketRound = bull; });
    const expected = marketRegimeInfo(s.marketRound);
    expect(buildActionCenter(s).marketCondition).toMatchObject({
      enabled: true,
      zone: expected.zone,
      label: expected.label,
      detail: expected.detail,
      color: expected.color,
      glyph: expected.glyph,
      ariaLabel: expected.ariaLabel,
    });
  });

  it('the 3D action center reports enabled: false when the round-end market rule is off', () => {
    const s = patch(started(2), (d) => { d.opts.roundMarket = false; });
    expect(buildActionCenter(s).marketCondition.enabled).toBe(false);
  });

  it('a dice roll changes no marker — only a completed round does', () => {
    let s = started(2);
    expect(marketRegimeInfo(s.marketRound).zone).toBe('none');
    s = dispatch(patch(s, (d) => { d.turnPhase = 'preRoll'; }), { t: 'roll' }, scriptedRng([6, 6]));
    expect(s.marketRound).toBeNull();
    s = patch(s, (d) => { d.marketTheme = null; tallyRoundDice(d, 5, 6); resolveRoundEndMarket(d); });
    expect(['bull', 'bear']).toContain(marketRegimeInfo(s.marketRound).zone);
    // No second field tracks the regime — marketRound is the only source.
    expect((s as unknown as Record<string, unknown>).marketRegime).toBeUndefined();
    expect((s as unknown as Record<string, unknown>).meter).toBeUndefined();
  });
});

describe('Round boundary', () => {
  it('does not resolve the market once Market Close has been triggered', () => {
    let s = patch(started(2), (d) => {
      d.cur = 1; d.turnPhase = 'acted'; d.trade = null;
      d.closing = true; d.closeDrawer = 0; d.extendedRoundsLeft = 1;
    });
    const before = { ...s.prices };
    s = dispatch(s, { t: 'endTurn' }, scriptedRng([0]));
    expect(s.marketRound).toBeNull();
    expect(s.prices).toEqual(before);
  });

  it('records exactly one market signal for a round that moved something', () => {
    const s = started(2);
    const signalsBefore = s.marketSignals.length;
    const t = patch(s, (d) => { d.marketTheme = null; tallyRoundDice(d, 5, 6); resolveRoundEndMarket(d); });
    expect(t.marketSignals.length).toBe(signalsBefore + 1);
    expect(t.marketSignals[0].title).toMatch(/^Round-End Market/);
  });
});

describe('Default availability', () => {
  it('the round-end market is on by default — a core rule, not an experimental option', () => {
    expect(DEFAULT_OPTIONS.roundMarket).toBe(true);
    expect(initialState(makeRng('default-check')).opts.roundMarket).toBe(true);
  });
});
