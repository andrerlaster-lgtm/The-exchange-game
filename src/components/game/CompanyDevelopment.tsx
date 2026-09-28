// Company upgrades live where the player makes the decision: a controlled
// company tile opens its management dialog. The side rail stays a small
// shortcut rather than a long form that users have to scroll to reach.
import {
  CONTROL_THRESHOLD_REGULAR, SHIELD_ABSORB_BP, SHIELD_COST, STOCK_BY_CODE, UPGRADE_LEVELS,
  developmentRefund, isIpoCode,
} from '../../data';
import { developmentOf, shieldBlockReason, upgradeBlockReason } from '../../engine';
import type { Action, GameState } from '../../engine';
import { money } from '../../utils/formatMoney';
import { useDispatch, useGameState } from '../../store';

const bpLabel = (bp: number) => `${bp.toLocaleString()} bp / ${bp / 100}%`;

function controlledCompanies(s: GameState): string[] {
  return Object.entries(s.players[s.cur].shares)
    .filter(([code, shares]) => !isIpoCode(code) && STOCK_BY_CODE[code] && shares >= CONTROL_THRESHOLD_REGULAR)
    .map(([code]) => code);
}

export default function CompanyDevelopment({ onManageCompany }: { onManageCompany: (code: string) => void }) {
  const s = useGameState();
  const controlled = controlledCompanies(s);

  return <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="slabel" style={{ marginBottom: 0 }}>Company Development</span>
      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{s.upgradedThisTurn ? 'Upgrade used' : '1 upgrade / turn'}</span>
    </div>
    {controlled.length === 0 ? <div style={{ fontSize: 11, color: 'var(--muted)' }}>Control 6+ shares to manage a company.</div> : <>
      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Click a <strong>MANAGE</strong> company space on the board, or choose one here.</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{controlled.map((code) => {
        const dev = developmentOf(s, code);
        return <button key={code} onClick={() => onManageCompany(code)} style={{ fontSize: 11, padding: '5px 8px' }}>{code}{dev.level > 0 ? ` · Level ${UPGRADE_LEVELS[dev.level - 1].numeral}` : ' · Manage'}</button>;
      })}</div>
    </>}
  </div>;
}

export function CompanyDevelopmentDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const s = useGameState();
  const dispatch = useDispatch();
  const stock = STOCK_BY_CODE[code];
  if (!stock || !controlledCompanies(s).includes(code)) return null;
  const sector = stock.sector;

  return <div role="presentation" onMouseDown={onClose} style={{ position: 'fixed', inset: 0, zIndex: 280, display: 'grid', placeItems: 'start center', padding: '54px 12px 12px', background: 'rgba(22,14,7,.58)' }}>
    <section role="dialog" aria-modal="true" aria-label={`Manage ${stock.name}`} onMouseDown={(event) => event.stopPropagation()} style={{ width: 'min(430px, 100%)', maxHeight: 'calc(100vh - 72px)', overflowY: 'auto', padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `4px solid ${STOCK_BY_CODE[code] ? '#c9a24f' : '#c9a24f'}`, boxShadow: 'var(--panel-shadow)' }}>
      <header style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div><div className="slabel" style={{ marginBottom: 4 }}>Company management</div><strong style={{ fontSize: 20 }}>{stock.name}</strong><div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 3 }}>{code} · {sector} sector · upgrade or protect this company</div></div>
        <button aria-label="Close company management" onClick={onClose} style={{ padding: '4px 8px', fontSize: 15 }}>×</button>
      </header>
      <DevDetails code={code} s={s} dispatch={dispatch} />
    </section>
  </div>;
}

function DevDetails({ code, s, dispatch }: { code: string; s: GameState; dispatch: (a: Action) => void }) {
  const dev = developmentOf(s, code);
  const current = dev.level === 0 ? null : UPGRADE_LEVELS[dev.level - 1];
  const next = UPGRADE_LEVELS[dev.level] ?? null;
  const upBlock = upgradeBlockReason(s, code);
  const shieldBlock = shieldBlockReason(s, code);
  const refund = developmentRefund(dev.totalInvested);
  const line = (label: string, value: string) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--muted)' }}>{label}</span><span className="mono">{value}</span></div>;

  return <div style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 12, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}><span>{current ? `Level ${current.numeral}` : 'Base level'}</span><span>{dev.shieldActive ? '🛡️ Protection active' : 'No protection'}</span></div>
    {line('Payout Claim bonus', current ? `+${money(current.claimBonus)}` : '—')}
    {line('Market Open bonus', current ? `+${money(current.marketOpenBonus)}` : '—')}
    {line('Downside reduction', current ? `${current.downsidePct}% of each decline` : 'none')}
    {dev.totalInvested > 0 && line('Return if control is lost', money(refund))}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 5 }}>
      <button disabled={!!upBlock} title={upBlock ?? undefined} onClick={() => dispatch({ t: 'upgradeCompany', code })} style={{ fontSize: 11, minHeight: 46 }}>{next ? <>Upgrade to {next.numeral}<br />{money(next.cost)}</> : 'Fully developed'}</button>
      <button disabled={!!shieldBlock} title={shieldBlock ?? undefined} onClick={() => dispatch({ t: 'buyMarketProtection', code })} style={{ fontSize: 11, minHeight: 46 }}>Protection<br />{money(SHIELD_COST)}</button>
    </div>
    {next && !upBlock && <div style={{ padding: 8, borderRadius: 6, background: 'rgba(74,48,25,.05)', fontSize: 11, lineHeight: 1.4 }}>Next level: +{money(next.claimBonus)} Payout Claim · +{money(next.marketOpenBonus)} Market Open · {next.downsidePct}% smaller declines.</div>}
    {upBlock && next && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Upgrade unavailable: {upBlock}</div>}
    {shieldBlock && !dev.shieldActive && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Protection unavailable: {shieldBlock}. It absorbs up to {bpLabel(SHIELD_ABSORB_BP)} of a decline.</div>}
  </div>;
}
