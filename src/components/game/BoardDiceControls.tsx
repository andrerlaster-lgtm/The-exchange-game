import { useEffect, useRef, useState } from 'react';
import { useDispatch, useGameState } from '../../store';
import { blocked } from '../../engine';

const ROLL_DURATION = 860;

/** Dice tray embedded in the board's felt center so the roll feels physical. */
export default function BoardDiceControls() {
  const s = useGameState();
  const dispatch = useDispatch();
  const [rolling, setRolling] = useState(false);
  const [animDice, setAnimDice] = useState<[number, number]>([1, 1]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function roll() {
    if (s.turnPhase !== 'preRoll' || rolling) return;
    dispatch({ t: 'roll' });
    setRolling(true);
    intervalRef.current = setInterval(() => {
      setAnimDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]);
    }, 75);
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setRolling(false);
    }, ROLL_DURATION);
  }

  const dice: [number | null, number | null] = rolling ? animDice : s.dice;
  const isBlocked = blocked(s);
  return (
    <div style={{
      position: 'absolute', left: '8%', right: '8%', bottom: '8%', zIndex: 5,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BoardDie value={dice[0]} rolling={rolling} />
        <span style={{ color: 'rgba(230,200,135,0.65)', fontSize: 14, fontWeight: 900 }}>+</span>
        <BoardDie value={dice[1]} rolling={rolling} />
      </div>
      {s.turnPhase === 'preRoll' ? (
        <button
          className="primary"
          disabled={rolling}
          onClick={roll}
          style={{
            minWidth: 142, padding: '7px 18px', fontSize: 11, fontWeight: 900,
            letterSpacing: 1, textTransform: 'uppercase',
            boxShadow: rolling ? 'none' : '0 4px 16px rgba(201,162,79,0.28)',
          }}>
          {rolling ? 'Rolling…' : s.bonusRollUsed ? 'Roll Bonus Dice' : 'Roll Dice'}
        </button>
      ) : (
        <button
          className="primary"
          disabled={isBlocked}
          onClick={() => dispatch({ t: 'endTurn' })}
          style={{ minWidth: 142, padding: '7px 18px', fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase' }}>
          {isBlocked ? 'Action Pending' : s.bonusRollPending ? 'Bonus Roll →' : 'End Turn →'}
        </button>
      )}
    </div>
  );
}

function BoardDie({ value, rolling }: { value: number | null; rolling: boolean }) {
  const active = value != null;
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 9,
      background: active ? 'linear-gradient(145deg, #d8b25a, #a5813a)' : '#172319',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: 20, fontFamily: 'IBM Plex Mono, monospace', color: '#fff',
      border: '1px solid rgba(255,255,255,0.35)',
      boxShadow: active ? '0 3px 15px rgba(201,162,79,0.55), inset 0 1px 0 rgba(255,255,255,0.3)' : 'none',
      animation: rolling ? 'boardDieTumble 0.34s infinite ease-in-out alternate' : 'none',
    }}>{value ?? '·'}</div>
  );
}
