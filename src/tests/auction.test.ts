// Outstanding Shares replace Bank Auctions. Sold-back shares stay attached to
// their Sold-Out company and only the player landing there may buy them.

import { describe, expect, it } from 'vitest';
import { blocked, priceOf } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

const CODE = 'MEDI';

function withOutstanding(s: ReturnType<typeof started>, qty: number, claimHolder: number | null = 0) {
  return patch(s, (draft) => {
    draft.supply[CODE] = 0;
    draft.soldOut[CODE] = { code: CODE, claimHolder };
    draft.bankPool[CODE] = qty;
  });
}

function landOnMedi(s: ReturnType<typeof started>) {
  const placed = patch(s, (draft) => {
    draft.players[draft.cur].pos = 2;
    draft.players[draft.cur].hasCompletedLap = true;
    draft.turnPhase = 'preRoll';
  });
  return dispatch(placed, { t: 'roll' }, scriptedRng([1, 2]));
}

describe('Outstanding Shares — availability', () => {
  it('does not open an auction at Market Open', () => {
    let s = withOutstanding(started(2), 2);
    s = patch(s, (draft) => { draft.players[0].pos = 34; draft.turnPhase = 'preRoll'; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([1, 2]));

    expect(s.auction).toBeNull();
    expect(s.bankPool[CODE]).toBe(2);
    expect(s.outstandingBuy).toBeNull();
  });

  it('opens an exclusive offer when the current player lands on that company', () => {
    let s = withOutstanding(started(2), 3, 0);
    s = patch(s, (draft) => { draft.players[0].shares[CODE] = 8; });
    const expectedPrice = priceOf(s, CODE);
    s = landOnMedi(s);

    expect(s.outstandingBuy).toEqual({
      code: CODE,
      actor: 0,
      price: expectedPrice,
      available: 3,
      bought: 0,
    });
    expect(blocked(s)).toBe(true);
  });

  it('does not offer shares from a different company', () => {
    let s = withOutstanding(started(2), 2, 0);
    s = patch(s, (draft) => {
      draft.players[0].shares[CODE] = 9;
      draft.bankPool.OILW = 3;
    });
    s = landOnMedi(s);

    expect(s.outstandingBuy?.code).toBe(CODE);
    expect(s.outstandingBuy?.available).toBe(2);
  });
});

describe('Outstanding Shares — landed-space purchase', () => {
  it('lets the landing player buy any available and affordable quantity at current price', () => {
    let s = withOutstanding(started(2), 3, 0);
    s = patch(s, (draft) => { draft.players[0].shares[CODE] = 8; });
    s = landOnMedi(s);
    const sharePrice = s.outstandingBuy!.price;
    const priceStepBefore = s.prices[CODE];
    const cashBefore = s.players[0].cash;

    s = dispatch(s, { t: 'buyOutstandingShares', qty: 2 }, rng());

    expect(s.players[0].shares[CODE]).toBe(10);
    expect(s.players[0].cash).toBe(cashBefore - sharePrice * 2);
    expect(s.players[0].stockCostBasis[CODE]).toBe(sharePrice * 2);
    expect(s.bankPool[CODE]).toBe(1);
    expect(s.outstandingBuy?.bought).toBe(2);
    expect(s.prices[CODE]).toBe(priceStepBefore); // purchase does not move the market ladder
  });

  it('rejects quantities above the pool or the player’s buying power', () => {
    let s = withOutstanding(started(2), 2, 0);
    s = patch(s, (draft) => {
      draft.players[0].shares[CODE] = 9;
      draft.players[0].cash = 100;
    });
    s = landOnMedi(s);

    s = dispatch(s, { t: 'buyOutstandingShares', qty: 3 }, rng());
    s = dispatch(s, { t: 'buyOutstandingShares', qty: 1 }, rng());

    expect(s.players[0].shares[CODE]).toBe(9);
    expect(s.bankPool[CODE]).toBe(2);
  });

  it('keeps skipped shares outstanding for a future landing', () => {
    let s = withOutstanding(started(2), 2, 0);
    s = patch(s, (draft) => { draft.players[0].shares[CODE] = 9; });
    s = landOnMedi(s);
    s = dispatch(s, { t: 'outstandingBuyDone' }, rng());

    expect(s.outstandingBuy).toBeNull();
    expect(s.bankPool[CODE]).toBe(2);
    expect(blocked(s)).toBe(false);
  });

  it('resolves the landing payout before allowing an outstanding-share purchase', () => {
    let s = withOutstanding(started(2), 1, 0);
    s = patch(s, (draft) => {
      draft.cur = 1;
      draft.players[0].shares[CODE] = 4;
      draft.players[1].shares[CODE] = 4;
    });
    s = landOnMedi(s);

    expect(s.landingNotice?.kind).toBe('payout');
    s = dispatch(s, { t: 'buyOutstandingShares', qty: 1 }, rng());
    expect(s.players[1].shares[CODE]).toBe(4);

    s = dispatch(s, { t: 'ackLandingNotice' }, rng());
    s = dispatch(s, { t: 'buyOutstandingShares', qty: 1 }, rng());
    expect(s.players[1].shares[CODE]).toBe(5);
    expect(s.soldOut[CODE].claimHolder).toBe(1);
    expect(s.marketSignals[0]).toMatchObject({ kind: 'claim', title: `${CODE} Taken Over` });
  });
});
