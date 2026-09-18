// Design-styled stock trade ticket — a 1:1 match of the 3D board's #trade-panel
// styling (cream certificate, Anton ticker, sector/risk badges, price + step
// arrow, supply/dividend stats). Buying a regular stock is all-or-nothing: this
// ticket only ever renders for an untouched company (11/11 shares still in the
// bank), so the landing player never owns any of THIS one yet — but they can
// sell OTHER holdings (via the always-visible Trading Market panel) to raise
// the cash to afford it. That doesn't cost this landing's one action, only
// the eventual Buy/Skip does (actionResolver.ts's 'sell' case, isFinancingSell).

import { LADDER, REGULAR_SUPPLY, SECTORS, STOCK_BY_CODE, stockOpportunityFor, WEAK_DEMAND_THRESHOLD } from '../../data';
import type { StockOpportunity } from '../../data';
import { clampStep, companyBuyoutCost, priceOf } from '../../engine';
import type { Action, GameState } from '../../engine';
import FedSignalBadge from './FedSignalBadge';

/** Signed dollar amount — "+$500" / "−$250" / "$0". */
function signedMoney(value: number): string {
  if (value === 0) return '$0';
  return `${value > 0 ? '+' : '−'}$${Math.abs(value).toLocaleString()}`;
}

/** Signed percent, parenthesized and ready to append — "" for exactly 0. */
function signedPercentSuffix(value: number): string {
  if (value === 0) return '';
  return ` (${value > 0 ? '+' : ''}${value.toFixed(1)}%)`;
}

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
  const currentStep = s.prices[code] ?? stock.step;
  const [riskLabel, riskColor] = RISK_MAP[stock.risk] ?? ['—', '#555'];

  // Real dollar/percent move since this company's opening price — not a step
  // count. `stock.base` is the fixed opening per-share price for its tier
  // (Starter $500 / Growth $750 / Premium $1,000), so this is the actual
  // return an early buyer would be sitting on right now, the same number a
  // real ticker would show.
  const openPrice = stock.base;
  const priceDiff = price - openPrice;
  const pctDiff = openPrice > 0 ? (priceDiff / openPrice) * 100 : 0;
  const dirColor = priceDiff > 0 ? '#1f7a44' : priceDiff < 0 ? '#c0392b' : '#8a7a68';
  const arrow = priceDiff > 0 ? '▲' : priceDiff < 0 ? '▼' : '—';
  const moveText = priceDiff === 0 ? 'NO CHANGE' : `${signedMoney(priceDiff)}${signedPercentSuffix(pctDiff)}`;

  const buyoutCost = companyBuyoutCost(s, code);
  const opportunity = stockOpportunityFor(stock);
  const shortfall = Math.max(0, buyoutCost - p.cash);
  const canBuy = canAct && supply === REGULAR_SUPPLY && p.cash >= buyoutCost;
  // Selling another holding here (e.g. via the Trading Market panel) to
  // raise the rest is a real option — it doesn't cost this landing's one
  // action, only the eventual Buy/Skip does. Only worth mentioning when it
  // would actually help: short on cash, and something else to sell exists.
  const hasSellableElsewhere = Object.entries(p.shares).some(([c, qty]) => c !== code && (qty ?? 0) > 0);

  // What a Bull/Bear Run would actually pay from HERE, in dollars — not the
  // step count `opportunity.bullMove/bearMove` describe. The ladder is not
  // evenly spaced ($100 steps near the floor, $1,000 near the ceiling), so
  // "+2 steps" is worth a very different amount depending on where a stock
  // already sits; this projects the real post-clamp price the same way the
  // engine itself would move it (clampStep — never past the floor/ceiling).
  const bullDelta = LADDER[clampStep(currentStep + opportunity.bullMove)] - price;
  const bearDelta = LADDER[clampStep(currentStep + opportunity.bearMove)] - price;

  // Real price Weak Demand would actually drop this stock to on the next
  // skip — the engine moves it exactly one ladder step down, clamped at the
  // $100 floor (moveTradePrice), so this mirrors that precisely.
  const weakDropPrice = LADDER[clampStep(currentStep - 1)];

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
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: dirColor }}>{moveText}</div>
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

      <OpportunityPanel opportunity={opportunity} bullDelta={bullDelta} bearDelta={bearDelta} />

      {/* Meta line */}
      <div style={{ position: 'relative', fontSize: 9.5, color: 'rgba(200,188,168,0.65)', letterSpacing: 0.3, textAlign: 'center' }}>
        Cash ${p.cash.toLocaleString()}  ·  Fixed {stock.tier} company price
      </div>

      {shortfall > 0 && hasSellableElsewhere && (
        <div style={{
          position: 'relative', fontSize: 10, lineHeight: 1.4, textAlign: 'center',
          color: 'rgba(224,193,132,0.85)', padding: '2px 6px',
        }}>
          Short ${shortfall.toLocaleString()} — sell shares in the Trading Market to raise it, then come back and buy. Selling doesn't use up this landing.
        </div>
      )}

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
        Skip {weakCount > 0 ? `(${weakCount + 1}/${WEAK_DEMAND_THRESHOLD} — drops to $${weakDropPrice.toLocaleString()} next skip)` : ''}
      </button>
    </div>
  );
}

const OPPORTUNITY_THEME: Record<StockOpportunity['tone'], { bg: string; border: string; glow: string; value: string }> = {
  growth: {
    bg: 'linear-gradient(145deg, #062b55, #074d8f)', border: '#38bdf8',
    glow: 'rgba(14,165,233,0.3)', value: '#7dd3fc',
  },
  balanced: {
    bg: 'linear-gradient(145deg, #4a2e08, #8a5a10)', border: '#f0b429',
    glow: 'rgba(240,180,41,0.28)', value: '#fde68a',
  },
  income: {
    bg: 'linear-gradient(145deg, #073d22, #0f6a38)', border: '#4ade80',
    glow: 'rgba(34,197,94,0.28)', value: '#86efac',
  },
};

function OpportunityPanel({ opportunity, bullDelta, bearDelta }: {
  opportunity: StockOpportunity;
  bullDelta: number;
  bearDelta: number;
}) {
  const theme = OPPORTUNITY_THEME[opportunity.tone];
  // Real dollar outcome from the CURRENT price, not the fixed step count the
  // card type carries (Low risk is always 0 steps on a Bull Run, which is why
  // 'income' tone shows only the Bear Run row here).
  const runRow = opportunity.tone === 'income'
    ? { label: 'BEAR RUN', value: signedMoney(bearDelta) }
    : { label: 'BULL / BEAR RUN', value: `${signedMoney(bullDelta)} / ${signedMoney(bearDelta)}` };
  const firstRow = opportunity.tone === 'growth'
    ? runRow
    : { label: 'DIVIDEND EACH LAP', value: `+$${opportunity.dividendPerLap.toLocaleString()}` };
  const rows = opportunity.tone === 'growth'
    ? [
        firstRow,
        { label: 'LANDING PAYOUT', value: `$${opportunity.landingPayout.toLocaleString()}` },
        { label: 'SECTOR PAYOUT', value: `UP TO $${opportunity.sectorPayout.toLocaleString()}` },
        { label: 'DIVIDEND', value: 'NONE' },
      ]
    : [
        firstRow,
        runRow,
        { label: 'LANDING PAYOUT', value: `$${opportunity.landingPayout.toLocaleString()}` },
        { label: 'SECTOR PAYOUT', value: `UP TO $${opportunity.sectorPayout.toLocaleString()}` },
      ];

  return (
    <section aria-label={`${opportunity.title} benefits`} style={{
      position: 'relative', borderRadius: 10, padding: '9px 11px 7px',
      background: theme.bg, border: `1px solid ${theme.border}`,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.1), 0 0 16px ${theme.glow}`,
    }}>
      <div style={{
        color: '#fff', fontSize: 14, fontWeight: 900, letterSpacing: 1.2,
        textAlign: 'center', paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.2)',
      }}>
        {opportunity.title}
      </div>
      {rows.map((row) => (
        <div key={row.label} style={{
          display: 'flex', justifyContent: 'space-between', gap: 8,
          padding: '5px 1px', borderBottom: '1px solid rgba(255,255,255,0.12)',
          fontSize: 9.5, fontWeight: 800, letterSpacing: 0.55,
        }}>
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>{row.label}</span>
          <span style={{ color: theme.value, textAlign: 'right' }}>{row.value}</span>
        </div>
      ))}
    </section>
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
