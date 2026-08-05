// Trading Market — sits at the top of the board. Lets the current player sell any
// stock they own on their own turn, without having to land on that stock's space.
// Sell-back economy (rulebook §11): the seller receives one price step below the
// current market price. A player may sell up to half of each holding per turn,
// rounded down; selling 3+ shares at once drops the price one step. IPO shares are
// sold player-to-player, not here.

import { useState } from 'react';
import { STOCK_BY_CODE, isIpoCode } from '../../data';
import { bankSellLimit, bankSellRemaining, canMarketSell, getStockMovementStatus, priceOf, sellBackPrice, stepOf } from '../../engine';
import type { Action, GameState } from '../../engine';
import { useDispatch, useGameState } from '../../store';

export default function TradingMarket() {
  const s = useGameState();
  const dispatch = useDispatch();
  const p = s.players[s.cur];

  const holdings = Object.entries(p.shares)
    .filter(([code, n]) => n > 0 && !isIpoCode(code))
    .map(([code, qty]) => ({ code, qty }));

  const sellable = canMarketSell(s);
  const hint = !sellable ? sellHint(s) : null;

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="slabel" style={{ marginBottom: 0 }}>Sell to Bank</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          Any holding · <span style={{ color: p.color, fontWeight: 700 }}>{p.name}</span>
        </span>
      </div>

      {hint && (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', padding: '2px 0' }}>
          {hint}
        </div>
      )}

      {holdings.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
          No stock to sell
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
          {holdings.map(({ code, qty }) => (
            <MarketRow key={code} code={code} owned={qty} s={s} dispatch={dispatch} sellable={sellable} />
          ))}
        </div>
      )}

      <div style={{ fontSize: 9, color: 'var(--muted)', opacity: 0.7, lineHeight: 1.4 }}>
        Sell up to half of each holding per turn (rounded down) · 3+ shares at once drops the price one step.
      </div>
    </div>
  );
}

function MarketRow({ code, owned, s, dispatch, sellable }: {
  code: string; owned: number; s: GameState; dispatch: (a: Action) => void; sellable: boolean;
}) {
  const limit = bankSellLimit(s, code);
  const maxQty = bankSellRemaining(s, code);
  const sold = s.bankSoldThisTurn[code] ?? 0;
  const [qty, setQty] = useState(1);
  const q = Math.min(qty, Math.max(1, maxQty));
  const price = priceOf(s, code);
  const sellPrice = sellBackPrice(s, code);
  const atFloor = stepOf(s, code) === 0;
  const sc = STOCK_BY_CODE[code]?.color ?? 'var(--accent)';
  const name = STOCK_BY_CODE[code]?.name ?? code;
  const mv = getStockMovementStatus(code, s);
  const mvColor = mv?.direction === 'up' ? 'var(--green)' : mv?.direction === 'down' ? 'var(--red)' : 'var(--muted)';
  const mvGlyph = mv?.direction === 'up' ? '▲' : mv?.direction === 'down' ? '▼' : '—';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 9px', borderRadius: 6,
      background: `linear-gradient(100deg, ${sc}0d, rgba(74,48,25,0.10))`,
      border: `1px solid ${sc}28`,
      borderLeft: `3px solid ${sc}`,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: sc }}>{code}</span>
          <span style={{ fontSize: 10, color: mvColor, fontWeight: 700 }}>{mvGlyph}</span>
          <span style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          <span className="mono">${price.toLocaleString()}</span>
          {' · sells at '}
          <span className="mono" style={{ color: 'var(--red)' }}>${sellPrice.toLocaleString()}</span>
          {atFloor ? ' (floor)' : ''} · own {owned} · {maxQty} of {limit} left{sold > 0 ? ` (${sold} sold)` : ''}
        </div>
      </div>

      {/* Quantity selector */}
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: limit }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => setQty(n)}
            disabled={n > maxQty}
            style={{
              fontSize: 10, padding: '2px 6px',
              background: q === n ? 'var(--red)' : 'var(--surface)',
              color: q === n ? '#fff' : 'var(--text)',
              borderColor: q === n ? 'var(--red)' : 'var(--border)',
              fontWeight: q === n ? 700 : 400,
            }}>
            {n}
          </button>
        ))}
      </div>

      <button
        style={{ fontSize: 11, padding: '4px 12px', background: sellable ? 'var(--red)' : undefined, color: sellable ? '#fff' : undefined, border: sellable ? 'none' : undefined, fontWeight: 700 }}
        disabled={!sellable || maxQty < 1}
        onClick={() => dispatch({ t: 'sell', code, qty: q })}>
        Sell{q > 1 ? ` ${q}` : ''} · ${(sellPrice * q).toLocaleString()}
      </button>
    </div>
  );
}

/** Why the market is temporarily unavailable, for a small inline hint. */
function sellHint(s: GameState): string {
  if (s.turnPhase === 'preRoll') return 'Roll to start your turn, then sell up to half of each holding.';
  if (s.marketOpenWindow) return 'Bank sell-back reopens after the Market Open window closes.';
  if (s.marginCall || s.insolvency) return 'Settle the forced sale first.';
  return 'Resolve the current action to sell.';
}
