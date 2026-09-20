import { describe, expect, it } from 'vitest';
import { CARDS, CEILING_TRIGGER, IPO_RUN_BP, RUN_BP, SPACES, applyBasisPoints } from '../data';
import type { Effect } from '../data/types';
import { circuitBreakerOptions, effectImpacts } from '../engine';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

function landOnRegime(state: ReturnType<typeof started>, regime: 'bull' | 'bear') {
  const s = rollTo(state, 21);
  return dispatch(s, { t: 'rollRegime' }, scriptedRng([regime === 'bull' ? 6 : 1]));
}

describe('Bull and Bear Run market regimes', () => {
  it('moves risk groups, revealed IPOs, resolves stances, and resets them after a Bull Run', () => {
    let s = patch(started(3), (draft) => {
      draft.players[0].marketStance = 'bullish';
      draft.players[1].marketStance = 'balanced';
      draft.players[2].marketStance = 'bearish';
      draft.ipos[0].revealed = true;
    });
    const high = s.prices.CCAI;
    const medium = s.prices.MEDI;
    const low = s.prices.SAFE;
    const ipo = s.ipos[0].price;
    const cash = s.players.map((player) => player.cash);

    s = landOnRegime(s, 'bull');

    expect(s.prices.CCAI).toBe(applyBasisPoints(high, RUN_BP.High));
    expect(s.prices.MEDI).toBe(applyBasisPoints(medium, RUN_BP.Med));
    expect(s.prices.SAFE).toBe(low);
    expect(s.ipos[0].price).toBe(applyBasisPoints(ipo, IPO_RUN_BP));
    expect(s.players.map((player) => player.cash)).toEqual([cash[0] + 1_500, cash[1] + 500, cash[2] - 750]);
    expect(s.players.map((player) => player.marketStance)).toEqual(['balanced', 'balanced', 'balanced']);
  });

  it('rewards bearish play, penalizes bullish play, and leaves low-risk stocks genuinely stable in a Bear Run', () => {
    // 2026-09-18 balance pass (Option 1): Low risk used to GAIN a step on a
    // Bear Run (+1) — strictly better than "no change," so it could never
    // lose value to either Run while also earning the highest dividend yield
    // in the game. It now has zero Run exposure in either direction.
    let s = patch(started(3), (draft) => {
      draft.players[0].marketStance = 'bullish';
      draft.players[1].marketStance = 'balanced';
      draft.players[2].marketStance = 'bearish';
      draft.ipos[0].revealed = true;
    });
    const high = s.prices.CCAI;
    const medium = s.prices.MEDI;
    const low = s.prices.SAFE;
    const ipo = s.ipos[0].price;
    const cash = s.players.map((player) => player.cash);

    s = landOnRegime(s, 'bear');

    expect(s.prices.CCAI).toBe(applyBasisPoints(high, -RUN_BP.High));
    expect(s.prices.MEDI).toBe(applyBasisPoints(medium, -RUN_BP.Med));
    expect(s.prices.SAFE).toBe(low); // was low + 1 step
    expect(s.ipos[0].price).toBe(applyBasisPoints(ipo, -IPO_RUN_BP));
    expect(s.players.map((player) => player.cash)).toEqual([cash[0] - 1_500, cash[1] - 500, cash[2] + 1_500]);
  });

  it('lets Circuit Breaker protect one falling company before resolving Bear Run stance cash', () => {
    let s = patch(started(2), (draft) => {
      draft.players[0].shares.CCAI = 1;
      draft.players[0].marketStance = 'bullish';
      draft.circuitBreakerHolder = 0;
    });
    const high = s.prices.CCAI;
    const medium = s.prices.MEDI;
    const cash = s.players[0].cash;

    s = landOnRegime(s, 'bear');
    expect(s.circuitBreakerPrompt).not.toBeNull();
    expect(circuitBreakerOptions(s)).toContain('CCAI');
    expect(s.prices.CCAI).toBe(high);
    expect(s.players[0].cash).toBe(cash);

    s = dispatch(s, { t: 'playCircuitBreaker', code: 'CCAI' }, rng());
    expect(s.prices.CCAI).toBe(high);
    expect(s.prices.MEDI).toBe(applyBasisPoints(medium, -RUN_BP.Med));
    expect(s.players[0].cash).toBe(cash - 1_500);
    expect(s.players[0].marketStance).toBe('balanced');
  });

  it('does not queue another Market Event when a Bull Run crosses the $5,000 mark', () => {
    // A Run is card-driven, so it never queues a Market Event even though a
    // trade-driven move across the same mark would (see ceiling.test.ts) —
    // otherwise a Run could cascade into a card draw mid-resolution.
    let s = patch(started(2), (draft) => {
      draft.prices.CCAI = CEILING_TRIGGER - 25;
      draft.pendingDraws = [];
    });
    s = landOnRegime(s, 'bull');
    expect(s.prices.CCAI).toBeGreaterThan(CEILING_TRIGGER);
    expect(s.pendingDraws).toEqual([]);
  });

  it('reports the same risk-based movements to Market Intelligence', () => {
    const s = patch(started(2), (draft) => { draft.ipos[0].revealed = true; });
    const bull: Effect = { k: 'regime', regime: 'bull' };
    const bear: Effect = { k: 'regime', regime: 'bear' };
    expect(effectImpacts(s, bull)).toEqual(expect.arrayContaining([
      { code: 'CCAI', pct: 20 }, { code: 'MEDI', pct: 10 }, { code: s.ipos[0].code, pct: 5 },
    ]));
    // SAFE is deliberately absent from BOTH lists: Low risk has zero Run
    // exposure in either direction. This assertion used to expect SAFE to GAIN
    // in a Bear Run, because effectImpacts kept its own copy of the Run table
    // that still had the pre-2026-09-18 +1 and had drifted from the engine's.
    expect(effectImpacts(s, bear)).toEqual(expect.arrayContaining([
      { code: 'CCAI', pct: -20 }, { code: 'MEDI', pct: -10 }, { code: s.ipos[0].code, pct: -5 },
    ]));
    expect(effectImpacts(s, bear).some((i) => i.code === 'SAFE')).toBe(false);
    expect(effectImpacts(s, bull).some((i) => i.code === 'SAFE')).toBe(false);
  });

  it('spaces 16, 29 and 40 are plain Market Event spaces, and space 21 is the combined Market Swing space', () => {
    expect(SPACES[15]).toMatchObject({ n: 16, type: 'event', name: 'MARKET EVENT' });
    expect(SPACES[28]).toMatchObject({ n: 29, type: 'event', name: 'MARKET EVENT' });
    expect(SPACES[39]).toMatchObject({ n: 40, type: 'event', name: 'MARKET EVENT' });
    expect(SPACES[20]).toMatchObject({ n: 21, type: 'regime', name: 'MARKET SWING' });
    expect(CARDS.ME.some((card) => card.title === 'Bull Run' || card.title === 'Bear Run')).toBe(false);
  });
});

describe('Player market stance', () => {
  it('becomes Bullish after buying a company and Bearish after selling 3+ shares', () => {
    let s = rollTo(started(2), 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    expect(s.players[0].marketStance).toBe('bullish');

    s = patch(s, (draft) => { draft.trade = null; draft.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 3 }, rng());
    expect(s.players[0].marketStance).toBe('bearish');
  });

  it('becomes Bullish after taking margin and never lets a regime penalty push cash below zero', () => {
    let s = patch(started(2), (draft) => {
      draft.opts.margin = true;
      draft.turnPhase = 'acted';
      draft.trade = { scope: 'free', actionsLeft: 2 };
    });
    s = dispatch(s, { t: 'takeMargin' }, rng());
    expect(s.players[0].marketStance).toBe('bullish');
    s = patch(s, (draft) => {
      draft.players[0].cash = 500;
      draft.turnPhase = 'preRoll';
      draft.trade = null;
    });
    s = landOnRegime(s, 'bear');
    expect(s.players[0].cash).toBe(0);
  });

  it('becomes Bearish after selling 3+ shares in a completed private trade', () => {
    let s = patch(started(2), (draft) => {
      draft.players[0].shares.MEDI = 5;
      draft.turnPhase = 'acted';
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 3, direction: 'sell', price: 1_000 }, rng());
    s = dispatch(s, { t: 'acceptP2POffer', id: s.p2pOffers[0].id }, rng());
    expect(s.players[0].marketStance).toBe('bearish');
    expect(s.players[1].marketStance).toBe('balanced');
  });
});
