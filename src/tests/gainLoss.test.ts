import { describe, expect, it } from 'vitest';
import { ME_CARDS, REGULAR_SUPPLY, SALARY, STOCK_BY_CODE } from '../data';
import {
  getRankedPlayers, holdingDividendInfo, holdingGainLoss, lapReturnPct, marketGain, marketReturnPct, reduce, stockGainLoss,
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

  it('a company buy-out is still value-neutral even when the price already fell before the purchase (2026-08-23)', () => {
    // The whole-company acquisition price used to be fixed to the tier's
    // STARTING price regardless of where the ladder actually sat. Buying a
    // company whose price had already dropped before you bought it out
    // still charged the stale, higher starting price — booking an immediate
    // unrealized LOSS the instant you bought, before you'd held it for even
    // one turn. This was the reported bug: "buying at a discount" should
    // never itself hurt Gain/Loss. The buy-out cost is now tied to the live
    // price, so cost basis always equals market value at the moment of
    // purchase, no matter what the price did beforehand.
    let s = rollTo(started(2), 5); // MEDI · Growth, opens at $750
    s = patch(s, (draft) => { draft.prices.MEDI -= 1; }); // price already fell to $500 BEFORE buying
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());

    const gl = holdingGainLoss(s, s.players[0], 'MEDI');
    expect(gl.marketValue).toBe(5_500); // 11 x $500
    expect(gl.costBasis).toBe(5_500);   // charged the live price, not the stale $8,250
    expect(gl.unrealized).toBe(0);
    expect(marketGain(s, s.players[0])).toBe(0);
  });

  it('a company buy-out is also value-neutral when the price had already risen before the purchase', () => {
    let s = rollTo(started(2), 5);
    s = patch(s, (draft) => { draft.prices.MEDI += 1; }); // price already rose to $1,000
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());

    const gl = holdingGainLoss(s, s.players[0], 'MEDI');
    expect(gl.marketValue).toBe(11_000); // 11 x $1,000
    expect(gl.costBasis).toBe(11_000);   // no free windfall gain either
    expect(gl.unrealized).toBe(0);
  });

  it('an Opening Bell company purchase is also priced live, not at the stale starting tier price', () => {
    const cardIndex = ME_CARDS.findIndex((card) => card.title === 'Opening Bell');
    const r = rng('opening-bell-discount');
    let s = started(2, r);
    s = patch(s, (draft) => {
      draft.pendingDraws = ['ME'];
      draft.decks.ME = [cardIndex];
      draft.discard.ME = [];
      draft.cur = 0;
      draft.prices.MEDI -= 1; // MEDI already at a discount before the card is even drawn
      // Make MEDI the only untouched company so the card's random pick is
      // forced onto it, instead of leaving this test's outcome to seed luck.
      for (const code of Object.keys(draft.supply)) {
        if (code !== 'MEDI') draft.players[0].shares[code] = 1;
      }
    });
    s = reduce(s, { t: 'draw', deck: 'ME' }, r);
    expect(s.openingBellPrompt?.code).toBe('MEDI');
    s = reduce(s, { t: 'buyOpeningBell' }, r);

    const gl = holdingGainLoss(s, s.players[0], 'MEDI');
    expect(gl.costBasis).toBe(5_500); // live discounted price, not the stale $8,250
    expect(gl.unrealized).toBe(0);
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

describe('holdingDividendInfo', () => {
  it('reports both yield-to-price and yield-to-cost, and they diverge when price has moved since purchase', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].shares.MEDI = 4;              // MEDI div=$50/share, control threshold 6
      draft.players[0].stockCostBasis.MEDI = 4_000;   // bought at an average $1,000/share
      // current price stays at MEDI's $750 opening step, so yield-to-price and
      // yield-to-cost are computed against two different denominators.
    });
    const info = holdingDividendInfo(s, s.players[0], 'MEDI');
    expect(info.printed).toBe(50);
    expect(info.isController).toBe(false);
    expect(info.sharesToControl).toBe(2);
    expect(info.perLap).toBe(200); // 50 x 4, no Controller multiplier
    expect(info.yieldPct).toBeCloseTo((200 / 3_000) * 100, 6);      // to current price ($750 x 4)
    expect(info.yieldOnCostPct).toBeCloseTo((200 / 4_000) * 100, 6); // to cost ($1,000 x 4)
    expect(info.yieldPct).not.toBeCloseTo(info.yieldOnCostPct, 1);
  });

  it('applies the Controller multiplier once the threshold is reached', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].shares.MEDI = 6;
      draft.players[0].stockCostBasis.MEDI = 4_500;
    });
    const info = holdingDividendInfo(s, s.players[0], 'MEDI');
    expect(info.isController).toBe(true);
    expect(info.sharesToControl).toBe(0);
    expect(info.perLap).toBe(Math.round(50 * 6 * 1.5)); // 450
  });

  it('reports no dividend (not 0%-that-looks-computed) for a zero-div IPO', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].shares.NDRV = 2; // NDRV prints $0/share
    });
    const info = holdingDividendInfo(s, s.players[0], 'NDRV');
    expect(info.printed).toBe(0);
    expect(info.perLap).toBe(0);
    expect(info.yieldPct).toBe(0);
  });
});

describe('lapReturnPct', () => {
  it('is 0 at game start alongside a 0 marketReturnPct', () => {
    const s = started();
    expect(marketReturnPct(s, s.players[0])).toBe(0);
    expect(lapReturnPct(s, s.players[0])).toBe(0);
  });

  it('is the geometric (CAGR-style) per-lap rate, not the flat cumulative % divided by laps', () => {
    const s = patch(started(2), (draft) => {
      draft.players[0].cash += 3_000; // +$3,000 on a $30,000 start = +10% cumulative
      draft.lap = 4;
    });
    expect(marketReturnPct(s, s.players[0])).toBeCloseTo(10, 6);
    // (1.10)^(1/4) - 1, in percent — NOT 10/4 = 2.5.
    const expected = (Math.pow(1.10, 1 / 4) - 1) * 100;
    expect(lapReturnPct(s, s.players[0])).toBeCloseTo(expected, 9);
    expect(lapReturnPct(s, s.players[0])).toBeCloseTo(2.4114, 3);
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
