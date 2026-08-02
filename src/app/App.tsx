import { useState, useEffect } from 'react';
import { useGameState } from '../store';
import SetupScreen from '../components/setup/SetupScreen';
import GameScreen from '../components/game/GameScreen';
import GameOver from '../components/game/GameOver';
import Board3DSync from '../components/game/Board3DSync';

type ViewMode = '2d' | '3d';

export default function App() {
  const s = useGameState();
  const [view, setView] = useState<ViewMode>('2d');
  // Lazy-mount the iframe on first 3D switch, then keep it alive so the
  // camera position and animation state survive view toggles.
  const [has3DLoaded, setHas3DLoaded] = useState(false);

  useEffect(() => {
    if (view === '3d' && !has3DLoaded) setHas3DLoaded(true);
  }, [view, has3DLoaded]);

  // The 3D board posts this message when "Back to Game" is clicked inside the iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data && typeof e.data === 'object' && e.data.t === 'switchTo2D') {
        setView('2d');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (s.phase === 'setup') return <SetupScreen />;
  if (s.phase === 'over') return <GameOver />;

  return (
    <>
      {/* Always sync game state to 3D board, regardless of active view */}
      <Board3DSync />

      {/* View mode toggle — floats above both views */}
      <div style={{
        position: 'fixed', top: 10, right: 10, zIndex: 500,
        display: 'flex', gap: 3,
        background: 'rgba(12,10,8,0.90)',
        border: '1px solid rgba(74,56,32,0.55)',
        borderRadius: 7, padding: 3,
        backdropFilter: 'blur(6px)',
        fontFamily: 'IBM Plex Mono, monospace',
      }}>
        {(['2d', '3d'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
              padding: '4px 13px', borderRadius: 5, border: 'none',
              cursor: view === v ? 'default' : 'pointer',
              fontFamily: 'inherit',
              background: view === v ? 'rgba(212,165,53,0.18)' : 'transparent',
              color: view === v ? 'rgba(212,165,53,0.95)' : 'rgba(138,122,104,0.75)',
              outline: view === v ? '1px solid rgba(212,165,53,0.32)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {v === '2d' ? '◼ 2D' : '◆ 3D'}
          </button>
        ))}
      </div>

      {/* 2D view — unmount when 3D is active (all game state lives in Zustand) */}
      {view === '2d' && <GameScreen />}

      {/* 3D view — lazy-mounted on first switch, kept alive to preserve camera */}
      {has3DLoaded && (
        <iframe
          src="/board-3d.html"
          title="3D Board"
          style={{
            position: 'fixed', inset: 0,
            width: '100%', height: '100%',
            border: 'none', zIndex: 200,
            display: view === '3d' ? 'block' : 'none',
            pointerEvents: view === '3d' ? 'auto' : 'none',
          }}
        />
      )}
    </>
  );
}
