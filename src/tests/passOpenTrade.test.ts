// Market Open is payday only; Market Event draws come solely from landing on
// space 19. These tests pin that separation and confirm a forced draw from a
// draw-space (Fed/After-Hours/Market Event) never strips a concurrent trade.

import { describe, expect, it } from 'vitest';
import { SPACES } from '../data';
import { dispatch, patch, rollTo, scriptedRng, started } from './helpers';

describe('Market Open payday vs. Market Event space', () => {
  it('passing Market Open onto a stock space sets the trade but queues no draw', () => {
    const STOCK_SPACE = SPACES.find((sp) => sp.type === 'stock')!.n;
    let s = started(2);
    const total = 36;
    const from = ((STOCK_SPACE - 1 - 4 + total) % total) + 1; // land STOCK_SPACE after rolling 4
    s = patch(s, (d) => { d.players[d.cur].pos = from; d.turnPhase = 'preRoll'; });

    // Roll a 4 (2+2) — wraps past Market Open onto the stock space.
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));

    expect(s.players[s.cur].pos).toBe(STOCK_SPACE);
    expect(s.pendingDraws).toHaveLength(0);  // Market Open no longer forces an ME draw
    expect(s.trade?.scope).toBe('stock');    // landing trade is set
  });

  it('landing on the Market Event space queues exactly one ME draw', () => {
    let s = started(2);
    s = rollTo(s, 19);
    expect(s.players[s.cur].pos).toBe(19);
    expect(s.pendingDraws).toEqual(['ME']);
    expect(s.trade).toBeNull();  // Market Event space is not a trade space
  });

  it('a forced draw from a draw-space does not strip a pre-existing trade', () => {
    // Land on The Fed (forced FED draw) while a stock trade is already open, and
    // confirm resolving the draw leaves the trade intact.
    const FED_SPACE = SPACES.find((sp) => sp.type === 'fed')!.n;
    let s = started(2);
    s = rollTo(s, FED_SPACE);
    expect(s.pendingDraws).toEqual(['FED']);

    // Inject a concurrent stock trade (as could arise from other rules), then draw.
    s = patch(s, (d) => { d.trade = { scope: 'stock', code: 'MEDI', actionsLeft: 1 }; });
    s = dispatch(s, { t: 'draw', deck: 'FED' }, scriptedRng([]));

    expect(s.pendingDraws).toHaveLength(0);
    expect(s.trade?.scope).toBe('stock');
    expect(s.trade?.actionsLeft).toBeGreaterThan(0);
  });
});
