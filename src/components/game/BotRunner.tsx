// Plays computer players' moves one at a time, at a pace a person can follow,
// and shows who is playing. Human input is ignored by the store meanwhile.

import { useEffect, useState } from 'react';
import { useGameStore } from '../../store';
import { BOT_LABEL, decisionOwner, isBot } from '../../ai/controller';

const SPEEDS = { normal: 750, fast: 250 } as const;
type Speed = keyof typeof SPEEDS;
const KEY = 'exchange-bot-speed-v1';

function loadSpeed(): Speed {
  try { const v = localStorage.getItem(KEY); return v === 'fast' ? 'fast' : 'normal'; } catch { return 'normal'; }
}

export default function BotRunner() {
  const s = useGameStore((st) => st.state);
  const botStep = useGameStore((st) => st.botStep);
  const [speed, setSpeed] = useState<Speed>(loadSpeed);
  const [paused, setPaused] = useState(false);
  const owner = decisionOwner(s);
  const active = isBot(s, owner) && s.phase !== 'over';

  useEffect(() => {
    if (!active || paused) return;
    const t = window.setTimeout(() => { botStep(); }, SPEEDS[speed]);
    return () => window.clearTimeout(t);
  }, [s, active, paused, speed, botStep]);

  if (!active || owner === null) return null;
  const p = s.players[owner];
  const changeSpeed = (v: Speed) => { setSpeed(v); try { localStorage.setItem(KEY, v); } catch { /* not saved */ } };
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', left: '50%', bottom: 14, transform: 'translateX(-50%)', zIndex: 600,
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 14px',
      background: 'rgba(12,10,8,0.92)', border: `1px solid ${p.color}66`, borderRadius: 10,
      boxShadow: '0 10px 24px -8px rgba(0,0,0,0.7)', fontSize: 12, color: '#efe4cf',
    }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, boxShadow: paused ? 'none' : `0 0 0 3px ${p.color}33` }} />
      <span><b style={{ color: p.color }}>{p.name}</b> · Computer ({BOT_LABEL[p.bot ?? 'normal']}) {paused ? 'is paused' : 'is playing…'}</span>
      <button onClick={() => setPaused(!paused)} style={{ fontSize: 11, padding: '4px 10px' }}>{paused ? 'Resume' : 'Pause'}</button>
      <button onClick={() => changeSpeed(speed === 'fast' ? 'normal' : 'fast')} aria-label="Computer speed" style={{ fontSize: 11, padding: '4px 10px' }}>
        {speed === 'fast' ? 'Speed: Fast' : 'Speed: Normal'}
      </button>
    </div>
  );
}
