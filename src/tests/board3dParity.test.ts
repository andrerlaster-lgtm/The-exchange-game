import { describe, expect, it } from 'vitest';
import { buildActionCenter } from '../utils/buildBoard3DActionCenter';
import { isBoard3DCommand } from '../utils/sync3dBoard';
import { patch, rollTo, started } from './helpers';

describe('3D command boundary', () => {
  it('accepts complete gameplay actions and rejects setup or malformed actions', () => {
    const now = Date.now();
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'roll' } })).toBe(true);
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'sell', code: 'MEDI', qty: 2 } })).toBe(true);
    expect(isBoard3DCommand({
      t: 'dispatch', ts: now,
      action: { t: 'proposeP2POffer', from: 0, to: 1, code: 'MEDI', qty: 1, direction: 'sell', price: 500 },
    })).toBe(true);

    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'newGame' } })).toBe(true);
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'startGame' } })).toBe(false);
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'sell', qty: 1 } })).toBe(false);
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'draw', deck: 'IPO' } })).toBe(false);
    expect(isBoard3DCommand({ t: 'roll', ts: now })).toBe(false);
  });
});

describe('3D Action Center parity', () => {
  it('labels the pre-roll state as ready instead of incorrectly requiring an action', () => {
    expect(buildActionCenter(started(2)).status).toBe('Ready to roll');
  });

  it('provides portfolio, margin, bank-sale, player-trade, and close controls', () => {
    const s = patch(started(2), (draft) => {
      draft.turnPhase = 'acted';
      draft.players[0].shares.MEDI = 2;
      draft.players[0].margin = 2_000;
      draft.players[0].cash = 10_000;
    });
    const center = buildActionCenter(s);

    expect(center.portfolio.rows?.[0].buttons?.map((entry) => entry.action.t)).toEqual(['sell', 'sell']);
    expect(center.portfolio.buttons?.map((entry) => entry.action.t)).toEqual(['takeMargin', 'repayMargin']);
    expect(center.tradeDesk.players).toHaveLength(2);
    expect(center.canCallClose).toBe(true);
  });

  it('turns Investor Day into a selectable 3D action instead of a 2D-only hint', () => {
    let s = patch(started(2), (draft) => { draft.players[0].shares.MEDI = 11; });
    s = rollTo(s, 31);
    const panel = buildActionCenter(s).required.find((entry) => entry.id === 'pick-target');

    expect(panel?.title).toBe('Investor Day');
    expect(panel?.rows?.[0].buttons?.[0].action).toEqual({ t: 'pickTarget', code: 'MEDI' });
  });

  it('exposes every blocking flow through actionable 3D panels', () => {
    const s = patch(started(2), (draft) => {
      draft.turnPhase = 'acted';
      draft.marketOpenWindow = true;
      draft.auction = {
        code: 'MEDI', poolLeft: 1, startPrice: 500, highBid: 0,
        highBidder: null, actor: 0, active: [0, 1],
      };
      draft.pendingDraws = ['FED'];
      draft.marginCall = { player: 0, owed: 2_000 };
      draft.players[0].shares.MEDI = 1;
      draft.etfPick = 'GRW';
    });
    const center = buildActionCenter(s);
    const ids = center.required.map((entry) => entry.id);

    expect(ids).toEqual(expect.arrayContaining(['market-open', 'auction', 'margin-call', 'draw', 'etf']));
    expect(center.required.find((entry) => entry.id === 'auction')?.numberAction?.action).toBe('auctionBid');
    expect(center.required.find((entry) => entry.id === 'margin-call')?.rows?.[0].buttons?.[0].action.t).toBe('marginSell');
    expect(center.required.find((entry) => entry.id === 'draw')?.buttons?.[0].action).toEqual({ t: 'draw', deck: 'FED' });
    expect(center.required.find((entry) => entry.id === 'etf')?.buttons?.map((entry) => entry.action.t)).toEqual(['buyEtf', 'skipEtf']);
  });

  it('provides both IPO selection and IPO purchase controls', () => {
    const listState = patch(started(2), (draft) => {
      draft.turnPhase = 'acted';
      draft.ipos[0].revealed = true;
      draft.ipoListPick = true;
    });
    const list = buildActionCenter(listState).required.find((entry) => entry.id === 'ipo-list');
    expect(list?.rows?.[0].buttons?.[0].action.t).toBe('pickKnownIpo');
    expect(list?.buttons?.[0].action.t).toBe('skipIpo');

    const buyState = patch(listState, (draft) => {
      draft.ipoListPick = false;
      draft.ipoBuy = { code: draft.ipos[0].code, max: 2, bought: 0, price: 500, actor: 0 };
    });
    const buy = buildActionCenter(buyState).required.find((entry) => entry.id === 'ipo-buy');
    expect(buy?.buttons?.map((entry) => entry.action.t)).toEqual(['ipoBuyShare', 'ipoBuyDone']);
  });

  it('keeps final standings and new-game setup reachable from 3D after Market Close', () => {
    const s = patch(started(2), (draft) => { draft.phase = 'over'; });
    const center = buildActionCenter(s);
    const gameOver = center.required.find((entry) => entry.id === 'game-over');

    expect(center.status).toBe('Game over');
    expect(center.canCallClose).toBe(false);
    expect(gameOver?.description).toContain('#1');
    expect(gameOver?.buttons?.[0].action.t).toBe('newGame');
    expect(center.tradeDesk.players).toHaveLength(0);
  });
});
