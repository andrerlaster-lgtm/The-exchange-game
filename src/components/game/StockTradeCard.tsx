// The landed-stock / Free-Trading-Day trade panel — "the card" that appears when
// a player lands on a stock. Lives in the left column under Decks & Pools.
// Buying the landed stock (or the Free Trading Day list) happens here; selling any
// owned stock is handled separately by the Trading Market on the board.

import { MARGIN_INCREMENT, MARGIN_MAX, REGULAR_SUPPLY, STOCK_BY_CODE, STOCKS, WEAK_DEMAND_THRESHOLD } from '../../data';
import type { Stock } from '../../data/types';
import { bankSellRemaining, canTradeNow, priceOf, sellBackPrice } from '../../engine';
import { useDispatch, useGameState } from '../../store';
import TradeTicket from './TradeTicket';
import FedSignalBadge from './FedSignalBadge';

export default function StockTradeCard() {
  const s = useGameState();
  const dispatch = useDispatch();
  const p = s.players[s.cur];

  const canTrade = canTradeNow(s);
  const actionsLeft = s.trade?.actionsLeft ?? 0;
  const isFree = s.trade?.scope === 'free';
  const isStock = s.trade?.scope === 'stock';
  const nextDraw = s.pendingDraws[0] ?? null;
  const tradeable: Stock[] = s.trade
    ? isStock ? [STOCK_BY_CODE[s.trade.code!]] : STOCKS
    : [];

  // Only show while there's an active Trade Step to resolve and no forced draw pending.
  if (nextDraw || tradeable.length === 0) return null;
  if (!canTrade && !(isStock && actionsLeft === 0)) return null;

  const weakCount = isStock && s.trade?.code ? (s.skips[s.trade.code] ?? 0) : 0;
  const canAct = actionsLeft > 0;
  const hasTradeOrIpo = !!s.trade || s.ipoListPick || !!s.ipoBuy;

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="slabel">{isStock ? 'Stock Space' : 'Free Trading Day'}</span>

      {/* Context bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 10px', borderRadius: 6,
        background: 'rgba(74,48,25,0.05)',
        border: '1px solid rgba(74,48,25,0.08)',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: isStock ? 'var(--accent)' : 'var(--green)',
          textTransform: 'uppercase',
          flex: 1,
        }}>
          {isStock ? 'Buy the Company or Skip' : `${actionsLeft} action${actionsLeft !== 1 ? 's' : ''} left`}
        </span>
        {isStock && weakCount > 0 && (
          <span style={{
            fontSize: 10, padding: '1px 7px', borderRadius: 3,
            background: 'var(--red-dim)', color: 'var(--red)',
            border: '1px solid rgba(239,68,68,0.22)',
          }}>Weak Demand {weakCount}/{WEAK_DEMAND_THRESHOLD}</span>
        )}
        {hasTradeOrIpo && s.opts.margin && (() => {
          // A full $2,000 increment must never push the balance past the cap —
          // checking only "already at the cap" would let a mid-value balance
          // (e.g. $2,300, reachable via a partial margin-call repayment) take a
          // full increment and breach it (e.g. $2,300 -> $4,300).
          const wouldExceedCap = p.margin + MARGIN_INCREMENT > MARGIN_MAX;
          return (
            <button style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => dispatch({ t: 'takeMargin' })}
              disabled={wouldExceedCap}
              title={wouldExceedCap ? `Margin capped at $${MARGIN_MAX.toLocaleString()}` : undefined}>
              Margin +$2k
            </button>
          );
        })()}
      </div>

      {canAct && isStock && tradeable[0] && (
        <TradeTicket code={tradeable[0].code} s={s} dispatch={dispatch} weakCount={weakCount} canAct={canAct} />
      )}

      {canAct && isFree && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
          {tradeable.map((st) => {
            const price = priceOf(s, st.code);
            const sellPrice = sellBackPrice(s, st.code);
            const owned = p.shares[st.code] ?? 0;
            const sellRemaining = bankSellRemaining(s, st.code);
            const supply = s.supply[st.code] ?? 0;
            const untouched = supply === REGULAR_SUPPLY; // whole company still available to buy out
            const buyoutCost = st.buyout;
            return (
              <div key={st.code} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                padding: '4px 8px', borderRadius: 5,
                background: 'rgba(74,48,25,0.05)',
                border: '1px solid rgba(74,48,25,0.06)',
              }}>
                <span className="mono" style={{ color: 'var(--accent)', width: 44, fontSize: 11 }}>{st.code}</span>
                <span style={{ color: 'var(--muted)', flex: 1, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                  <FedSignalBadge s={s} code={st.code} compact />
                </span>
                <span className="mono" style={{ fontSize: 11 }}>${price.toLocaleString()}</span>
                <span style={{ color: 'var(--muted)', width: 22, fontSize: 11 }}>×{owned}</span>
                {untouched ? (
                  <button style={{ fontSize: 11, padding: '2px 8px' }}
                    disabled={p.cash < buyoutCost}
                    title={`${st.tier} tier · buy the whole company for $${buyoutCost.toLocaleString()}`}
                    onClick={() => dispatch({ t: 'buy', code: st.code })}>Buy Co. ${buyoutCost.toLocaleString()}</button>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', padding: '2px 4px' }}>Owned</span>
                )}
                <button style={{ fontSize: 11, padding: '2px 8px' }}
                  disabled={sellRemaining <= 0}
                  title={sellRemaining > 0 ? `Sell one step below market · $${sellPrice.toLocaleString()} · ${sellRemaining} left this turn` : 'Half-holding bank-sale limit reached'}
                  onClick={() => dispatch({ t: 'sell', code: st.code })}>Sell&nbsp;${sellPrice.toLocaleString()}</button>
              </div>
            );
          })}
        </div>
      )}

      {!canAct && isFree && (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', padding: '2px 0' }}>
          Both free trade actions used — end your turn.
        </div>
      )}
    </div>
  );
}
