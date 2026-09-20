import { describe, expect, it } from 'vitest';
import { FED_CARDS } from '../data';
import { MOVE_BP, applyBasisPoints } from '../data';
import { fedSignalForStock, importantMarketSignals, recordMarketSignal } from '../engine';
import { buildActionCenter } from '../utils/buildBoard3DActionCenter';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

describe('Market Intelligence signals', () => {
  it('records a Fed decision with exact company impacts and plain-language guidance', () => {
    const opening = patch(started(2), (draft) => {
      draft.pendingDraws = ['FED'];
      draft.decks.FED = [FED_CARDS.findIndex((c) => c.title === 'Rate Hike')];
    });
    const before = { ...opening.prices };
    const s = dispatch(opening, { t: 'draw', deck: 'FED' }, rng());

    // Found by kind rather than trusting index 0 — Option A (2026-09-18) can
    // now ALSO record a "Market Ripple" signal right after this one (Rate
    // Hike is a narrow 'multi' effect, so it qualifies), which would sit at
    // index 0 instead. The Fed signal's own impacts snapshot is unaffected
    // either way; only its position in the (unshift-ordered) list can move.
    const fedSignal = s.marketSignals.find((sig) => sig.kind === 'fed')!;
    expect(fedSignal).toMatchObject({
      kind: 'fed',
      title: 'Rate Hike',
      stance: 'hawkish',
    });
    expect(fedSignal.insight).toContain('borrowing costs');
    // Impacts are REALIZED percentages, so each company's own figure depends on
    // its own price: the $25 grid makes a nominal 5% land a little above or
    // below 5% depending on where the price sits. Assert the direction and the
    // real post-move price rather than one shared hardcoded percentage.
    for (const code of ['FTRB', 'PAYW'] as const) {
      expect(s.prices[code]).toBe(applyBasisPoints(before[code], MOVE_BP.cardStep));
      expect(fedSignal.impacts).toContainEqual({
        code, pct: ((s.prices[code] - before[code]) / before[code]) * 100,
      });
    }
    for (const code of ['MTRO', 'RENT'] as const) {
      expect(s.prices[code]).toBe(applyBasisPoints(before[code], -MOVE_BP.cardStep));
      expect(fedSignal.impacts).toContainEqual({
        code, pct: ((s.prices[code] - before[code]) / before[code]) * 100,
      });
    }
    expect(fedSignalForStock(s, 'FTRB').tone).toBe('tailwind');
    expect(fedSignalForStock(s, 'MTRO').tone).toBe('headwind');
    expect(fedSignalForStock(s, 'MEDI').tone).toBe('neutral');
  });

  it('uses only the last three Fed decisions and calls conflicting effects mixed', () => {
    const s = patch(started(2), (draft) => {
      recordMarketSignal(draft, { kind: 'fed', title: 'Old Hike', summary: '', impacts: [{ code: 'CCAI', pct: -30 }] });
      recordMarketSignal(draft, { kind: 'fed', title: 'Cut', summary: '', impacts: [{ code: 'CCAI', pct: 30 }] });
      recordMarketSignal(draft, { kind: 'fed', title: 'Hold', summary: '', impacts: [] });
      recordMarketSignal(draft, { kind: 'fed', title: 'Warning', summary: '', impacts: [{ code: 'CCAI', pct: -30 }] });
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

    const safeBefore = s.prices.SAFE;
    for (let i = 0; i < 2; i++) {
      s = patch(s, (draft) => {
        draft.turnPhase = 'acted';
        draft.trade = { scope: 'stock', code: 'SAFE', actionsLeft: 1 };
      });
      s = dispatch(s, { t: 'skipStock', code: 'SAFE' }, rng());
    }
    expect(s.marketSignals[0]).toMatchObject({
      kind: 'weakDemand',
      title: 'Weak Demand · SAFE',
      impacts: [{ code: 'SAFE', pct: ((s.prices.SAFE - safeBefore) / safeBefore) * 100 }],
    });
    expect(s.prices.SAFE).toBe(applyBasisPoints(safeBefore, MOVE_BP.weakDemand));
    expect(importantMarketSignals(s)).toEqual([]);
  });

  it('shows real player-to-player takeovers as important', () => {
    let s = patch(started(2), (draft) => {
      recordMarketSignal(draft, {
        kind: 'market', title: 'No Fill', summary: 'Nothing happens.', impacts: [],
      });
      draft.supply.MEDI = 0;
      draft.soldOut.MEDI = { code: 'MEDI', claimHolder: 0 };
      draft.players[0].shares.MEDI = 5;
      draft.players[1].shares.MEDI = 2;
    });

    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 4, direction: 'sell', price: 100 }, rng());
    s = dispatch(s, { t: 'acceptP2POffer', id: s.p2pOffers[0].id }, rng());

    expect(importantMarketSignals(s).map((signal) => signal.title)).toEqual(['MEDI Taken Over']);
    expect(importantMarketSignals(s)[0].summary).toContain('Riley took control of MEDI from Morgan');
  });

  it('keeps a REAL Bull/Bear Run resolution in Important Events — it has no landing banner of its own', () => {
    // Regression guard (2026-08-22, updated 2026-09-18 for the combined
    // Market Swing space). Resolving a Run moves every company by risk tier
    // AND pays/charges every player stance cash, but sets no s.landingNotice,
    // so this feed is its only prominent surfacing. Deliberately drives a
    // real landing + roll rather than hand-recording a signal: an earlier
    // version of this test hand-built one with the wrong `kind` and so kept
    // passing while real landings were silently dropped.
    for (const [roll, title] of [[6, 'Bull Run'], [1, 'Bear Run']] as const) {
      let s = rollTo(started(2), 21);
      expect(s.landingNotice).toBeNull(); // still no banner — hence the feed matters
      s = dispatch(s, { t: 'rollRegime' }, scriptedRng([roll]));
      expect(importantMarketSignals(s).map((signal) => signal.title)).toContain(title);
    }
  });

  it('keeps the Market Meter ambient signals OUT — the persistent display covers those', () => {
    const s = patch(started(2), (draft) => {
      recordMarketSignal(draft, {
        kind: 'market', title: 'Market Meter — Bullish', summary: 'Ambient move.', impacts: [{ code: 'CCAI', pct: 30 }],
      });
    });
    expect(importantMarketSignals(s)).toEqual([]);
  });

  it('exposes the same Fed Watch in the 3D Action Center, with the Bear Run landing as a row', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].shares.FTRB = 11;
      recordMarketSignal(draft, {
        kind: 'fed', title: 'Rate Hike', summary: 'Finance up; real estate down.',
        stance: 'hawkish', insight: 'Banks gain a lending tailwind.',
        impacts: [{ code: 'FTRB', pct: 30 }, { code: 'MTRO', pct: -30 }],
      });
      recordMarketSignal(draft, {
        kind: 'regime', title: 'Bear Run', summary: 'The broad market fell.', impacts: [{ code: 'CCAI', pct: -30 }],
      });
    });
    const center = buildActionCenter(s);

    expect(center.marketIntel.title).toBe('Fed Watch · Rate Hike');
    expect(center.marketIntel.description).toContain('Tailwind: FTRB');
    expect(center.marketIntel.rows?.[0]).toMatchObject({ key: 'rates', value: 'RATES' }); // Bank Rate strip leads
    expect(center.marketIntel.rows?.[1]).toMatchObject({ title: 'Bear Run', value: 'MAJOR' });
  });

  it('records each $100k portfolio milestone once and promotes it as important', () => {
    let s = patch(started(2), (draft) => {
      draft.players[0].cash = 100_000;
    });

    s = dispatch(s, { t: 'toggleTest' }, rng());
    expect(s.portfolioMilestones[0]).toBe(100_000);
    expect(importantMarketSignals(s)[0]).toMatchObject({
      kind: 'milestone',
      title: 'Morgan Reaches $100,000',
      playerIndex: 0,
      milestone: 100_000,
    });

    s = dispatch(s, { t: 'toggleTest' }, rng());
    expect(s.marketSignals.filter((signal) => signal.kind === 'milestone')).toHaveLength(1);
  });

  it('clears old intelligence when a new game starts', () => {
    let s = patch(started(2), (draft) => {
      recordMarketSignal(draft, { kind: 'fed', title: 'Rate Hike', summary: '', impacts: [] });
    });
    s = dispatch(s, { t: 'startGame' }, rng());
    expect(s.marketSignals).toEqual([]);
    expect(s.marketSignalSeq).toBe(0);
    expect(s.portfolioMilestones).toEqual({});
  });
});
