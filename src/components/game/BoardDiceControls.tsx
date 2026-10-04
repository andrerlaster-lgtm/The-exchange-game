import { useEffect, useRef, useState } from 'react';
import { useDispatch, useGameState } from '../../store';
import { blocked } from '../../engine';
import { DICE_MS, gsap, onRoll, reducedMotion, useStageHeld } from '../../anim/stage';

/** Dice tray embedded in the board's felt center so the roll feels physical.
    The dice tumble whenever anyone rolls — a person or a computer player —
    because the motion layer announces every roll. */
export default function BoardDiceControls() {
  const s = useGameState();
  const dispatch = useDispatch();
  const [rolling, setRolling] = useState(false);
  const [animDice, setAnimDice] = useState<[number, number]>([1, 1]);
  const trayRef = useRef<HTMLDivElement>(null);
  const held = useStageHeld();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = onRoll(() => {
      if (reducedMotion()) return;
      clearInterval(interval); clearTimeout(timer);
      setRolling(true);
      interval = setInterval(() => setAnimDice([Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]), 75);
      timer = setTimeout(() => {
        clearInterval(interval);
        setRolling(false);
        const dice = trayRef.current?.querySelectorAll('[data-die]');
        if (dice?.length) gsap.fromTo(dice, { scale: 1.35, rotation: () => gsap.utils.random(-25, 25) }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)', stagger: 0.06 });
      }, DICE_MS);
    });
    return () => { stop(); clearInterval(interval); clearTimeout(timer); };
  }, []);

  function roll() {
    if (s.turnPhase !== 'preRoll' || rolling) return;
    dispatch({ t: 'roll' });
  }

  const dice: [number | null, number | null] = rolling ? animDice : s.dice;
  // Hold End Turn until the dice and the piece have finished moving.
  const isBlocked = blocked(s) || held;
  return (
    <div style={{
      position: 'absolute', left: '8%', right: '8%', bottom: '8%', zIndex: 5,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    }}>
      <div ref={trayRef} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          {held ? 'Moving…' : isBlocked ? 'Action Pending' : s.bonusRollPending ? 'Bonus Roll →' : 'End Turn →'}
        </button>
      )}
    </div>
  );
}

function BoardDie({ value, rolling }: { value: number | null; rolling: boolean }) {
  const active = value != null;
  return (
    <div data-die style={{
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
