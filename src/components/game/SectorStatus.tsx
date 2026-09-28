// A compact, always-visible read of sector rewards. It sits above the
// scrolling portfolio so a player never has to hunt for a completed set.
import { SECTOR_CODES, SECTOR_PAIRS, SECTORS } from '../../data';
import { completedSectors, controlledSectorPairs } from '../../engine';
import type { SectorId } from '../../data';
import { useGameState } from '../../store';

export default function SectorStatus() {
  const s = useGameState();
  const player = s.players[s.cur];
  const completed = completedSectors(player);
  const controls = controlledSectorPairs(s, s.cur);
  const progress = (Object.keys(SECTOR_CODES) as SectorId[])
    .map((sector) => ({
      sector,
      held: SECTOR_CODES[sector].filter((code) => (player.shares[code] ?? 0) > 0).length,
      total: SECTOR_CODES[sector].length,
    }))
    .filter((entry) => entry.held > 0 && entry.held < entry.total)
    .sort((a, b) => (b.held / b.total) - (a.held / a.total))
    .slice(0, 2);

  return <section aria-label="Sector status" style={{ flexShrink: 0, padding: '10px 11px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '2px solid var(--brass)', boxShadow: 'var(--panel-shadow)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span className="slabel" style={{ marginBottom: 0 }}>Sector Status</span>
      <span style={{ fontSize: 9, color: 'var(--muted)' }}>bonuses &amp; progress</span>
    </div>

    {completed.length === 0 && controls.length === 0 && progress.length === 0 ? <div style={{ marginTop: 7, color: 'var(--muted)', fontSize: 10 }}>No sector positions yet. Own every company in a sector to complete its Portfolio.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {completed.map((sector) => {
        const def = SECTORS[sector];
        return <div key={sector} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 7px', borderRadius: 6, color: def.color, background: `${def.color}16`, border: `1px solid ${def.color}45`, fontSize: 10, fontWeight: 800 }}><span>✓ Portfolio Complete · {def.name}</span><span title="Payout Claims in this sector are 50% stronger">+50% claims</span></div>;
      })}
      {controls.map((pairId) => {
        const def = SECTOR_PAIRS[pairId];
        return <div key={pairId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 7px', borderRadius: 6, color: def.color, background: `${def.color}16`, border: `1px solid ${def.color}45`, fontSize: 10, fontWeight: 800 }}><span>★ Control · {def.name}</span><span>+${def.rent.toLocaleString()} rent</span></div>;
      })}
      {progress.map(({ sector, held, total }) => {
        const def = SECTORS[sector];
        return <div key={sector} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 10 }}><span style={{ color: 'var(--muted)' }}>{def.glyph} {def.name} progress</span><strong>{held}/{total}</strong><div style={{ gridColumn: '1 / -1', height: 4, overflow: 'hidden', borderRadius: 99, background: 'rgba(74,48,25,.12)' }}><div style={{ width: `${(held / total) * 100}%`, height: '100%', background: def.color }} /></div></div>;
      })}
    </div>}
  </section>;
}
