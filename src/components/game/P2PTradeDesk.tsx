import { useState } from 'react';
import { IPO_BY_CODE, STOCK_BY_CODE, isIpoCode } from '../../data';
import type { Action, GameState } from '../../engine';
import { useDispatch, useGameState } from '../../store';

function codeName(code: string): string {
  return isIpoCode(code) ? (IPO_BY_CODE[code]?.name ?? code) : (STOCK_BY_CODE[code]?.name ?? code);
}

/** Stock/IPO codes a player actually holds (ETFs are never P2P-tradeable). */
function holdingsOf(s: GameState, idx: number): string[] {
  return Object.keys(s.players[idx]?.shares ?? {}).filter((c) => (s.players[idx].shares[c] ?? 0) > 0);
}

export default function P2PTradeDesk() {
  const s = useGameState();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="slabel" style={{ marginBottom: 0 }}>Player Trading</span>
        <button style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : 'Propose Trade'}
        </button>
      </div>

      {open && <ProposeForm s={s} dispatch={dispatch} onDone={() => setOpen(false)} />}

      {s.p2pOffers.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '4px 0' }}>
          No pending offers
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {s.p2pOffers.map((offer) => {
            const from = s.players[offer.from];
            const to = s.players[offer.to];
            const verb = offer.direction === 'sell' ? 'sell' : 'buy';
            const prep = offer.direction === 'sell' ? 'to' : 'from';
            // The buyer is whichever side is paying cash — 'from' offers to sell
            // (so 'to' pays), 'buy' offers work the other way.
            const buyer = offer.direction === 'sell' ? to : from;
            const seller = offer.direction === 'sell' ? from : to;
            const canAfford = buyer.cash >= offer.price;
            const hasShares = (seller.shares[offer.code] ?? 0) >= offer.qty;
            const canAccept = canAfford && hasShares;
            return (
              <div key={offer.id} style={{
                padding: '8px 10px', borderRadius: 7,
                background: 'rgba(201,162,79,0.06)',
                border: '1px solid rgba(201,162,79,0.2)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                  <span style={{ color: from.color, fontWeight: 700 }}>{from.name}</span>
                  {' offers to '}{verb}{' '}
                  <span className="mono">{offer.qty}× {offer.code}</span>
                  {' '}{prep}{' '}
                  <span style={{ color: to.color, fontWeight: 700 }}>{to.name}</span>
                  {' for '}
                  <span className="mono" style={{ color: 'var(--green)' }}>${offer.price.toLocaleString()}</span>
                </div>
                {!canAfford && (
                  <div style={{ fontSize: 10, color: 'var(--red)' }}>
                    {buyer.name} can't afford this — has ${buyer.cash.toLocaleString()}, needs ${offer.price.toLocaleString()}.
                  </div>
                )}
                {canAfford && !hasShares && (
                  <div style={{ fontSize: 10, color: 'var(--red)' }}>
                    {seller.name} no longer holds enough {offer.code} shares.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    style={{
                      fontSize: 10, padding: '3px 10px', fontWeight: 700, border: 'none',
                      background: canAccept ? 'var(--green)' : 'var(--border)',
                      color: canAccept ? '#000' : 'var(--muted)',
                      cursor: canAccept ? 'pointer' : 'not-allowed',
                    }}
                    disabled={!canAccept}
                    title={!canAccept ? (!canAfford ? `${buyer.name} can't afford $${offer.price.toLocaleString()}` : `${seller.name} no longer holds enough shares`) : undefined}
                    onClick={() => dispatch({ t: 'acceptP2POffer', id: offer.id })}>
                    Accept
                  </button>
                  <button
                    style={{ fontSize: 10, padding: '3px 10px' }}
                    onClick={() => dispatch({ t: 'declineP2POffer', id: offer.id })}>
                    Decline
                  </button>
                  <button
                    style={{ fontSize: 10, padding: '3px 10px', marginLeft: 'auto', color: 'var(--muted)' }}
                    onClick={() => dispatch({ t: 'cancelP2POffer', id: offer.id })}>
                    Withdraw
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProposeForm({ s, dispatch, onDone }: {
  s: GameState;
  dispatch: (a: Action) => void;
  onDone: () => void;
}) {
  // A player can only offer up shares they own, so the proposer (From) is always
  // the seller and the dropdown lists only their holdings.
  const [fromIdx, setFromIdx] = useState(s.cur);
  const [toIdx, setToIdx] = useState(s.players.findIndex((_, i) => i !== s.cur));
  const [code, setCode] = useState('');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);

  const toOptions = s.players.map((p, i) => ({ p, i })).filter(({ i }) => i !== fromIdx);

  const seller = s.players[fromIdx];
  const buyer = s.players[toIdx];
  const codes = holdingsOf(s, fromIdx);
  const effCode = codes.includes(code) ? code : (codes[0] ?? '');
  const maxQty = effCode ? (seller?.shares[effCode] ?? 0) : 0;
  const effQty = Math.min(qty, Math.max(maxQty, 1));
  const buyerCash = buyer?.cash ?? 0;
  const priceTooHigh = price > buyerCash;

  const valid = fromIdx !== toIdx && effCode !== '' && effQty >= 1 && effQty <= maxQty && price >= 0 && !priceTooHigh;

  function submit() {
    if (!valid) return;
    dispatch({ t: 'proposeP2POffer', from: fromIdx, to: toIdx, code: effCode, qty: effQty, direction: 'sell', price });
    onDone();
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: 10, borderRadius: 7,
      background: 'rgba(74,48,25,0.06)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label="Seller">
          <select value={fromIdx} onChange={(e) => {
            const v = Number(e.target.value);
            setFromIdx(v);
            if (v === toIdx) setToIdx(s.players.findIndex((_, i) => i !== v));
          }}>
            {s.players.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Buyer">
          <select value={toIdx} onChange={(e) => setToIdx(Number(e.target.value))}>
            {toOptions.map(({ p, i }) => <option key={i} value={i}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label={`Stock / IPO — ${seller?.name}'s holdings`}>
        {codes.length > 0 ? (
          <select value={effCode} onChange={(e) => setCode(e.target.value)}>
            {codes.map((c) => (
              <option key={c} value={c}>{c} — {codeName(c)} (×{seller?.shares[c] ?? 0})</option>
            ))}
          </select>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>
            {seller?.name} owns no shares to sell.
          </div>
        )}
      </Field>

      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', padding: '2px 0' }}>
        <span style={{ color: seller?.color, fontWeight: 700 }}>{seller?.name}</span> sells to{' '}
        <span style={{ color: s.players[toIdx]?.color, fontWeight: 700 }}>{s.players[toIdx]?.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field label={maxQty > 0 ? `Qty (max ${maxQty})` : 'Qty'}>
          <input type="number" min={1} max={Math.max(maxQty, 1)} value={effQty}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} />
        </Field>
        <Field label={`Total price ($) — ${buyer?.name ?? 'buyer'} has $${buyerCash.toLocaleString()}`}>
          <input type="number" min={0} max={buyerCash} step={50} value={price}
            onChange={(e) => setPrice(Math.max(0, parseInt(e.target.value, 10) || 0))} />
        </Field>
      </div>

      {priceTooHigh && (
        <div style={{ fontSize: 10, color: 'var(--red)' }}>
          {buyer?.name} only has ${buyerCash.toLocaleString()} — lower the price to send this offer.
        </div>
      )}

      <button className="primary" style={{ fontSize: 12, padding: '6px 0' }} disabled={!valid} onClick={submit}>
        Send Offer
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, color: 'var(--muted)' }}>
      {label}
      {children}
    </label>
  );
}
