// 2026-08-21 Deck Rebuild — architecture, meter-sentiment, and
// actual-impact-accounting requirements from
// "Rebuild The Exchange Market Event Deck".

import { describe, it, expect } from 'vitest';
import { CARDS, CORE_ME_CARDS, ME_CARDS, MARKET_CLOSE_INDEX } from '../data';
import { circuitBreakerOptions } from '../engine';
import { dispatch, patch, rng, started } from './helpers';

function drawCard(s: ReturnType<typeof started>, title: string) {
  const idx = CARDS.ME.findIndex((card) => card.title === title);
  if (idx < 0) throw new Error(`Missing ${title} card`);
  const ready = patch(s, (d) => {
    d.turnPhase = 'acted';
    d.pendingDraws = ['ME'];
    d.decks.ME = [idx, ...d.decks.ME.filter((i) => i !== idx)];
  });
  return dispatch(ready, { t: 'draw', deck: 'ME' }, rng());
}

describe('Deck Rebuild — architecture', () => {
  it('the core deck has exactly 24 cards', () => {
    expect(CORE_ME_CARDS).toHaveLength(24);
  });

  it('Market Close is not one of the 24 core cards', () => {
    expect(CORE_ME_CARDS.some((c) => c.eff.k === 'close')).toBe(false);
  });

  it('no duplicate/dead cards from the old deck remain', () => {
    const titles = ME_CARDS.map((c) => c.title);
    for (const removed of [
      'Late Earnings Beat', 'Late Earnings Miss', 'Short Squeeze Play', 'Forced Cover',
      'Thin Liquidity', 'No Fill', 'Wide Spread', 'Insider Tip', 'Late Tape Leak',
      'Cash Cushion', 'Price Whipsaw', 'Margin Call',
    ]) {
      expect(titles).not.toContain(removed);
    }
  });

  it('Market Close still exists, outside the core 24', () => {
    expect(MARKET_CLOSE_INDEX).toBeGreaterThanOrEqual(0);
    expect(CARDS.ME[MARKET_CLOSE_INDEX].eff.k).toBe('close');
  });
});

describe('Deck Rebuild — meter sentiment applies exactly once', () => {
  it('a sentiment card with meterSentiment moves the meter by that amount, once', () => {
    let s = patch(started(2), (d) => { d.meter = 0; });
    s = drawCard(s, 'Bullish Momentum');
    expect(s.meter).toBe(2);
  });

  it('a price card with meterSentiment moves both price and meter from a single draw', () => {
    let s = patch(started(2), (d) => { d.meter = 0; });
    const before = s.prices.SAFE;
    s = drawCard(s, 'Melt-Up Rally');
    expect(s.prices.SAFE).toBe(before + 1);
    expect(s.meter).toBe(2);
  });

  it('never applies meter sentiment while a Circuit Breaker pause defers resolution', () => {
    let s = patch(started(2), (d) => {
      d.meter = 0;
      d.circuitBreakerHolder = 0;
      d.players[0].shares.CCAI = 11;
    });
    s = drawCard(s, 'Flash Crash');
    expect(s.circuitBreakerPrompt).not.toBeNull();
    expect(s.meter).toBe(0); // not yet applied — the price effect hasn't resolved
    s = dispatch(s, { t: 'passCircuitBreaker' }, rng());
    expect(s.meter).toBe(-2); // applied once resolution actually happens
  });
});

describe('Deck Rebuild — actual-impact accounting', () => {
  it('records the real post-protection impact, not the predicted one', () => {
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      d.players[0].shares.CCAI = 11;
      d.players[0].shares.CYBS = 11;
    });
    s = drawCard(s, 'Flash Crash');
    s = dispatch(s, { t: 'playCircuitBreaker', code: 'CCAI' }, rng());

    const signal = s.marketSignals.find((sig) => sig.title === 'Flash Crash');
    expect(signal).toBeDefined();
    const ccaiImpact = signal!.impacts.find((imp) => imp.code === 'CCAI');
    const cybsImpact = signal!.impacts.find((imp) => imp.code === 'CYBS');
    // CCAI was shielded — no impact recorded for it at all, not a
    // predicted -1 that never actually happened.
    expect(ccaiImpact).toBeUndefined();
    expect(cybsImpact?.d).toBe(-1);
  });

  it('records the real, resolved impact for a pick card only after its target is locked in', () => {
    let s = started(2);
    s = drawCard(s, 'Earnings Miss');
    // No signal yet — the effect hasn't resolved (target unknown).
    expect(s.marketSignals.find((sig) => sig.title === 'Earnings Miss')).toBeUndefined();

    const target = s.pick!.codes![0];
    const before = s.prices[target];
    s = dispatch(s, { t: 'pickTarget', code: target }, rng());

    const signal = s.marketSignals.find((sig) => sig.title === 'Earnings Miss');
    expect(signal).toBeDefined();
    expect(signal!.impacts).toEqual([{ code: target, d: s.prices[target] - before }]);
  });

  it('still records a signal for a pick card that finds no eligible target at all', () => {
    // Every company and revealed IPO already at the price floor — Earnings
    // Miss (d: -2) has nothing left it can legally move.
    let s = patch(started(2), (d) => {
      Object.keys(d.prices).forEach((code) => { d.prices[code] = 0; });
    });
    s = drawCard(s, 'Earnings Miss');
    expect(s.pick).toBeNull(); // never opened — nothing eligible to choose
    const signal = s.marketSignals.find((sig) => sig.title === 'Earnings Miss');
    expect(signal).toBeDefined();
    expect(signal!.impacts).toEqual([]);
  });

  it('finalizes a pending pick against the card that actually opened it, even if another forced Market Event draw happens first', () => {
    // A ceiling-crossing trade can legitimately queue a second forced 'ME'
    // draw while an earlier pick is still unresolved (see actionResolver.ts's
    // 'draw' case comment on trade state). The eventual signal must still
    // credit the original card, not whichever card was drawn most recently.
    let s = started(2);
    s = drawCard(s, 'Earnings Miss');
    expect(s.pick).not.toBeNull();

    const otherIdx = CARDS.ME.findIndex((c) => c.title === 'Melt-Up Rally');
    s = patch(s, (d) => { d.pendingDraws = ['ME']; d.decks.ME = [otherIdx, ...d.decks.ME]; });
    s = dispatch(s, { t: 'draw', deck: 'ME' }, rng());
    expect(s.card?.title).toBe('Melt-Up Rally');
    expect(s.pick).not.toBeNull(); // the original pick survives the interleaved draw

    const target = s.pick!.codes![0];
    s = dispatch(s, { t: 'pickTarget', code: target }, rng());

    const earningsMissSignal = s.marketSignals.find((sig) => sig.title === 'Earnings Miss');
    expect(earningsMissSignal).toBeDefined();
    expect(earningsMissSignal!.impacts).toEqual([{ code: target, d: -2 }]);
  });

  it('re-validates ownership before honoring a Circuit Breaker play on a locked pick target', () => {
    // The holder owned the target when the prompt opened, but sold out of it
    // via a still-open trade step before actually deciding. "Play" must not
    // succeed against a company they no longer hold.
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      d.players[0].shares.MEDI = 11;
    });
    s = drawCard(s, 'Earnings Miss');
    s = dispatch(s, { t: 'pickTarget', code: 'MEDI' }, rng());
    expect(s.circuitBreakerPrompt?.targetCode).toBe('MEDI');

    s = patch(s, (d) => { d.players[0].shares.MEDI = 0; });
    const before = s.prices.MEDI;
    s = dispatch(s, { t: 'playCircuitBreaker', code: 'MEDI' }, rng());

    // Rejected: prompt still open, card still held, price still unmoved.
    expect(s.circuitBreakerPrompt).not.toBeNull();
    expect(s.circuitBreakerHolder).toBe(0);
    expect(s.prices.MEDI).toBe(before);
  });
});

describe('Deck Rebuild — fair automatic lowest/highest targeting', () => {
  it('breaks a tie with the seeded RNG, not array/object order, and replays identically for the same seed', () => {
    // Every regular company starts at the same step, so every one of them is
    // tied for lowest — the tie-break is the entire selection here.
    const s1 = drawCard(started(2, rng('replay-seed')), 'Short Squeeze');
    const s2 = drawCard(started(2, rng('replay-seed')), 'Short Squeeze');
    const signal1 = s1.marketSignals.find((sig) => sig.title === 'Short Squeeze');
    const signal2 = s2.marketSignals.find((sig) => sig.title === 'Short Squeeze');
    expect(signal1?.impacts).toEqual(signal2?.impacts);
    expect(signal1?.impacts).toHaveLength(1);
  });

  it('offers Circuit Breaker on the single auto-selected target only if the holder owns it', () => {
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      // Make MTRO the unique highest price so Bad Press's target is deterministic.
      d.prices.MTRO = 9; // clearly above every other company's default step, still within ladder range
      d.players[0].shares.MTRO = 11;
    });
    const before = s.prices.MTRO;
    s = drawCard(s, 'Bad Press');

    expect(s.circuitBreakerPrompt?.player).toBe(0);
    expect(circuitBreakerOptions(s)).toEqual(['MTRO']);
    expect(s.prices.MTRO).toBe(before); // paused, not yet moved

    s = dispatch(s, { t: 'playCircuitBreaker', code: 'MTRO' }, rng());
    expect(s.prices.MTRO).toBe(before);
    expect(s.circuitBreakerPrompt).toBeNull();
  });

  it('never pauses for Circuit Breaker when the holder does not own the auto-selected target', () => {
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      d.prices.MTRO = 9; // clearly above every other company's default step, still within ladder range
      // Holder owns nothing at all — no company to protect.
    });
    const before = s.prices.MTRO;
    s = drawCard(s, 'Bad Press');

    expect(s.circuitBreakerPrompt).toBeNull();
    expect(s.prices.MTRO).toBe(before - 2);
  });
});
