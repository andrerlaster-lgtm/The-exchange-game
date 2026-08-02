// Standalone TradingDesk panel — can be embedded in ActionPanel or used independently.

import { STOCKS } from '../../data';
import type { Stock } from '../../data/types';
import { priceOf } from '../../engine';
import type { Action, GameState } from '../../engine';
import { useDispatch, useGameState } from '../../store';
import { canTradeNow } from '../../engine';

export default function TradingDesk() {
  const s = useGameState();
  const dispatch = useDispatch();

  if (!canTradeNow(s)) return null;

  const tradeable: Stock[] = s.trade?.scope === 'stock'
    ? [s.trade.code ? { ...STOCKS.find((st) => st.code === s.trade!.code)! } as Stock : STOCKS[0]]
    : STOCKS;
  const isStock = s.trade?.scope === 'stock';

  return <Desk tradeable={tradeable} s={s} dispatch={dispatch} isStock={!!isStock} />;
}

export function Desk({ tradeable, s, dispatch, isStock }: {
  tradeable: Stock[]; s: GameState; dispatch: (a: Action) => void; isStock: boolean;
}) {
  const p = s.players[s.cur];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
      {tradeable.map((st) => {
        const price = priceOf(s, st.code);
        const owned = p.shares[st.code] ?? 0;
        const supply = s.supply[st.code] ?? 0;
        return (
          <div key={st.code} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span className="mono" style={{ color: 'var(--accent)', width: 44 }}>{st.code}</span>
            <span className="muted" style={{ flex: 1 }}>{st.name}</span>
            <span className="mono">${price.toLocaleString()}</span>
            <span className="muted" style={{ width: 22 }}>×{owned}</span>
            <button style={{ fontSize: 11, padding: '3px 8px' }}
              disabled={supply <= 0 || p.cash < price}
              onClick={() => dispatch({ t: 'buy', code: st.code })}>Buy</button>
            <button style={{ fontSize: 11, padding: '3px 8px' }}
              disabled={owned <= 0}
              onClick={() => dispatch({ t: 'sell', code: st.code })}>Sell</button>
            {isStock && (
              <button style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => dispatch({ t: 'skipStock', code: st.code })}>Skip</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
