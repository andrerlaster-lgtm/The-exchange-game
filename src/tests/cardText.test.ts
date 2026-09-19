// Card effect text must state the same move the card applies. The percentage
// redesign changed every price effect to basis points, but the printed text
// kept saying "1 step" / "2 steps" until 2026-09-19 — nothing tied the two.
import { describe, expect, it } from 'vitest';
import { CARDS } from '../data';
import type { Effect } from '../data/types';
import { moveSize } from '../utils/formatMoney';

function moveSizes(e: Effect): number[] {
  switch (e.k) {
    case 'sector': case 'all': case 'risk': case 'lowest': case 'highest': case 'pick':
      return [e.bp];
    case 'multi':
      return e.m.map((m) => m.bp);
    default:
      return [];
  }
}

describe('card effect text', () => {
  const cards = [...CARDS.ME, ...CARDS.FED];

  it('never describes moves in the old ladder "steps"', () => {
    for (const card of cards) expect(card.effect, card.title).not.toMatch(/\bsteps?\b/i);
  });

  it('states each price move with its real percentage and basis points', () => {
    for (const card of cards) {
      for (const size of moveSizes(card.eff)) {
        expect(card.effect, card.title).toContain(moveSize(size));
      }
    }
  });
});
