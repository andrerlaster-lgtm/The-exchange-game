import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { IPO_BY_CODE, STOCK_BY_CODE, STOCKS, isIpoCode } from '../../data';
import { circuitBreakerOptions, priceOf } from '../../engine';
import type { Action, GameState, MarketSignal } from '../../engine';
import { useDispatch, useGameState } from '../../store';
import { STANCE_META, ImpactChips } from '../shared/MarketSignalBits';

// Effect kinds that can actually move a company's price. Everything else
// (dividend, cyberattack, openingBell, regulatoryInvestigation, cash, margin,
// circuitBreaker, extend, close, the meter cards, insiderPreview, none) has
// its own outcome — a payout, a prompt, a state flag — that the effect text
// already describes; there is no separate "what actually moved" to confirm.
const PRICE_MOVING_KINDS = new Set(['sector', 'all', 'risk', 'multi', 'lowest', 'highest', 'pick', 'regime']);

/**
 * The real, post-clamp/post-Circuit-Breaker outcome of the currently displayed
 * card, once it has one. `recordCardSignal` writes this into `s.marketSignals`
 * synchronously in the same dispatch that resolves the card (draw / pickTarget
 * / resolveCircuitBreaker), so by the time this component re-renders it's
 * already there — no separate "did it apply yet" state to track here. Matched
 * by title + deck + lap rather than trusting index 0: recordPortfolioMilestones
 * runs after every action and can occasionally prepend a signal of its own.
 * Returns null for a non-price-moving card, while a pick or Circuit Breaker
 * decision is still pending (no signal recorded yet), and for an Insider
 * Information peek (which never resolves anything to confirm).
 */
function resolvedSignalFor(s: GameState, card: NonNullable<GameState['card']>, isInsiderPreview: boolean): MarketSignal | null {
  if (isInsiderPreview || !PRICE_MOVING_KINDS.has(card.eff.k)) return null;
  const kind = card.deck === 'FED' ? 'fed' : 'market';
  return s.marketSignals.find((signal) => signal.kind === kind && signal.title === card.title && signal.lap === s.lap) ?? null;
}

type CardPhase = 'idle' | 'back' | 'reveal';

/** A drawn card clears itself after this long, so a routine draw needs no
    click. A card still waiting on a decision (pick a target, Circuit Breaker)
    never auto-clears, and the countdown restarts when that decision resolves.
    The card's own signal stays in Market Intelligence either way. */
const CARD_AUTO_DISMISS_MS = 5_000;

export default function CardDisplay() {
  const s = useGameState();
  const dispatch = useDispatch();
  const [phase, setPhase] = useState<CardPhase>('idle');
  const [dismissed, setDismissed] = useState(false);
  const prevKey = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cardKey = s.card ? `${s.cardPreviewMode ?? 'draw'}-${s.card.deck}-${s.card.title}` : null;
  // Anything the player must answer on the card itself holds it open.
  const awaitingDecision = !!s.circuitBreakerPrompt || (!!s.pick && s.pick.source !== 'investor');

  useEffect(() => {
    if (cardKey && cardKey !== prevKey.current) {
      prevKey.current = cardKey;
      timers.current.forEach(clearTimeout);
      setDismissed(false);
      setPhase('back');
      timers.current = [
        setTimeout(() => setPhase('reveal'), 320),
        setTimeout(() => setPhase('idle'), 960),
      ];
    }
    return () => timers.current.forEach(clearTimeout);
  }, [cardKey]);

  useEffect(() => {
    if (!cardKey || awaitingDecision) return;
    const timer = setTimeout(() => setDismissed(true), CARD_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [cardKey, awaitingDecision]);

  if (!s.card || dismissed) return null;

  const deckId = s.card.deck;
  const isInsiderPreview = s.cardPreviewMode === 'insider';
  const isStrategyOnly = s.card.strategyOnly === true;
  // Deck colors mirror the 3D board's DECK_COLORS (strategy cards go grey there too)
  const baseColor = deckId === 'ME' ? '#ef4444' : '#d4a535';
  const deckColorHex = isStrategyOnly ? '#666666' : baseColor;
  const deckLabel  = isInsiderPreview ? 'INSIDER TIP · NEXT EVENT' : deckId === 'ME' ? 'MARKET EVENT' : 'THE FED';
  const deckIcon   = isInsiderPreview ? '👁️' : deckId === 'ME' ? '📈' : '🏛️';

  // What this specific draw actually did, once it's resolved — see
  // resolvedSignalFor's doc comment for why this can't just read s.card.eff.
  const resolved = resolvedSignalFor(s, s.card, isInsiderPreview);
  const fedSignal = deckId === 'FED' && !isInsiderPreview ? s.card.signal : undefined;
  const fedStance = fedSignal ? STANCE_META[fedSignal.stance] : undefined;

  // Floats above the board (like the dice-roll overlay) instead of living
  // inline in the left column, so a drawn card is visible the instant it
  // appears regardless of how tall the reference panels below it get —
  // no scrolling required to see or act on it.
  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 54,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 380,
    maxHeight: 'calc(100vh - 74px)',
    overflowY: 'auto',
    zIndex: 260,
    pointerEvents: 'auto',
  };

  if (phase === 'back') {
    // Face-down back — mirrors the 3D .card3d-back
    return (
      <div style={overlayStyle}>
        <div className="card-box" style={{
          borderColor: `${deckColorHex}33`,
          borderWidth: 2, borderRadius: 12,
          animation: 'cardBackOut 320ms ease-in forwards',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6, minHeight: 80,
          padding: '16px 14px',
          background: 'rgba(14,11,8,0.97)',
          position: 'relative', overflow: 'hidden', flexShrink: 0,
          boxShadow: `0 6px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,165,53,0.1)`,
        }}>
          <span style={{ fontSize: 28, opacity: 0.5 }}>🃏</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 2,
            color: `${deckColorHex}99`, textTransform: 'uppercase',
          }}>{deckLabel}</span>
        </div>
      </div>
    );
  }

  // A concise investor briefing: the card's outcome and the decision it calls for.
  return (
    <div style={overlayStyle}>
      <div className="card-box"
        onClick={() => { if (!awaitingDecision) setDismissed(true); }}
        title={awaitingDecision ? undefined : 'Click to close'}
        style={{
        borderColor: `${deckColorHex}66`, borderLeft: `4px solid ${deckColorHex}`,
        borderRadius: 10,
        animation: phase === 'reveal' ? 'cardFlipReveal 380ms ease-out forwards' : 'none',
        padding: 0, overflow: 'hidden', flexShrink: 0, position: 'relative', cursor: 'pointer',
        background: 'var(--surface)',
        boxShadow: '0 12px 34px rgba(0,0,0,0.42)',
      }}>
        {/* Countdown to the card clearing itself — absent while it waits on a
            decision, since it stays put until that is answered. */}
        {!awaitingDecision && (
          <div className="card-dismiss-bar" style={{
            background: deckColorHex,
            animationDuration: `${CARD_AUTO_DISMISS_MS}ms`,
          }} />
        )}
        {/* Briefing header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 12px 8px', background: `${deckColorHex}12`,
          borderBottom: `1px solid ${deckColorHex}28`,
        }}>
          <span style={{
            fontSize: 9, fontWeight: 900, letterSpacing: 1.3,
            color: deckColorHex, textTransform: 'uppercase',
          }}>
            {deckIcon} {deckLabel} · INVESTOR BRIEF
          </span>
          <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700 }}>JUST IN</span>
        </div>

        {/* Title area */}
        <div style={{
          padding: '13px 14px 10px',
          borderBottom: '1px solid rgba(74,48,25,0.10)',
        }}>
          <div style={{
            fontSize: 17, fontWeight: 900, color: 'var(--text)',
            letterSpacing: -0.15, lineHeight: 1.2,
          }}>{s.card.title}</div>
          {/* Flavor line — every card is written with one; it never reached
              the player before, only the mechanical effect text below did. */}
          {s.card.story && (
            <div style={{
              fontSize: 11, color: 'var(--muted)', lineHeight: 1.45, marginTop: 5,
            }}>{s.card.story}</div>
          )}
        </div>

        {/* Fed stance readout — the card's own hawkish/dovish read and what it
            means, previously shown only in the separate Market Intelligence
            panel and never on the card that actually triggered it. */}
        {fedSignal && fedStance && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 5,
            margin: '0 10px 8px', padding: '7px 9px', borderRadius: 7,
            background: fedStance.bg, border: `1px solid ${fedStance.color}44`,
          }}>
            <span style={{
              alignSelf: 'flex-start', borderRadius: 999, padding: '2px 8px',
              background: `${fedStance.color}22`, color: fedStance.color,
              fontSize: 8.5, fontWeight: 900, letterSpacing: 0.9, textTransform: 'uppercase',
            }}>{fedStance.label}</span>
            <p style={{ fontSize: 10.5, color: 'var(--text)', lineHeight: 1.5, margin: 0 }}>
              {fedSignal.insight}
            </p>
          </div>
        )}

        {/* Plain-language result: the useful part of the notification. */}
        <div style={{ margin: '10px 12px', padding: '9px 10px', borderRadius: 7,
          background: `${deckColorHex}0d`, border: `1px solid ${deckColorHex}2d`,
        }}>
          <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.9, color: 'var(--muted)', marginBottom: 4 }}>WHAT HAPPENED</div>
          <p style={{
            fontSize: 11, color: 'var(--text)', lineHeight: 1.5, margin: 0,
          }}>{s.card.effect}</p>
          {isStrategyOnly && (
            <p style={{ fontSize: 9, color: 'rgba(100,90,78,0.8)', marginTop: 4, marginBottom: 0, fontStyle: 'italic' }}>
              Strategy Mode — no effect
            </p>
          )}
          {/* What this draw actually did — the effect text above states the
              card's general rule; this confirms the real, post-clamp/
              post-Circuit-Breaker outcome for THIS draw (a company already at
              the floor/ceiling can't move further, and a shielded company's
              drop never lands). Absent while a pick or Circuit Breaker
              decision is still open — nothing has resolved yet. */}
          {resolved && (
            resolved.impacts.length > 0 ? (
              <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Affected investments
                </div>
                <ImpactChips impacts={resolved.impacts} />
              </div>
            ) : (
              <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(74,48,25,0.12)', fontSize: 9.5, color: 'var(--muted)', fontStyle: 'italic' }}>
                No price actually moved — every eligible target was already clamped, protected, or the move landed on a company already at that price.
              </div>
            )
          )}
          {resolved && (() => {
            const held = resolved.impacts.filter((impact) => (s.players[s.cur].shares[impact.code] ?? 0) > 0);
            if (held.length === 0) return null;
            const helped = held.filter((impact) => impact.pct > 0).map((impact) => impact.code);
            const hurt = held.filter((impact) => impact.pct < 0).map((impact) => impact.code);
            return (
              <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(74,48,25,0.12)' }}>
                <div style={{ fontSize: 8.5, fontWeight: 900, letterSpacing: 0.9, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 3 }}>What it means for you</div>
                <div style={{ fontSize: 10.5, color: 'var(--text)', lineHeight: 1.4 }}>
                  {helped.length ? `Helped: ${helped.join(', ')}.` : ''}
                  {helped.length && hurt.length ? ' ' : ''}
                  {hurt.length ? `Under pressure: ${hurt.join(', ')}.` : ''}
                </div>
              </div>
            );
          })()}
        </div>

        {s.circuitBreakerPrompt && (
          <CircuitBreakerDecision s={s} dispatch={dispatch} />
        )}

        {/* Pick target — hidden once a target is locked in for a Circuit Breaker decision */}
        {s.pick && s.pick.source !== 'investor' && !isStrategyOnly && !s.circuitBreakerPrompt && (
          <div style={{ padding: '0 10px 10px' }}>
            <PickTarget
              label={s.pick.label}
              codes={s.pick.codes}
              bp={s.pick.bp}
              s={s}
              dispatch={dispatch}
            />
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '7px 12px 9px', textAlign: 'center',
          fontSize: 8.5, letterSpacing: 0.7,
          color: 'var(--muted)',
        }}>{isInsiderPreview ? 'Preview only · This event remains on top of the deck' : awaitingDecision ? 'Choose an action to continue' : 'Tap anywhere to close'}</div>
      </div>
    </div>
  );
}

function CircuitBreakerDecision({ s, dispatch }: {
  s: ReturnType<typeof useGameState>;
  dispatch: (a: Action) => void;
}) {
  const prompt = s.circuitBreakerPrompt!;
  const holder = s.players[prompt.player];
  const options = circuitBreakerOptions(s);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      margin: '0 10px 10px', padding: 10, borderRadius: 7,
      background: 'rgba(212,165,53,0.10)',
      border: '1px solid rgba(212,165,53,0.38)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)' }}>
        ⚡ {holder.name} holds Circuit Breaker
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.45 }}>
        Protect one affected company you own from this card’s entire price drop, or keep the card for later.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((code) => {
          const name = isIpoCode(code) ? (IPO_BY_CODE[code]?.name ?? code) : (STOCK_BY_CODE[code]?.name ?? code);
          return (
            <button key={code}
              style={{ fontSize: 11, padding: '5px 9px' }}
              title={`Protect ${name}`}
              onClick={() => dispatch({ t: 'playCircuitBreaker', code })}>
              Protect {code}
            </button>
          );
        })}
      </div>
      <button style={{ alignSelf: 'flex-start', fontSize: 11 }}
        onClick={() => dispatch({ t: 'passCircuitBreaker' })}>
        Keep Card for Later
      </button>
    </div>
  );
}

function PickTarget({ label, codes, bp, s, dispatch }: {
  label: string;
  codes?: string[];
  bp: number;
  s: ReturnType<typeof useGameState>;
  dispatch: (a: Action) => void;
}) {
  // Determine which stocks to show.
  const pickable = codes
    ? codes.map((c) => ({ code: c, name: isIpoCode(c) ? c : (STOCK_BY_CODE[c]?.name ?? c) }))
    : STOCKS.map((st) => ({ code: st.code, name: st.name }));

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: 10, borderRadius: 6,
      background: 'rgba(201,162,79,0.08)',
      border: '1px solid rgba(201,162,79,0.3)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pickable.map(({ code, name }) => {
          const price = bp !== 0 ? priceOf(s, code) : null;
          return (
            <button key={code}
              style={{ fontSize: 11, padding: '3px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              title={name}
              onClick={() => dispatch({ t: 'pickTarget', code })}>
              <span>{code}</span>
              {price != null && <span style={{ fontSize: 9, color: 'var(--muted)' }}>${price.toLocaleString()}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
