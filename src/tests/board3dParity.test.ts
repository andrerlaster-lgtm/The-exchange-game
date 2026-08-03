import { describe, expect, it } from 'vitest';
import { buildActionCenter } from '../utils/buildBoard3DActionCenter';
import { COMMAND_PREFIX, isBoard3DCommand, takeNextBoard3DCommand } from '../utils/sync3dBoard';
import { dispatch, patch, rng, rollTo, started } from './helpers';

describe('3D command boundary', () => {
  it('accepts complete gameplay actions and rejects setup or malformed actions', () => {
    const now = Date.now();
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'roll' } })).toBe(true);
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'sell', code: 'MEDI', qty: 2 } })).toBe(true);
    expect(isBoard3DCommand({ t: 'dispatch', ts: now, action: { t: 'chooseInvestorTip' } })).toBe(true);
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

  it('preserves rapid IPO Buy then Done commands instead of overwriting the purchase', () => {
    const entries = new Map<string, string>([
      [`${COMMAND_PREFIX}0000000000001:000001`, JSON.stringify({ t: 'dispatch', ts: 1, action: { t: 'ipoBuyShare' } })],
      [`${COMMAND_PREFIX}0000000000002:000002`, JSON.stringify({ t: 'dispatch', ts: 2, action: { t: 'ipoBuyDone' } })],
    ]);
    const storage = {
      get length() { return entries.size; },
      key: (index: number) => [...entries.keys()][index] ?? null,
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => { entries.delete(key); },
    };

    expect(takeNextBoard3DCommand(storage)).toMatchObject({ action: { t: 'ipoBuyShare' } });
    expect(takeNextBoard3DCommand(storage)).toMatchObject({ action: { t: 'ipoBuyDone' } });
    expect(entries.size).toBe(0);
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
      draft.players[0].marketStance = 'bullish';
    });
    const center = buildActionCenter(s);

    expect(center.portfolio.rows?.[0].buttons?.map((entry) => entry.action.t)).toEqual(['sell']);
    expect(center.portfolio.buttons?.map((entry) => entry.action.t)).toEqual(['takeMargin', 'repayMargin']);
    expect(center.portfolio.title).toContain('Bullish Portfolio');
    expect(center.tradeDesk.players).toHaveLength(2);
    expect(center.canCallClose).toBe(true);
  });

  it('offers up to half a holding in 3D and disables quantities above the remaining allowance', () => {
    let s = patch(started(2), (draft) => {
      draft.turnPhase = 'acted';
      draft.players[0].shares.MEDI = 11;
    });
    let row = buildActionCenter(s).portfolio.rows?.[0];
    expect(row?.buttons?.map((entry) => entry.label)).toEqual(['Sell 1', 'Sell 2', 'Sell 3', 'Sell 4', 'Sell 5']);

    s = dispatch(s, { t: 'sell', code: 'MEDI', qty: 3 }, rng());
    row = buildActionCenter(s).portfolio.rows?.[0];
    expect(row?.detail).toContain('2 of 5 bank-sale shares left');
    expect(row?.buttons?.map((entry) => entry.disabled)).toEqual([false, false, true, true, true]);
  });

  it('offers both Investor Day paths and the follow-up company choice in 3D', () => {
    let s = patch(started(2), (draft) => { draft.players[0].shares.MEDI = 11; });
    s = rollTo(s, 31);
    const decision = buildActionCenter(s).required.find((entry) => entry.id === 'investor-day');

    expect(decision?.title).toBe('Investor Day · Choose One');
    expect(decision?.buttons?.map((entry) => entry.action.t)).toEqual(['chooseInvestorGrowth', 'chooseInvestorTip']);

    s = dispatch(s, { t: 'chooseInvestorGrowth' }, rng());
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

  it('lets a fresh IPO landing buy through the same action exposed in 3D', () => {
    let s = rollTo(started(2), 10);
    const code = s.ipoBuy!.code;
    const buy = buildActionCenter(s).required.find((entry) => entry.id === 'ipo-buy');

    expect(buy?.buttons?.[0]).toMatchObject({ action: { t: 'ipoBuyShare' }, disabled: false });
    s = dispatch(s, buy!.buttons![0].action, rng());
    expect(s.players[s.cur].shares[code]).toBe(1);
    expect(buildActionCenter(s).required.find((entry) => entry.id === 'ipo-buy')?.description).toContain('1/2 bought');
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
