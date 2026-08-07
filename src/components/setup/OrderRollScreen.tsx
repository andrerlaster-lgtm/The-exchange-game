// Pre-game "roll for order" ceremony — each player rolls 2d6 in turn; the
// resulting values (highest first) set the play order. Ties re-roll among
// just the tied players until every value is distinct.

import { useEffect, useRef, useState } from 'react';
import { PIECE_BY_KEY } from '../../data';
import { useDispatch, useGameState } from '../../store';

function Die({ value, rolling }: { value: number | null; rolling?: boolean }) {
  const active = value != null;
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 8,
      background: active
        ? 'linear-gradient(145deg, #d4a94f, #a07f38)'
        : 'linear-gradient(145deg, #141926, #0d1120)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 16,
      fontFamily: 'IBM Plex Mono, monospace',
      color: active ? '#fff' : '#252d45',
      boxShadow: active
        ? '0 2px 12px rgba(201,162,79,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'
        : '0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(74,48,25,0.06)',
      border: active ? '1px solid rgba(201,162,79,0.5)' : '1px solid var(--border)',
      animation: rolling ? 'dieShake 0.12s infinite alternate' : 'none',
      flexShrink: 0,
    }}>
      {value ?? '·'}
    </div>
  );
}

export default function OrderRollScreen() {
  const s = useGameState();
  const dispatch = useDispatch();
  const or = s.orderRoll;
  const [rollingIdx, setRollingIdx] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!or) return null;

  const nextRoller = or.pending[0] ?? null;
  const ready = or.pending.length === 0;
  // Sorted-so-far preview: resolved rolls first (high to low), undecided players after.
  const ranked = s.players
    .map((p, i) => ({ p, i, roll: or.rolls[i] }))
    .sort((a, b) => {
      if (a.roll === null && b.roll === null) return a.i - b.i;
      if (a.roll === null) return 1;
      if (b.roll === null) return -1;
      return b.roll - a.roll;
    });

  function handleRoll() {
    if (nextRoller === null || rollingIdx !== null) return;
    setRollingIdx(nextRoller);
    timerRef.current = setTimeout(() => {
      dispatch({ t: 'rollForOrder' });
      setRollingIdx(null);
    }, 500);
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse 130% 90% at 50% -5%, #2e2010 0%, #1e1608 45%, var(--bg) 70%)',
      padding: 20,
    }}>
      <div className="card-box" style={{ width: 460, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="display" style={{ fontSize: 12, letterSpacing: 3, color: 'var(--gold)', textTransform: 'uppercase' }}>The Exchange</div>
          <div className="display" style={{ fontSize: 22, color: 'var(--text)', marginTop: 2 }}>Roll for Turn Order</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Highest roll goes first. Ties roll again.</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ranked.map(({ p, i, roll }, rank) => {
            const isNext = i === nextRoller;
            const isRolling = rollingIdx === i;
            const decided = roll !== null;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: isNext ? 'rgba(212,165,53,0.14)' : 'rgba(74,48,25,0.05)',
                border: isNext ? '1px solid rgba(212,165,53,0.5)' : '1px solid rgba(74,48,25,0.08)',
              }}>
                <span style={{
                  width: 16, textAlign: 'center', fontSize: 10, fontWeight: 800,
                  color: decided ? 'var(--gold)' : 'var(--muted)',
                }}>{decided ? `#${rank + 1}` : ''}</span>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 35%, ${p.color}ee, ${p.color}77)`,
                  boxShadow: `0 0 10px ${p.color}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  flexShrink: 0,
                }}>{PIECE_BY_KEY[p.piece]?.emoji ?? '●'}</div>
                <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{p.name}</span>
                <Die value={isRolling ? null : roll} rolling={isRolling} />
              </div>
            );
          })}
        </div>

        {ready ? (
          <button className="primary" style={{ padding: '10px 0', fontSize: 13 }}
            onClick={() => dispatch({ t: 'finishOrderRoll' })}>
            Begin Play →
          </button>
        ) : (
          <button className="primary" style={{ padding: '10px 0', fontSize: 13 }}
            disabled={rollingIdx !== null}
            onClick={handleRoll}>
            {rollingIdx !== null
              ? 'Rolling…'
              : `Roll for ${nextRoller !== null ? s.players[nextRoller].name : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}
