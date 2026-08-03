import { describe, expect, it } from 'vitest';
import { CARDS, LADDER } from '../data';
import { circuitBreakerOptions, effectImpacts } from '../engine';
import { dispatch, patch, rng, rollTo, started } from './helpers';

function drawRegime(state: ReturnType<typeof started>, title: 'Bull Run' | 'Bear Run') {
  const index = CARDS.ME.findIndex((card) => card.title === title);
  expect(index).toBeGreaterThanOrEqual(0);
  const ready = patch(state, (draft) => {
    draft.turnPhase = 'acted';
    draft.pendingDraws = ['ME'];
    draft.decks.ME = [index];
    draft.discard.ME = [];
  });
  return dispatch(ready, { t: 'draw', deck: 'ME' }, rng());
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
    const ipo = s.ipos[0].step;
    const cash = s.players.map((player) => player.cash);

    s = drawRegime(s, 'Bull Run');

    expect(s.prices.CCAI).toBe(high + 2);
    expect(s.prices.MEDI).toBe(medium + 1);
    expect(s.prices.SAFE).toBe(low);
    expect(s.ipos[0].step).toBe(ipo + 1);
    expect(s.players.map((player) => player.cash)).toEqual([cash[0] + 1_500, cash[1] + 500, cash[2] - 750]);
    expect(s.players.map((player) => player.marketStance)).toEqual(['balanced', 'balanced', 'balanced']);
  });

  it('rewards bearish play, penalizes bullish play, and sends money toward low-risk stocks in a Bear Run', () => {
    let s = patch(started(3), (draft) => {
      draft.players[0].marketStance = 'bullish';
      draft.players[1].marketStance = 'balanced';
      draft.players[2].marketStance = 'bearish';
      draft.ipos[0].revealed = true;
    });
    const high = s.prices.CCAI;
    const medium = s.prices.MEDI;
    const low = s.prices.SAFE;
    const ipo = s.ipos[0].step;
    const cash = s.players.map((player) => player.cash);

    s = drawRegime(s, 'Bear Run');

    expect(s.prices.CCAI).toBe(high - 2);
    expect(s.prices.MEDI).toBe(medium - 1);
    expect(s.prices.SAFE).toBe(low + 1);
    expect(s.ipos[0].step).toBe(ipo - 1);
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

    s = drawRegime(s, 'Bear Run');
    expect(s.circuitBreakerPrompt).not.toBeNull();
    expect(circuitBreakerOptions(s)).toContain('CCAI');
    expect(s.prices.CCAI).toBe(high);
    expect(s.players[0].cash).toBe(cash);

    s = dispatch(s, { t: 'playCircuitBreaker', code: 'CCAI' }, rng());
    expect(s.prices.CCAI).toBe(high);
    expect(s.prices.MEDI).toBe(medium - 1);
    expect(s.players[0].cash).toBe(cash - 1_500);
    expect(s.players[0].marketStance).toBe('balanced');
  });

  it('does not queue another Market Event when a Bull Run reaches the price ceiling', () => {
    let s = patch(started(2), (draft) => {
      draft.prices.CCAI = LADDER.length - 2;
    });
    s = drawRegime(s, 'Bull Run');
    expect(s.prices.CCAI).toBe(LADDER.length - 1);
    expect(s.pendingDraws).toEqual([]);
  });

  it('reports the same risk-based movements to Market Intelligence', () => {
    const s = patch(started(2), (draft) => { draft.ipos[0].revealed = true; });
    const bull = CARDS.ME.find((card) => card.title === 'Bull Run')!;
    const bear = CARDS.ME.find((card) => card.title === 'Bear Run')!;
    expect(effectImpacts(s, bull.eff)).toEqual(expect.arrayContaining([
      { code: 'CCAI', d: 2 }, { code: 'MEDI', d: 1 }, { code: s.ipos[0].code, d: 1 },
    ]));
    expect(effectImpacts(s, bear.eff)).toEqual(expect.arrayContaining([
      { code: 'CCAI', d: -2 }, { code: 'MEDI', d: -1 }, { code: 'SAFE', d: 1 }, { code: s.ipos[0].code, d: -1 },
    ]));
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
    s = patch(s, (draft) => { draft.players[0].cash = 500; });
    s = drawRegime(s, 'Bear Run');
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
