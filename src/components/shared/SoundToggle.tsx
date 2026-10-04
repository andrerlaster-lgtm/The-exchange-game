import { useSettings } from '../../store/settingsStore';

/** Sound on/off, in the floating view bar. The choice is kept on this device. */
export default function SoundToggle() {
  const muted = useSettings((st) => st.muted);
  const setMuted = useSettings((st) => st.setMuted);
  return (
    <button
      onClick={() => setMuted(!muted)}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound is off — click to turn it on' : 'Sound is on — click to mute'}
      style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
        padding: '4px 10px', borderRadius: 5, border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', marginRight: 3,
        background: muted ? 'transparent' : 'rgba(212,165,53,0.18)',
        color: muted ? 'rgba(138,122,104,0.75)' : 'rgba(212,165,53,0.95)',
        outline: muted ? 'none' : '1px solid rgba(212,165,53,0.32)',
      }}
    >
      {muted ? '♪ OFF' : '♪ ON'}
    </button>
  );
}
