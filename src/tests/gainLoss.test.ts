import { describe, expect, it } from 'vitest';
import { REGULAR_SUPPLY, SALARY, STOCK_BY_CODE } from '../data';
import {
  getRankedPlayers, holdingGainLoss, marketGain, marketReturnPct, stockGainLoss,
} from '../engine';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

describe('stock cost basis and gain/loss', () => {
  // 2026-08-21 Market Overhaul: buyout is now REGULAR_SUPPLY (11) x the
  // tier's per-share price, so a buy-out is value-neutral at the moment of
  // purchase — acquiring an asset must never, by itself, create a gain or
  // loss. This replaces the old assertion that a buy-out showed an
  // immediate +$750 phantom gain, which was the reported bug (Stage A
  // finding: the old buyout constants were priced at 10 shares but granted
  // 11, handing out a free share every time).
  it('a company buy-out produces no unrealized gain — the corrected accounting invariant', () => {
    let s = rollTo(started(2), 5); // MEDI · Growth company
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());

    const player = s.players[0];
    const gl = holdingGainLoss(s, player, 'MEDI');
    expect(player.shares.MEDI).toBe(REGULAR_SUPPLY);
    expect(player.stockCostBasis.MEDI).toBe(STOCK_BY_CODE.MEDI.buyout);
    expect(gl.costBasis).toBe(8_250);
    expect(gl.marketValue).toBe(11 * 750);
    expect(gl.unrealized).toBe(0);
    expect(marketGain(s, player)).toBe(0);
  });

  it('buy-out price equals supply times base price for every tier', () => {
    for (const stock of Object.values(STOCK_BY_CODE)) {
      expect(stock.buyout).toBe(REGULAR_SUPPLY * stock.base);
    }
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
      costBasis: 8_250,
      unrealized: 2_750,
    });

    // Sell 2 back one step below market: 2 × $750 = $1,500 proceeds. Basis
    // removed proportionally: 8,250 × 2/11 = 1,500 exactly — proceeds equal
    // removed basis, so this particular sale is itself gain-neutral.
    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 2 }, rng());
    const holding = holdingGainLoss(s, s.players[0], 'MEDI');
    const total = stockGainLoss(s, s.players[0]);
    expect(s.players[0].shares.MEDI).toBe(9);
    expect(s.players[0].realizedStockGain).toBe(0);
    expect(holding.costBasis).toBe(6_750);
    expect(holding.unrealized).toBe(2_250);
    expect(total.total).toBe(2_250);
    expect(marketGain(s, s.players[0])).toBe(2_250);
  });

  it('shows an unrealized loss when the share price falls below the purchase basis', () => {
    let s = rollTo(started(2), 5);
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (draft) => { draft.prices.MEDI -= 1; }); // $750 -> $500

    const gl = holdingGainLoss(s, s.players[0], 'MEDI');
    expect(gl.marketValue).toBe(5_500);
    expect(gl.costBasis).toBe(8_250);
    expect(gl.unrealized).toBe(-2_750);
    expect(stockGainLoss(s, s.players[0]).total).toBe(-2_750);
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
