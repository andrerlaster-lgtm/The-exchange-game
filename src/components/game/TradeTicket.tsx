// Design-styled stock trade ticket — a 1:1 match of the 3D board's #trade-panel
// styling (cream certificate, Anton ticker, sector/risk badges, price + step
// arrow, supply/dividend stats). Buying a regular stock is all-or-nothing: this
// ticket only ever renders for an untouched company (11/11 shares still in the
// bank), so there is nothing to "own" or sell yet — landing here is strictly a
// buy-the-whole-company-or-skip decision.

import { fullCompanyDividendPerMarketOpen, REGULAR_SUPPLY, SECTORS, STOCK_BY_CODE, WEAK_DEMAND_THRESHOLD } from '../../data';
import { priceOf } from '../../engine';
import type { Action, GameState } from '../../engine';
import FedSignalBadge from './FedSignalBadge';

interface Props {
  code: string;
  s: GameState;
  dispatch: (a: Action) => void;
  weakCount: number;
  canAct: boolean;
}

// Mirrors the 3D board's RISK_MAP
const RISK_MAP: Record<string, [string, string]> = {
  High: ['HIGH RISK', '#c0392b'],
  Med:  ['MED RISK',  '#b07d1a'],
  Low:  ['LOW RISK',  '#1f7a44'],
};

const ANTON = "'Anton', sans-serif";
const ARCHIVO = "'Archivo', sans-serif";

export default function TradeTicket({ code, s, dispatch, weakCount, canAct }: Props) {
  const stock = STOCK_BY_CODE[code];
  if (!stock) return null;
  const sector = SECTORS[stock.sector as keyof typeof SECTORS];
  const sc = sector.color;

  const p = s.players[s.cur];
  const price = priceOf(s, code);
  const supply = s.supply[code] ?? 0;
  const stepDiff = (s.prices[code] ?? stock.step) - stock.step;
  const [riskLabel, riskColor] = RISK_MAP[stock.risk] ?? ['—', '#555'];

  const dirColor = stepDiff > 0 ? '#1f7a44' : stepDiff < 0 ? '#c0392b' : '#8a7a68';
  const arrow = stepDiff > 0 ? '▲' : stepDiff < 0 ? '▼' : '—';
  const stepText = stepDiff === 0
    ? 'NO CHANGE'
    : `${stepDiff > 0 ? '+' : ''}${stepDiff} STEP${Math.abs(stepDiff) !== 1 ? 'S' : ''}`;

  const buyoutCost = stock.buyout;
  const dividendPerLap = fullCompanyDividendPerMarketOpen(stock);
  const canBuy = canAct && supply === REGULAR_SUPPLY && p.cash >= buyoutCost;

  return (
    <div key={code} style={{
      position: 'relative',
      borderRadius: 18, padding: 11,
      background: 'linear-gradient(160deg, #0c140f, #06100a)',
      boxShadow: `0 0 0 2px ${sc}, 0 18px 44px rgba(0,0,0,0.6)`,
      fontFamily: ARCHIVO,
      display: 'flex', flexDirection: 'column', gap: 9,
      animation: 'tcFlipIn 480ms cubic-bezier(0.34,1.56,0.64,1)',
      transformOrigin: '50% 0',
    }}>
      {/* Sector-color glow wash */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none',
        background: `radial-gradient(circle at 50% 16%, ${sc}38, transparent 60%)`,
      }} />

      {/* Cream info panel */}
      <div style={{
        background: 'linear-gradient(170deg, #f3efe2, #e4ddc8)',
        borderRadius: 12, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)',
        padding: '13px 13px 11px',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Head: ticker + name / badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontFamily: ANTON, fontSize: 34, lineHeight: 0.9, color: '#15110b', letterSpacing: 1 }}>{code}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3a352b', marginTop: 3 }}>{stock.name}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
            <span style={badgeStyle(sc)}>{sector.name.toUpperCase()}</span>
            <span style={badgeStyle(riskColor)}>{riskLabel}</span>
            <span style={badgeStyle('#6b4f1f')}>{stock.tier.toUpperCase()} TIER</span>
          </div>
        </div>

        <div style={{ marginTop: 9 }}>
          <FedSignalBadge s={s} code={code} />
        </div>

        <Divider />

        {/* Price row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 60, height: 60, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40, color: sc, filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.25))',
          }}>{sector.glyph}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#4a4536' }}>PER-SHARE PRICE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontFamily: ANTON, fontSize: 32, color: '#15110b', lineHeight: 1 }}>
                ${price.toLocaleString()}
              </span>
              <span style={{ fontSize: 24, lineHeight: 1, color: dirColor }}>{arrow}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: dirColor }}>{stepText}</div>
          </div>
        </div>

        <Divider />

        {/* Stats */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={statLabel}>SHARES AVAILABLE</div>
            <div style={statVal}>{supply}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(0,0,0,0.15)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={statLabel}>DIVIDEND</div>
            <div style={statVal}>${stock.div}</div>
            <div style={statLabel}>PER SHARE</div>
          </div>
        </div>
      </div>

      {/* Lead with the recurring income instead of repeating the full-supply purchase rule. */}
      <div style={{
        position: 'relative',
        background: 'linear-gradient(90deg, #0f5132, #22a861, #0f5132)',
        borderRadius: 9, padding: 8, textAlign: 'center',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25), 0 0 14px rgba(34,197,94,0.28)',
        lineHeight: 1.1,
      }}>
        <div style={{ fontWeight: 900, color: '#f0fff5', fontSize: 13, letterSpacing: 1.1 }}>
          {dividendPerLap > 0 ? '+' : ''}${dividendPerLap.toLocaleString()} DIVIDEND EACH LAP
        </div>
        <div style={{ fontWeight: 800, color: 'rgba(240,255,245,0.78)', fontSize: 9, letterSpacing: 0.8 }}>
          PAID AT MARKET OPEN · INCLUDES CONTROLLER BONUS
        </div>
      </div>

      {/* Meta line */}
      <div style={{ position: 'relative', fontSize: 9.5, color: 'rgba(200,188,168,0.65)', letterSpacing: 0.3, textAlign: 'center' }}>
        Cash ${p.cash.toLocaleString()}  ·  Fixed {stock.tier} company price
      </div>

      {/* Buy the company */}
      <ActBtn
        label={`Buy the Company · $${buyoutCost.toLocaleString()}`}
        bg="linear-gradient(135deg, #22c55e, #15803d)"
        disabled={!canBuy}
        onClick={() => dispatch({ t: 'buy', code })}
      />

      {/* Skip — weak demand marker (rulebook §8) */}
      <button
        style={{
          position: 'relative', fontFamily: ARCHIVO,
          fontSize: 11, padding: '6px 0', borderRadius: 7,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(200,188,168,0.7)', cursor: 'pointer',
        }}
        onClick={() => dispatch({ t: 'skipStock', code })}>
        Skip {weakCount > 0 ? `(${weakCount + 1}/${WEAK_DEMAND_THRESHOLD} — price drops next skip)` : ''}
      </button>
    </div>
  );
}

const statLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 800, letterSpacing: 1.2, color: '#4a4536',
};
const statVal: React.CSSProperties = {
  fontFamily: ANTON, fontSize: 26, color: '#15110b', lineHeight: 1.05,
};

function badgeStyle(bg: string): React.CSSProperties {
  return {
    background: bg, color: '#fff',
    fontSize: 9, fontWeight: 800, letterSpacing: 1,
    padding: '4px 8px', borderRadius: 5, whiteSpace: 'nowrap',
  };
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.13)', margin: '11px 0' }} />;
}

function ActBtn({ label, bg, disabled, onClick }: {
  label: string; bg: string; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      style={{
        position: 'relative',
        fontFamily: ARCHIVO,
        width: '100%', padding: '10px 0', borderRadius: 7, border: 'none',
        fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: bg, color: '#fff',
        opacity: disabled ? 0.28 : 1,
        transition: 'opacity 0.15s, transform 0.1s',
      }}
      disabled={disabled}
      onClick={onClick}>
      {label}
    </button>
  );
}
