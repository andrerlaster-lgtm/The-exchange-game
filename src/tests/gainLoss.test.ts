import { describe, expect, it } from 'vitest';
import { REGULAR_SUPPLY, SALARY, STOCK_BY_CODE } from '../data';
import {
  getRankedPlayers, holdingGainLoss, marketGain, marketReturnPct, stockGainLoss,
} from '../engine';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

describe('stock cost basis and gain/loss', () => {
  it('records the fixed company price as basis and shows immediate unrealized G/L', () => {
    let s = rollTo(started(2), 5); // MEDI · Growth company
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());

    const player = s.players[0];
    const gl = holdingGainLoss(s, player, 'MEDI');
    expect(player.shares.MEDI).toBe(REGULAR_SUPPLY);
    expect(player.stockCostBasis.MEDI).toBe(STOCK_BY_CODE.MEDI.buyout);
    expect(gl.costBasis).toBe(7_500);
    expect(gl.marketValue).toBe(11 * 750);
    expect(gl.unrealized).toBe(750);
    expect(marketGain(s, player)).toBe(750);
  });

  it('turns price movement into unrealized G/L and a sale into proportional realized G/L', () => {
    let s = rollTo(started(2), 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (draft) => {
      draft.prices.MEDI += 1; // $750 -> $1,000
      draft.trade = null;
      draft.turnPhase = 'acted';
    });

    expect(holdingGainLoss(s, s.players[0], 'MEDI')).toMatchObject({
      marketValue: 11_000,
      costBasis: 7_500,
      unrealized: 3_500,
    });

    // Sell 2 back one step below market: 2 × $750 = $1,500 proceeds.
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    const holding = holdingGainLoss(s, s.players[0], 'MEDI');
    const total = stockGainLoss(s, s.players[0]);
    expect(s.players[0].shares.MEDI).toBe(9);
    expect(s.players[0].realizedStockGain).toBeCloseTo(136.36, 1);
    expect(holding.costBasis).toBeCloseTo(6_136.36, 1);
    expect(holding.unrealized).toBeCloseTo(2_863.64, 1);
    expect(total.total).toBeCloseTo(3_000, 5);
    expect(marketGain(s, s.players[0])).toBeCloseTo(3_000, 5);
  });

  it('shows an unrealized loss when the share price falls below the purchase basis', () => {
    let s = rollTo(started(2), 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (draft) => { draft.prices.MEDI -= 1; }); // $750 -> $500

    const gl = holdingGainLoss(s, s.players[0], 'MEDI');
    expect(gl.marketValue).toBe(5_500);
    expect(gl.costBasis).toBe(7_500);
    expect(gl.unrealized).toBe(-2_000);
    expect(stockGainLoss(s, s.players[0]).total).toBe(-2_000);
  });

  it('tracks negotiated P2P basis for the buyer and realized G/L for the seller', () => {
    let s = patch(started(2), (draft) => {
      draft.players[0].shares.MEDI = 2;
      draft.players[0].stockCostBasis.MEDI = 1_000;
    });
    s = dispatch(s, { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 1, direction: 'sell', price: 700 }, rng());
    s = dispatch(s, { t: 'acceptP2POffer', id: s.p2pOffers[0].id }, rng());

    expect(s.players[0].stockCostBasis.MEDI).toBe(500);
    expect(s.players[0].realizedStockGain).toBe(200);
    expect(s.players[1].stockCostBasis.MEDI).toBe(700);
  });

  it('records IPO purchase price as cost basis', () => {
    let s = rollTo(started(2), 10);
    const code = s.ipoBuy!.code;
    const price = s.ipoBuy!.price;
    s = dispatch(s, { t: 'ipoBuyShare' }, rng());

    expect(s.players[0].shares[code]).toBe(1);
    expect(s.players[0].stockCostBasis[code]).toBe(price);
  });
});

describe('Gain/Loss Mode', () => {
  it('excludes salary from Market Gain', () => {
    let s = patch(started(2), (draft) => { draft.players[0].pos = 34; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));

    expect(s.players[0].salaryCollected).toBe(SALARY);
    expect(s.players[0].cash).toBe(s.opts.startCash + SALARY);
    expect(marketGain(s, s.players[0])).toBe(0);
    expect(marketReturnPct(s, s.players[0])).toBe(0);
  });

  it('changes the winner from highest net worth to highest salary-adjusted gain', () => {
    const base = patch(started(2), (draft) => {
      draft.players[0].cash = 31_000;
      draft.players[0].salaryCollected = 1_000; // Market Gain $0
      draft.players[1].cash = 30_500;
      draft.players[1].salaryCollected = 0;     // Market Gain +$500
    });

    const standard = patch(base, (draft) => { draft.opts.scoringMode = 'netWorth'; });
    const gainLoss = patch(base, (draft) => { draft.opts.scoringMode = 'gainLoss'; });
    expect(getRankedPlayers(standard)[0].playerIdx).toBe(0);
    expect(getRankedPlayers(gainLoss)[0].playerIdx).toBe(1);
    expect(getRankedPlayers(gainLoss)[0].score).toBe(500);
  });
});
