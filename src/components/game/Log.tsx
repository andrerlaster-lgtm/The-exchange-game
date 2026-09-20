// Activity log — the running record of the table, kept in the left rail so a
// player can see what just happened without opening anything (layout A,
// 2026-09-19).

import { useGameState } from '../../store';

const KIND_COLOR: Record<string, string> = {
  g: 'var(--green)', r: 'var(--red)', y: 'var(--yellow)', b: 'var(--blue)', n: 'var(--muted)',
};

export default function Log() {
  const s = useGameState();

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <span className="slabel" style={{ marginBottom: 6 }}>Activity</span>
      <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
        {s.log.length === 0 ? (
          <span style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>Nothing has happened yet.</span>
        ) : s.log.map((entry, i) => (
          <div key={i} style={{
            display: 'flex', gap: 6, alignItems: 'flex-start',
            fontSize: 10, padding: '3px 0',
            borderBottom: i < s.log.length - 1 ? '1px solid rgba(74,48,25,0.06)' : 'none',
            lineHeight: 1.45,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%', marginTop: 4, flexShrink: 0,
              background: KIND_COLOR[entry.kind] ?? 'var(--muted)',
            }} />
            <span style={{ color: 'var(--text)' }}>{entry.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
