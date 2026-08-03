import { useEffect, useRef } from 'react';
import type { TurnPhase } from '../../engine';
import { blocked, canTradeNow, fedSignalForStock, gameProgressLabel, getRankedPlayers, getStockMovementStatus, priceOf } from '../../engine';
import { fullCompanyDividendPerMarketOpen, SECTORS, STOCK_BY_CODE, STOCKS } from '../../data';
import { useGameState, useDispatch } from '../../store';
import { buildActionCenter } from '../../utils/buildBoard3DActionCenter';
import { sync3dBoard, isBoard3DCommand, takeNextBoard3DCommand } from '../../utils/sync3dBoard';

export default function Board3DSync() {
  const s = useGameState();
  const dispatch = useDispatch();
  const prevPhaseRef = useRef<TurnPhase>(s.turnPhase);
  const preRollPositions = useRef<Record<number, number>>({});

  // Poll for commands from 3D board (polling is reliable; cross-tab storage events can be suppressed)
  useEffect(() => {
    const interval = setInterval(() => {
      const cmd = takeNextBoard3DCommand(localStorage);
      if (!isBoard3DCommand(cmd)) return;
      const fresh = Date.now() - cmd.ts < 5000 && cmd.ts <= Date.now() + 1000;
      // Reject stale commands (older than 5s) — guards against leftover keys from crashed sessions
      if (fresh && (s.phase === 'play' || cmd.action.t === 'newGame')) dispatch(cmd.action);
    }, 100);
    return () => clearInterval(interval);
  }, [dispatch, s.phase]);

  // Sync state to 3D board on every render
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const cur = s.turnPhase;
    prevPhaseRef.current = cur;

    if (cur === 'preRoll') {
      s.players.forEach((p, i) => { preRollPositions.current[i] = p.pos; });
    }

    const players = s.players.map(p => ({
      pos: p.pos,
      piece: p.piece,
      color: p.color,
      name: p.name,
      cash: p.cash,
      margin: p.margin,
      marketStance: p.marketStance,
    }));

    let move: { from: number; to: number; playerIdx: number } | undefined;
    if (prev === 'preRoll' && cur === 'acted') {
      const from = preRollPositions.current[s.cur] ?? s.players[s.cur].pos;
      const to = s.players[s.cur].pos;
      if (from !== to) move = { from, to, playerIdx: s.cur };
    }

    const leaderboard = getRankedPlayers(s).map(r => ({
      rank: r.rank,
      playerIdx: r.playerIdx,
      name: r.name,
      color: r.color,
      piece: s.players[r.playerIdx].piece,
      nw: r.nw,
      marketStance: s.players[r.playerIdx].marketStance,
    }));

    const card = s.card
      ? { deck: s.card.deck, title: s.card.title, effect: s.card.effect, strategyOnly: !!s.card.strategyOnly }
      : null;

    const p = s.players[s.cur];
    // Head of the forced-draw queue — sent to the 3D board as a single value.
    const nextDraw = s.pendingDraws[0] ?? null;
    let tradeInfo = null;
    if (!nextDraw && canTradeNow(s) && s.trade?.scope === 'stock' && s.trade.code && s.trade.actionsLeft > 0) {
      const code = s.trade.code;
      const st = STOCK_BY_CODE[code];
      if (st) {
        tradeInfo = {
          code,
          name: st.name,
          price: priceOf(s, code),
          owned: p.shares[code] ?? 0,
          supply: s.supply[code] ?? 0,
          cash: p.cash,
          actionsLeft: s.trade.actionsLeft,
          sector: SECTORS[st.sector].name,
          sectorColor: st.color,
          glyph: SECTORS[st.sector].glyph,
          risk: st.risk,
          dividend: st.div,
          dividendPerLap: fullCompanyDividendPerMarketOpen(st),
          stepDiff: (s.prices[code] ?? st.step) - st.step,
          tier: st.tier,
          buyoutPrice: st.buyout,
          fedSignal: fedSignalForStock(s, code),
        };
      }
    }

    // Live price snapshot for every regular stock (tiles + hover tooltips)
    const prices: Record<string, { p: number; d: -1 | 0 | 1; s: number; so?: boolean; claim?: number | null }> = {};
    for (const st of STOCKS) {
      const mv = getStockMovementStatus(st.code, s);
      const rec = s.soldOut[st.code];
      prices[st.code] = {
        p: priceOf(s, st.code),
        d: mv.direction === 'up' ? 1 : mv.direction === 'down' ? -1 : 0,
        s: s.supply[st.code] ?? 0,
        so: !!rec,
        claim: rec ? rec.claimHolder : undefined,
      };
    }

    sync3dBoard({
      players,
      move,
      ts: Date.now(),
      canRoll: s.phase === 'play' && s.turnPhase === 'preRoll',
      dice: s.dice as [number | null, number | null],
      bonusRoll: s.bonusRollPending ? 'earned' : (s.turnPhase === 'preRoll' && s.bonusRollUsed ? 'active' : null),
      currentPlayerIdx: s.cur,
      progress: gameProgressLabel(s),
      leaderboard,
      card,
      pendingDraw: nextDraw,
      canEndTurn: s.phase === 'play' && s.turnPhase === 'acted' && !blocked(s),
      tradeInfo,
      actionCenter: buildActionCenter(s),
      prices,
      drawEvent: s.lastDraw,
      deckCounts: {
        ME: s.decks.ME.length,
        FED: s.decks.FED.length,
        IPO: s.ipos.filter((ip) => !ip.revealed).length,
      },
    });
  });

  return null;
}
