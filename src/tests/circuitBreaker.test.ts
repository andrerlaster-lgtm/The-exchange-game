import { describe, expect, it } from 'vitest';
import { CIRCUIT_BREAKER_INDEX, ME_CARDS } from '../data';
import { blocked, circuitBreakerOptions } from '../engine';
import { dispatch, patch, rng, started } from './helpers';

function drawCard(
  s: ReturnType<typeof started>,
  deck: 'ME',
  title: string,
) {
  const cards = ME_CARDS;
  const idx = cards.findIndex((card) => card.title === title);
  if (idx < 0) throw new Error(`Missing ${title} card`);
  const ready = patch(s, (d) => {
    d.turnPhase = 'acted';
    d.pendingDraws = [deck];
    d.decks[deck] = [idx, ...d.decks[deck].filter((i) => i !== idx)];
  });
  return dispatch(ready, { t: 'draw', deck }, rng());
}

describe('Circuit Breaker hold card', () => {
  it('leaves the Market Event deck and stays with the player who draws it', () => {
    let s = started(2);
    s = drawCard(s, 'ME', 'Circuit Breaker');

    expect(s.circuitBreakerHolder).toBe(0);
    expect(s.discard.ME).not.toContain(CIRCUIT_BREAKER_INDEX);
    expect(ME_CARDS[CIRCUIT_BREAKER_INDEX].eff.k).toBe('circuitBreaker');
  });

  it('pauses a negative Market Event for the holder, even on another player’s turn', () => {
    let s = patch(started(2), (d) => {
      d.cur = 0;
      d.circuitBreakerHolder = 1;
      d.players[1].shares.CCAI = 11;
    });
    const before = s.prices.CCAI;
    s = drawCard(s, 'ME', 'Tech Earnings Low');

    expect(s.prices.CCAI).toBe(before);
    expect(s.circuitBreakerPrompt?.player).toBe(1);
    expect(circuitBreakerOptions(s)).toEqual(['CCAI']);
    expect(blocked(s)).toBe(true);
  });

  it('protects one owned company from the card’s entire drop, then discards itself', () => {
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      d.players[0].shares.CCAI = 11;
    });
    const protectedBefore = s.prices.CCAI;
    const unprotectedBefore = s.prices.CYBS;
    s = drawCard(s, 'ME', 'Tech Earnings Low');
    s = dispatch(s, { t: 'playCircuitBreaker', code: 'CCAI' }, rng());

    expect(s.circuitBreakerPrompt).toBeNull();
    expect(s.circuitBreakerHolder).toBeNull();
    expect(s.discard.ME).toContain(CIRCUIT_BREAKER_INDEX);
    expect(s.prices.CCAI).toBe(protectedBefore);
    expect(s.prices.CYBS).toBe(unprotectedBefore - 1);
  });

  it('lets the holder pass and keep the card for later', () => {
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      d.players[0].shares.CCAI = 11;
    });
    const before = s.prices.CCAI;
    s = drawCard(s, 'ME', 'Tech Earnings Low');
    s = dispatch(s, { t: 'passCircuitBreaker' }, rng());

    expect(s.circuitBreakerPrompt).toBeNull();
    expect(s.circuitBreakerHolder).toBe(0);
    expect(s.prices.CCAI).toBe(before - 1);
  });

  it('also shields a chosen company from a targeted negative Market Event', () => {
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      d.players[0].shares.MEDI = 11;
    });
    const before = s.prices.MEDI;
    s = drawCard(s, 'ME', 'Earnings Miss');
    s = dispatch(s, { t: 'playCircuitBreaker', code: 'MEDI' }, rng());
    expect(s.pick?.protectedCodes).toContain('MEDI');

    s = dispatch(s, { t: 'pickTarget', code: 'MEDI' }, rng());
    expect(s.prices.MEDI).toBe(before);
  });

  it('does not spend or prompt the card for a positive Market Event', () => {
    let s = patch(started(2), (d) => {
      d.circuitBreakerHolder = 0;
      d.players[0].shares.CCAI = 11;
    });
    const before = s.prices.CCAI;
    s = drawCard(s, 'ME', 'Tech Earnings High');

    expect(s.circuitBreakerPrompt).toBeNull();
    expect(s.circuitBreakerHolder).toBe(0);
    expect(s.prices.CCAI).toBe(before + 1);
  });
});
