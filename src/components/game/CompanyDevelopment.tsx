// Company Development — upgrades and Market Protection for the companies the
// current player controls (6+ shares). Every figure here is read from the same
// constants and engine helpers the reducer uses, and every disabled button says
// exactly why it is disabled.

import {
  CONTROL_THRESHOLD_REGULAR, SHIELD_ABSORB_BP, SHIELD_COST, STOCK_BY_CODE, UPGRADE_LEVELS,
  developmentRefund, isIpoCode,
} from '../../data';
import { developmentOf, shieldBlockReason, upgradeBlockReason } from '../../engine';
import type { Action, GameState } from '../../engine';
import { money } from '../../utils/formatMoney';
import { useDispatch, useGameState } from '../../store';

const bpLabel = (bp: number) => `${bp.toLocaleString()} bp / ${bp / 100}%`;

export default function CompanyDevelopment() {
  const s = useGameState();
  const dispatch = useDispatch();
  const p = s.players[s.cur];

  const controlled = Object.entries(p.shares)
    .filter(([code, n]) => !isIpoCode(code) && STOCK_BY_CODE[code] && n >= CONTROL_THRESHOLD_REGULAR)
    .map(([code]) => code);

  return (
    <div className="card-box" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="slabel" style={{ marginBottom: 0 }}>Company Development</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>
          {s.upgradedThisTurn ? 'Upgrade used this turn' : '1 upgrade per turn'}
        </span>
      </div>
      {controlled.length === 0 ? (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
          Control a company ({CONTROL_THRESHOLD_REGULAR}+ shares) to upgrade it.
        </div>
      ) : (
        controlled.map((code) => <DevRow key={code} code={code} s={s} dispatch={dispatch} />)
      )}
    </div>
  );
}

function DevRow({ code, s, dispatch }: { code: string; s: GameState; dispatch: (a: Action) => void }) {
  const dev = developmentOf(s, code);
  const current = dev.level === 0 ? null : UPGRADE_LEVELS[dev.level - 1];
  const next = UPGRADE_LEVELS[dev.level] ?? null;
  const upBlock = upgradeBlockReason(s, code);
  const shBlock = shieldBlockReason(s, code);
  const refund = developmentRefund(dev.totalInvested);

  const line = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'var(--muted)' }}>{label}</span><span className="mono">{value}</span>
    </div>
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span className="mono">{code} {current?.numeral ?? ''} {dev.shieldActive ? '🛡️' : ''}</span>
        <span>{current ? `Level ${current.numeral}` : 'Base'}</span>
      </div>
      {line('Payout Claim bonus', current ? `+${money(current.claimBonus)}` : '—')}
      {line('Market Open bonus', current ? `+${money(current.marketOpenBonus)}` : '—')}
      {line('Downside reduction', current ? `${current.downsidePct}% of each decline` : 'none')}
      {line('Market Protection', dev.shieldActive ? `Active · absorbs up to ${bpLabel(SHIELD_ABSORB_BP)}` : 'None')}
      {dev.totalInvested > 0 && line('Refund if control is lost', money(refund))}

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          disabled={!!upBlock}
          title={upBlock ?? undefined}
          onClick={() => dispatch({ t: 'upgradeCompany', code })}
          style={{ flex: 1, fontSize: 11 }}
        >
          {next ? `Upgrade to ${next.numeral} · ${money(next.cost)}` : 'Fully developed'}
        </button>
        <button
          disabled={!!shBlock}
          title={shBlock ?? undefined}
          onClick={() => dispatch({ t: 'buyMarketProtection', code })}
          style={{ flex: 1, fontSize: 11 }}
        >
          Shield · {money(SHIELD_COST)}
        </button>
      </div>
      {next && upBlock && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Upgrade: {upBlock}</div>}
      {shBlock && !dev.shieldActive && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Shield: {shBlock}</div>}
      {next && !upBlock && (
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          Level {next.numeral}: +{money(next.claimBonus)} claim · +{money(next.marketOpenBonus)} Market Open · {next.downsidePct}% smaller declines
        </div>
      )}
    </div>
  );
}
