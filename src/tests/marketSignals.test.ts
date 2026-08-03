import { describe, expect, it } from 'vitest';
import { fedSignalForStock, importantMarketSignals, recordMarketSignal } from '../engine';
import { buildActionCenter } from '../utils/buildBoard3DActionCenter';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

describe('Market Intelligence signals', () => {
  it('records a Fed decision with exact company impacts and plain-language guidance', () => {
    let s = patch(started(2), (draft) => {
      draft.pendingDraws = ['FED'];
      draft.decks.FED = [0]; // Rate Hike
    });
    s = dispatch(s, { t: 'draw', deck: 'FED' }, rng());

    expect(s.marketSignals[0]).toMatchObject({
      kind: 'fed',
      title: 'Rate Hike',
      stance: 'hawkish',
    });
    expect(s.marketSignals[0].insight).toContain('borrowing costs');
    expect(s.marketSignals[0].impacts).toEqual(expect.arrayContaining([
      { code: 'FTRB', d: 1 },
      { code: 'PAYW', d: 1 },
      { code: 'MTRO', d: -1 },
      { code: 'RENT', d: -1 },
    ]));
    expect(fedSignalForStock(s, 'FTRB').tone).toBe('tailwind');
    expect(fedSignalForStock(s, 'MTRO').tone).toBe('headwind');
    expect(fedSignalForStock(s, 'MEDI').tone).toBe('neutral');
  });

  it('uses only the last three Fed decisions and calls conflicting effects mixed', () => {
    const s = patch(started(2), (draft) => {
      recordMarketSignal(draft, { kind: 'fed', title: 'Old Hike', summary: '', impacts: [{ code: 'CCAI', d: -3 }] });
      recordMarketSignal(draft, { kind: 'fed', title: 'Cut', summary: '', impacts: [{ code: 'CCAI', d: 1 }] });
      recordMarketSignal(draft, { kind: 'fed', title: 'Hold', summary: '', impacts: [] });
      recordMarketSignal(draft, { kind: 'fed', title: 'Warning', summary: '', impacts: [{ code: 'CCAI', d: -1 }] });
    });

    const signal = fedSignalForStock(s, 'CCAI');
    expect(signal.tone).toBe('mixed');
    expect(signal.net).toBe(0);
    expect(signal.related).toBe(2);
    expect(signal.lastTitle).toBe('Warning');
  });

  it('keeps routine rolls, purchases, and weak-demand markers out of Important Events', () => {
    let s = dispatch(started(2), { t: 'roll' }, scriptedRng([1, 2]));
    expect(s.marketSignals).toEqual([]);

    s = patch(s, (draft) => {
      draft.turnPhase = 'acted';
      draft.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 };
    });
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.marketSignals.some((signal) => signal.kind === 'soldout')).toBe(false);
    expect(importantMarketSignals(s)).toEqual([]);

    for (let i = 0; i < 2; i++) {
      s = patch(s, (draft) => {
        draft.turnPhase = 'acted';
        draft.trade = { scope: 'stock', code: 'SAFE', actionsLeft: 1 };
      });
      s = dispatch(s, { t: 'skipStock', code: 'SAFE' }, rng());
    }
    expect(s.marketSignals[0]).toMatchObject({
      kind: 'weakDemand', title: 'Weak Demand · SAFE', impacts: [{ code: 'SAFE', d: -1 }],
    });
    expect(importantMarketSignals(s)).toEqual([]);
  });

  it('shows market-wide Runs and real player-to-player takeovers as important', () => {
    let s = patch(started(2), (draft) => {
      recordMarketSignal(draft, {
        kind: 'market', title: 'Bull Run', summary: 'The entire market moved.', impacts: [],
      });
      draft.supply.MEDI = 0;
      draft.soldOut.MEDI = { code: 'MEDI', claimHolder: 0 };
      draft.players[0].shares.MEDI = 5;
      draft.players[1].shares.MEDI = 2;
    });

    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 4, direction: 'sell', price: 100 }, rng());
    s = dispatch(s, { t: 'acceptP2POffer', id: s.p2pOffers[0].id }, rng());

    expect(importantMarketSignals(s).map((signal) => signal.title)).toEqual([
      'MEDI Taken Over', 'Bull Run',
    ]);
    expect(importantMarketSignals(s)[0].summary).toContain('Riley took control of MEDI from Morgan');
  });

  it('exposes the same Fed Watch in the 3D Action Center', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].shares.FTRB = 11;
      recordMarketSignal(draft, {
        kind: 'fed', title: 'Rate Hike', summary: 'Finance up; real estate down.',
        stance: 'hawkish', insight: 'Banks gain a lending tailwind.',
        impacts: [{ code: 'FTRB', d: 1 }, { code: 'MTRO', d: -1 }],
      });
      recordMarketSignal(draft, {
        kind: 'market', title: 'Bear Run', summary: 'The broad market fell.', impacts: [],
      });
    });
    const center = buildActionCenter(s);

    expect(center.marketIntel.title).toBe('Fed Watch · Rate Hike');
    expect(center.marketIntel.description).toContain('Tailwind: FTRB');
    expect(center.marketIntel.rows?.[0]).toMatchObject({ title: 'Bear Run', value: 'Lap 1' });
  });

  it('clears old intelligence when a new game starts', () => {
    let s = patch(started(2), (draft) => {
      recordMarketSignal(draft, { kind: 'fed', title: 'Rate Hike', summary: '', impacts: [] });
    });
    s = dispatch(s, { t: 'startGame' }, rng());
    expect(s.marketSignals).toEqual([]);
    expect(s.marketSignalSeq).toBe(0);
  });
});
