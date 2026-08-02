import { useState } from 'react';
import { useGameState } from '../../store';

const KIND_COLOR: Record<string, string> = {
  g: 'var(--green)', r: 'var(--red)', y: 'var(--yellow)', b: 'var(--blue)', n: 'var(--muted)',
};

export default function Log() {
  const s = useGameState();
  const [open, setOpen] = useState(false);

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: 'var(--muted)', textAlign: 'left',
          padding: 0, border: 'none', background: 'none',
          cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          textTransform: 'uppercase',
        }}>
        <span>Details</span>
        <span style={{ fontSize: 9 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 8, overflowY: 'auto', maxHeight: 200, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {s.log.map((entry, i) => (
            <div key={i} style={{
              fontSize: 10,
              color: KIND_COLOR[entry.kind] ?? 'var(--muted)',
              padding: '3px 0',
              borderBottom: i < s.log.length - 1 ? '1px solid rgba(74,48,25,0.06)' : 'none',
              lineHeight: 1.5,
            }}>
              {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
