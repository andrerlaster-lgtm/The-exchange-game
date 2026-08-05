import { useEffect, useRef, useState } from 'react';
import { ETF_BY_CODE, ETF_DEFS, ETF_PRICE, ETF_PAYOUT, ETF_DIVERSIFICATION_BONUS, totalEtfShares, hasFullEtfDiversification, SPACES, STOCK_BY_CODE, PIECE_BY_KEY, MARGIN_DEFAULT_PENALTY, IPO_BY_CODE, isIpoCode } from '../../data';
import { blocked, gameProgressLabel, priceOf, sellBackPrice } from '../../engine';
import type { Action, GameState } from '../../engine';
import { useDispatch, useGameState } from '../../store';

const ROLL_DURATION = 860;
const SETTLE_MS = 320;
const FADEOUT_MS = 300;

type OverlayPhase = 'hidden' | 'rolling' | 'settled' | 'fadeout';

export default function ActionPanel() {
  const s = useGameState();
  const dispatch = useDispatch();
  const p = s.players[s.cur];
  const isBlocked = blocked(s);
  const [rolling, setRolling] = useState(false);
  const [animDice, setAnimDice] = useState<[number, number]>([1, 1]);
  const [overlayPhase, setOverlayPhase] = useState<OverlayPhase>('hidden');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Pending setTimeout chain for the current roll's overlay animation. Rolling
  // is only disabled-gated on the "Roll Dice" button, not on ending the turn —
  // a fast End Turn → Roll Dice by the next player can fire a new roll while the
  // previous roll's ~1.5s chain is still in flight. Without cancelling it first,
  // the stale callbacks fire out of order and can clobber overlayPhase, leaving
  // the dice overlay stuck on screen indefinitely.
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function handleRoll() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (intervalRef.current) clearInterval(intervalRef.current);

    dispatch({ t: 'roll' });
    setRolling(true);
    setOverlayPhase('rolling');

    intervalRef.current = setInterval(() => {
      setAnimDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
    }, 80);

    const settleTimer = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRolling(false);
      setOverlayPhase('settled');

      const fadeTimer = setTimeout(() => {
        setOverlayPhase('fadeout');
        const hideTimer = setTimeout(() => setOverlayPhase('hidden'), FADEOUT_MS);
        timersRef.current.push(hideTimer);
      }, SETTLE_MS);
      timersRef.current.push(fadeTimer);
    }, ROLL_DURATION);
    timersRef.current.push(settleTimer);
  }

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const realDice = s.dice as [number, number];

  // Head of the forced-draw queue — the draw the player must resolve next.
  const nextDraw = s.pendingDraws[0] ?? null;

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {overlayPhase !== 'hidden' && (
        <DiceRollOverlay phase={overlayPhase} animDice={animDice} realDice={realDice} />
      )}
      {/* Player header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${p.color}ee, ${p.color}77)`,
          boxShadow: `0 0 18px ${p.color}77, 0 0 6px ${p.color}44, inset 0 1px 0 rgba(255,255,255,0.3)`,
          border: '2px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18,
        }}>{PIECE_BY_KEY[p.piece]?.emoji ?? '●'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2, color: 'var(--text)' }}>{p.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3, marginTop: 2 }}>
            Space {p.pos}
            {(() => {
              const sp = SPACES[p.pos - 1];
              const label = sp.type === 'stock' ? sp.code : sp.name;
              return label ? <span style={{ color: 'var(--gold)' }}> {label}</span> : null;
            })()}
            {' · '}
            <span className="mono" style={{ color: 'var(--green)', fontWeight: 600 }}>${p.cash.toLocaleString()}</span>
            {p.margin > 0 && (
              <span className="mono" style={{ color: 'var(--red)', marginLeft: 6 }}>−${p.margin.toLocaleString()} margin</span>
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.3, marginTop: 2 }}>
            {gameProgressLabel(s)}
          </div>
        </div>
        {s.closing && s.extendedRoundsLeft > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(212,165,53,0.14)', color: 'var(--gold)',
            border: '1px solid rgba(212,165,53,0.3)',
          }}>EXTENDED ROUND</span>
        )}
        {s.closing && s.extendedRoundsLeft === 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(239,68,68,0.12)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.28)',
          }}>FINAL ROUND</span>
        )}
        {!s.closing && s.extendedHoursAvailable && (
          <span title="Extended Hours banked — Market Close will be delayed by 1 round" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(61,213,152,0.12)', color: 'var(--green)',
            border: '1px solid rgba(61,213,152,0.3)',
          }}>⏱ EXTENDED HOURS</span>
        )}
        {s.bonusRollPending && (
          <span title="Resolve this landing, then roll once more" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            padding: '3px 8px', borderRadius: 4,
            background: 'rgba(212,165,53,0.14)', color: 'var(--gold)',
            border: '1px solid rgba(212,165,53,0.3)',
          }}>🎲 DOUBLES · BONUS ROLL</span>
        )}
        <button
          className="danger"
          style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
          onClick={() => { if (confirm('Call Market Close?')) dispatch({ t: 'callClose' }); }}
          disabled={s.closing}>
          Call Close
        </button>
      </div>

      {/* Dice + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Die value={rolling ? animDice[0] : s.dice[0]} rolling={rolling} />
        <Die value={rolling ? animDice[1] : s.dice[1]} rolling={rolling} />
        <div style={{ width: 1, height: 30, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />
        {s.turnPhase === 'preRoll' && (
          <button className="primary" style={{ padding: '8px 22px', fontSize: 13 }}
            disabled={rolling}
            onClick={handleRoll}>
            {rolling ? 'Rolling…' : s.bonusRollUsed ? 'Roll Bonus Dice' : 'Roll Dice'}
          </button>
        )}
        {s.turnPhase === 'acted' && (
          <button className="primary" style={{ padding: '8px 22px', fontSize: 13 }}
            disabled={isBlocked}
            onClick={() => dispatch({ t: 'endTurn' })}>
            {isBlocked ? 'Resolve action…' : s.bonusRollPending ? 'Bonus Roll →' : 'End Turn →'}
          </button>
        )}
      </div>

      {/* Cardless financial spaces still need a loud, explicit result. */}
      {s.landingNotice && <LandingResultBanner s={s} dispatch={dispatch} />}

      {/* Market Open Trading Window — private trades only, no bank sell-back */}
      {s.marketOpenWindow && <MarketOpenWindowPanel dispatch={dispatch} />}

      {/* Sold-back shares can only be bought by landing on that company. */}
      {s.outstandingBuy && !s.landingNotice && !s.insolvency && (
        <OutstandingSharesPanel s={s} dispatch={dispatch} />
      )}

      {/* Margin call — forced sell-to-cover, blocks the turn until resolved */}
      {s.marginCall && s.marginCall.player === s.cur && (
        <MarginCallPanel s={s} dispatch={dispatch} />
      )}

      {/* Payout Claim shortfall — forced sale to pay the other player */}
      {s.insolvency && !s.landingNotice && <InsolvencyPanel s={s} dispatch={dispatch} />}

      {/* Pending draw — loud, deck-colored, pulsing banner: the turn cannot
          continue until this button is pressed, so make it impossible to miss. */}
      {nextDraw && <PendingDrawBanner deck={nextDraw} count={s.pendingDraws.length} dispatch={dispatch} />}

      {s.investorDay && <InvestorDayChoicePanel s={s} dispatch={dispatch} />}

      {s.pick?.source === 'investor' && <InvestorDayPanel s={s} dispatch={dispatch} />}

      {s.etfPick && <EtfPicker code={s.etfPick} s={s} dispatch={dispatch} />}
    </div>
  );
}

function LandingResultBanner({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const notice = s.landingNotice!;
  const needsMore = notice.remaining > 0;
  const canPayNow = s.players[s.cur].cash >= notice.amount;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 14,
      padding: '14px 16px', borderRadius: 10,
      background: 'linear-gradient(105deg, rgba(239,68,68,0.22), rgba(239,68,68,0.07))',
      border: '2px solid #ef4444',
      boxShadow: '0 3px 20px rgba(239,68,68,0.2)',
    }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{notice.kind === 'audit' ? '⚑' : notice.kind === 'tax' ? '$' : '↗'}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#fca5a5', letterSpacing: 1, textTransform: 'uppercase' }}>
          Landing Result · {notice.title}
        </div>
        <div className="mono" style={{ fontSize: 24, fontWeight: 900, color: '#ef4444', marginTop: 3 }}>
          −${notice.amount.toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.45, marginTop: 3 }}>
          {notice.player}: {notice.detail}
        </div>
        {notice.canDefer ? (
          <div style={{ fontSize: 11, color: '#f0b429', marginTop: 4 }}>
            Choose now: pay from cash or carry the full amount as debt. Unpaid debt adds 5% each turn and lowers final score.
          </div>
        ) : (
          <div style={{ fontSize: 11, color: needsMore ? '#f0b429' : 'var(--muted)', marginTop: 4 }}>
            ${notice.paidFromCash.toLocaleString()} taken from cash
            {needsMore ? ` · $${notice.remaining.toLocaleString()} still due — sell regular stock if available` : ' · paid in full'}
          </div>
        )}
      </div>
      {notice.canDefer ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="danger" disabled={!canPayNow}
            style={{ fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}
            onClick={() => dispatch({ t: 'payLandingFee' })}>
            {canPayNow ? `Pay Now · $${notice.amount.toLocaleString()}` : `Need $${(notice.amount - s.players[s.cur].cash).toLocaleString()} More`}
          </button>
          <button style={{ fontSize: 12, padding: '8px 12px', whiteSpace: 'nowrap' }}
            onClick={() => dispatch({ t: 'deferLandingFee' })}>
            Carry as Debt
          </button>
        </div>
      ) : (
        <button className="danger" style={{ fontSize: 12, padding: '9px 14px', whiteSpace: 'nowrap' }}
          onClick={() => dispatch({ t: 'ackLandingNotice' })}>
          {needsMore ? 'Continue to Payment →' : 'Acknowledge'}
        </button>
      )}
    </div>
  );
}

// Deck colors/labels mirror the drawn-card display (3D DECK_COLORS)
const DRAW_META: Record<string, { color: string; label: string; icon: string }> = {
  ME:  { color: '#ef4444', label: 'Market Event', icon: '📈' },
  FED: { color: '#d4a535', label: 'Fed',          icon: '🏛️' },
};

function PendingDrawBanner({ deck, count, dispatch }: {
  deck: string; count: number; dispatch: (a: Action) => void;
}) {
  const meta = DRAW_META[deck] ?? { color: '#c9a24f', label: deck, icon: '🃏' };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', borderRadius: 9,
      background: `linear-gradient(100deg, ${meta.color}26, ${meta.color}0d)`,
      border: `2px solid ${meta.color}`,
      animation: 'drawPulse 1.1s ease-in-out infinite',
      // Deck color drives the pulse glow (referenced by the keyframes)
      ['--pulse' as never]: meta.color,
    }}>
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: meta.color, textTransform: 'uppercase' }}>
          Draw a {meta.label} card
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          Required before your turn continues{count > 1 ? ` · ${count} draws pending` : ''}
        </div>
      </div>
      <button
        style={{
          fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
          padding: '10px 20px', borderRadius: 7, border: 'none',
          background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)`,
          color: '#14100a', cursor: 'pointer', flexShrink: 0,
          boxShadow: `0 2px 14px ${meta.color}66`,
        }}
        onClick={() => dispatch({ t: 'draw', deck: deck as 'ME' | 'FED' })}>
        Draw Card
      </button>
    </div>
  );
}

function InvestorDayChoicePanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const eligible = s.investorDay?.eligibleCodes.length ?? 0;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 9,
      padding: '11px 13px', borderRadius: 8,
      background: 'rgba(167,139,250,0.10)',
      border: '1px solid rgba(167,139,250,0.38)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd', letterSpacing: 0.5 }}>
        ★ INVESTOR DAY · CHOOSE ONE
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>
        Grow an owned company, or use Insider Information to preview the next Market Event without drawing it.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <button className="primary" style={{ fontSize: 11, padding: '7px 11px' }}
          onClick={() => dispatch({ t: 'chooseInvestorGrowth' })}>
          {eligible > 0 ? `Company Growth · ${eligible} eligible` : 'Company Growth · Collect $500'}
        </button>
        <button style={{ fontSize: 11, padding: '7px 11px' }}
          title="See the next Market Event; the card stays on top of the deck"
          onClick={() => dispatch({ t: 'chooseInvestorTip' })}>
          👁 Insider Information
        </button>
      </div>
    </div>
  );
}

function InvestorDayPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const pick = s.pick!;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '11px 13px', borderRadius: 8,
      background: 'rgba(167,139,250,0.10)',
      border: '1px solid rgba(167,139,250,0.38)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#c4b5fd', letterSpacing: 0.5 }}>
        ★ INVESTOR DAY
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{pick.label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(pick.codes ?? []).map((code) => (
          <button key={code}
            style={{ fontSize: 11, padding: '6px 10px' }}
            title={`Move ${STOCK_BY_CODE[code]?.name ?? code} up 1 price step`}
            onClick={() => dispatch({ t: 'pickTarget', code })}>
            {code} · ${priceOf(s, code).toLocaleString()} →
          </button>
        ))}
      </div>
    </div>
  );
}

function MarginCallPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const mc = s.marginCall!;
  const p = s.players[s.cur];
  const holdings = Object.keys(p.shares)
    .filter((code) => (p.shares[code] ?? 0) > 0)
    .map((code) => ({
      code,
      name: isIpoCode(code) ? (IPO_BY_CODE[code]?.name ?? code) : (STOCK_BY_CODE[code]?.name ?? code),
      qty: p.shares[code],
      // IPO shares sell at market; regular stock sells one step below (rulebook §11).
      price: isIpoCode(code) ? priceOf(s, code) : sellBackPrice(s, code),
    }));
  const canPay = p.cash >= mc.owed;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.45)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--red)' }}>⚠ MARGIN CALL</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
          Cash <span className="mono" style={{ color: p.cash < 0 ? 'var(--red)' : 'var(--text)' }}>${p.cash.toLocaleString()}</span>
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
        Sell stock to raise <span className="mono" style={{ color: 'var(--red)', fontWeight: 700 }}>${mc.owed.toLocaleString()}</span>,
        then pay the call. A flat <span className="mono">${MARGIN_DEFAULT_PENALTY.toLocaleString()}</span> penalty applies.
      </div>

      {holdings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 168, overflowY: 'auto' }}>
          {holdings.map((h) => (
            <div key={h.code} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
              padding: '4px 8px', borderRadius: 5,
              background: 'rgba(74,48,25,0.05)', border: '1px solid rgba(74,48,25,0.07)',
            }}>
              <span className="mono" style={{ color: 'var(--accent)', width: 46 }}>{h.code}</span>
              <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              <span style={{ color: 'var(--muted)', width: 22 }}>×{h.qty}</span>
              <span className="mono" style={{ width: 52, textAlign: 'right' }}>${h.price.toLocaleString()}</span>
              <button style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => dispatch({ t: 'marginSell', code: h.code })}>Sell 1</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
          No stock left to sell — pay with available cash.
        </div>
      )}

      <button
        className="danger"
        style={{ fontSize: 12, padding: '7px 0', fontWeight: 700 }}
        disabled={!canPay}
        onClick={() => dispatch({ t: 'payMarginCall' })}>
        {canPay
          ? `Pay Margin Call — $${(mc.owed + MARGIN_DEFAULT_PENALTY).toLocaleString()}`
          : `Need $${(mc.owed - Math.max(p.cash, 0)).toLocaleString()} more`}
      </button>
    </div>
  );
}

function InsolvencyPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const iv = s.insolvency!;
  const p = s.players[iv.player];
  const holdings = Object.keys(p.shares)
    .filter((code) => !isIpoCode(code) && (p.shares[code] ?? 0) > 0)
    // Forced sales pay one step below market (rulebook §11/§17).
    .map((code) => ({ code, name: STOCK_BY_CODE[code]?.name ?? code, qty: p.shares[code], price: sellBackPrice(s, code) }));
  const canSettle = p.cash >= iv.owed || holdings.length === 0;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(240,180,41,0.10)',
      border: '1px solid rgba(240,180,41,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--yellow)' }}>⚠ INSUFFICIENT FUNDS</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
          Cash <span className="mono" style={{ color: 'var(--text)' }}>${p.cash.toLocaleString()}</span>
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
        {p.name} still owes <span className="mono" style={{ color: 'var(--yellow)', fontWeight: 700 }}>${iv.owed.toLocaleString()}</span> toward {iv.label}.
        Sell regular stock (IPO/ETF holdings can't be force-sold) until it's covered, or run out and the rest is waived.
      </div>

      {holdings.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 168, overflowY: 'auto' }}>
          {holdings.map((h) => (
            <div key={h.code} style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
              padding: '4px 8px', borderRadius: 5,
              background: 'rgba(74,48,25,0.05)', border: '1px solid rgba(74,48,25,0.07)',
            }}>
              <span className="mono" style={{ color: 'var(--accent)', width: 46 }}>{h.code}</span>
              <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              <span style={{ color: 'var(--muted)', width: 22 }}>×{h.qty}</span>
              <span className="mono" style={{ width: 52, textAlign: 'right' }}>${h.price.toLocaleString()}</span>
              <button style={{ fontSize: 11, padding: '2px 8px' }}
                onClick={() => dispatch({ t: 'forcedSell', code: h.code })}>Sell 1</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
          No regular stock left to sell — the remaining balance will be waived.
        </div>
      )}

      <button
        className="danger"
        style={{ fontSize: 12, padding: '7px 0', fontWeight: 700 }}
        disabled={!canSettle}
        onClick={() => dispatch({ t: 'payInsolvency' })}>
        {p.cash >= iv.owed
          ? `Pay ${iv.label} — $${iv.owed.toLocaleString()}`
          : holdings.length === 0
          ? `Pay $${Math.max(p.cash, 0).toLocaleString()} & Waive $${(iv.owed - Math.max(p.cash, 0)).toLocaleString()}`
          : `Need $${(iv.owed - Math.max(p.cash, 0)).toLocaleString()} more`}
      </button>
    </div>
  );
}

function MarketOpenWindowPanel({ dispatch }: { dispatch: (a: Action) => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(61,213,152,0.08)',
      border: '1px solid rgba(61,213,152,0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--green)' }}>MARKET OPEN — TRADING WINDOW</span>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
        Any player may propose a private trade. Outstanding bank shares stay with
        their company and can only be bought by landing on that stock space.
      </div>
      <button
        className="primary"
        style={{ fontSize: 12, padding: '7px 0', fontWeight: 700 }}
        onClick={() => dispatch({ t: 'closeMarketOpenWindow' })}>
        Close Trading Window →
      </button>
    </div>
  );
}

function OutstandingSharesPanel({ s, dispatch }: { s: GameState; dispatch: (a: Action) => void }) {
  const offer = s.outstandingBuy!;
  const stock = STOCK_BY_CODE[offer.code];
  const actor = s.players[offer.actor];
  const available = s.bankPool[offer.code] || 0;
  const affordable = Math.min(available, Math.floor(actor.cash / offer.price));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: 'rgba(74,163,255,0.10)',
      border: '1px solid rgba(74,163,255,0.5)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.5, color: 'var(--blue)' }}>◆ OUTSTANDING SHARES</span>
        <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: stock?.color ?? 'var(--text)', marginLeft: 2 }}>{offer.code}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{available} available</span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
        <strong style={{ color: actor.color }}>{actor.name}</strong> landed on {stock?.name ?? offer.code} and is the only buyer.
        Buy up to {available} at the current price of <span className="mono" style={{ color: 'var(--blue)', fontWeight: 800 }}>${offer.price.toLocaleString()}</span> each.
        The purchase does not move the market price.
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 6,
        background: `${actor.color}14`, border: `1px solid ${actor.color}55`,
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
          background: `radial-gradient(circle at 35% 35%, ${actor.color}, ${actor.color}88)`,
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: actor.color }}>{actor.name}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>bought {offer.bought} this landing</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>${actor.cash.toLocaleString()}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <button className="primary" style={{ fontSize: 12, padding: '6px 14px' }}
          disabled={affordable < 1}
          onClick={() => dispatch({ t: 'buyOutstandingShares', qty: 1 })}>
          Buy 1 · ${offer.price.toLocaleString()}
        </button>
        {affordable > 1 && (
          <button className="primary" style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={() => dispatch({ t: 'buyOutstandingShares', qty: affordable })}>
            Buy Max ({affordable}) · ${(affordable * offer.price).toLocaleString()}
          </button>
        )}
        <button style={{ fontSize: 12, padding: '6px 14px' }}
          onClick={() => dispatch({ t: 'outstandingBuyDone' })}>
          {offer.bought > 0 ? 'Done' : 'Skip Shares'}
        </button>
      </div>
      {affordable < 1 && (
        <div style={{ fontSize: 10, color: 'var(--red)' }}>{actor.name} cannot afford one share. Skip to continue.</div>
      )}
    </div>
  );
}

function EtfPicker({ code, s, dispatch }: { code: string; s: GameState; dispatch: (a: Action) => void }) {
  const etf = ETF_BY_CODE[code];
  if (!etf) return null;
  const p = s.players[s.cur];
  const currentTotal = totalEtfShares(p.etfShares);
  const nextTotal = Math.min(currentTotal + 1, ETF_PAYOUT.length - 1);
  const canAfford = p.cash >= ETF_PRICE;
  const distinctOwned = ETF_DEFS.filter((e) => (p.etfShares[e.code] ?? 0) > 0).length;
  const fullyDiversified = hasFullEtfDiversification(p.etfShares);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px', borderRadius: 7,
      background: 'rgba(96,165,250,0.05)',
      border: `1px solid ${etf.color}44`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, color: etf.color }}>{etf.glyph}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: etf.color }}>{etf.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            ${ETF_PRICE.toLocaleString()} · you own {currentTotal} fund{currentTotal !== 1 ? 's' : ''} total
            {currentTotal < ETF_PAYOUT.length - 1 && (
              <> · next payout: ${ETF_PAYOUT[nextTotal].toLocaleString()}/lap</>
            )}
          </div>
        </div>
      </div>

      {/* Safe-haven note — what makes ETFs different from stocks */}
      <div style={{
        fontSize: 10, color: 'var(--muted)', lineHeight: 1.5,
        padding: '5px 8px', borderRadius: 5,
        background: 'rgba(74,48,25,0.05)', border: '1px solid rgba(74,48,25,0.08)',
      }}>
        🔒 Fixed price, never crashes · can't be sold or force-sold — a safe, illiquid income asset.
      </div>

      {/* Full-Diversification bonus progress — own all 4 distinct funds */}
      <div style={{ fontSize: 10, color: fullyDiversified ? 'var(--green)' : 'var(--muted)', lineHeight: 1.5 }}>
        {fullyDiversified
          ? `✓ All 4 funds held — earning the +$${ETF_DIVERSIFICATION_BONUS.toLocaleString()}/lap diversification bonus`
          : `Own all 4 distinct funds (${distinctOwned}/4) for +$${ETF_DIVERSIFICATION_BONUS.toLocaleString()}/lap`}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          style={{ fontSize: 12, padding: '5px 14px', color: etf.color, borderColor: `${etf.color}66` }}
          disabled={!canAfford}
          onClick={() => dispatch({ t: 'buyEtf', code })}>
          {canAfford ? `Buy 1 Share — $${ETF_PRICE.toLocaleString()}` : 'Not enough cash'}
        </button>
        <button style={{ fontSize: 12, padding: '5px 12px' }}
          onClick={() => dispatch({ t: 'skipEtf' })}>Skip</button>
      </div>
    </div>
  );
}


function DiceRollOverlay({ phase, animDice, realDice }: {
  phase: OverlayPhase;
  animDice: [number, number];
  realDice: [number, number];
}) {
  const shown: [number, number] = phase === 'rolling' ? animDice : realDice;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 300,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: phase === 'fadeout' ? 'diceOverlayOut 0.3s ease-in forwards' : 'none',
    }}>
      <div style={{ display: 'flex', gap: 28, position: 'relative' }}>
        <OverlayDie value={shown[0]} phase={phase} delay={0} />
        <OverlayDie value={shown[1]} phase={phase} delay={80} />
      </div>
    </div>
  );
}

function OverlayDie({ value, phase, delay }: { value: number; phase: OverlayPhase; delay: number }) {
  // Fold delay + fill-mode into the shorthand so we never mix `animation`
  // shorthand with longhand props (which triggers React style-merge warnings).
  const anim = phase === 'rolling'
    ? `diceDropIn ${ROLL_DURATION}ms cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms both`
    : phase === 'settled'
    ? `diceSettlePop ${SETTLE_MS}ms ease-out ${delay}ms both`
    : 'none';

  return (
    <div style={{
      width: 76, height: 76, borderRadius: 14,
      background: 'linear-gradient(145deg, #d8b25a, #a5813a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 34,
      fontFamily: 'IBM Plex Mono, monospace',
      color: '#fff',
      boxShadow: '0 6px 40px rgba(201,162,79,0.75), 0 2px 8px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.3)',
      border: '2px solid rgba(255,255,255,0.35)',
      animation: anim,
    }}>
      {value}
    </div>
  );
}

function Die({ value, rolling }: { value: number | null; rolling?: boolean }) {
  const active = value != null;
  return (
    <div style={{
      width: 42, height: 42, borderRadius: 9,
      background: active
        ? 'linear-gradient(145deg, #d4a94f, #a07f38)'
        : 'linear-gradient(145deg, #141926, #0d1120)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 22,
      fontFamily: 'IBM Plex Mono, monospace',
      color: active ? '#fff' : '#252d45',
      boxShadow: active
        ? '0 2px 16px rgba(201,162,79,0.45), inset 0 1px 0 rgba(255,255,255,0.2)'
        : '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(74,48,25,0.06)',
      border: active ? '1px solid rgba(201,162,79,0.5)' : '1px solid var(--border)',
      transition: rolling ? 'none' : 'all 0.2s',
      flexShrink: 0,
      animation: rolling ? 'dieShake 0.12s infinite alternate' : 'none',
    }}>
      {value ?? '·'}
    </div>
  );
}
