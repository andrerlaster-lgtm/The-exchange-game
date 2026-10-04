import { useEffect, useState } from 'react';
import { useGameStore } from '../../store';

/** Leaves the current game for the setup screen. Games are saved on this
    device and resume on reload, so this is the way out of one — it asks
    once ("Sure?") so a stray tap can't end a game. */
export default function NewGameButton() {
  const newGame = useGameStore((st) => st.newGame);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);
  return (
    <button
      onClick={() => { if (confirming) { setConfirming(false); newGame(); } else setConfirming(true); }}
      aria-label={confirming ? 'Confirm: leave this game and start a new one' : 'New game'}
      title={confirming ? 'Tap again to leave this game (it will not be kept)' : 'Leave this game and set up a new one'}
      style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
        padding: '4px 10px', borderRadius: 5, border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', marginRight: 3,
        background: confirming ? 'rgba(239,68,68,0.2)' : 'transparent',
        color: confirming ? '#f87171' : 'rgba(138,122,104,0.75)',
        outline: confirming ? '1px solid rgba(239,68,68,0.4)' : 'none',
      }}
    >
      {confirming ? 'SURE? NEW GAME' : '↺ NEW'}
    </button>
  );
}
