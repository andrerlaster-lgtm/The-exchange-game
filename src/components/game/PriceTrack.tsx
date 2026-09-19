import { CEILING_TRIGGER, PRICE_FLOOR, SECTORS, STOCKS } from '../../data';
import { money, pct } from '../../utils/formatMoney';
import { useGameState } from '../../store';

// Under the old 12-rung ladder this component drew one pip per rung. Prices are
// continuous now, so each company gets a proportional bar from the $100 floor
// to the $5,000 Market Event mark, plus its live price and its move from open.
// Prices can exceed that mark (there is no hard ceiling any more), so the bar
// saturates at full width and the percentage carries the rest of the story.
const BAR_MIN = PRICE_FLOOR;
const BAR_MAX = CEILING_TRIGGER;

function fillPct(price: number): number {
  return Math.max(0, Math.min(100, ((price - BAR_MIN) / (BAR_MAX - BAR_MIN)) * 100));
}

function moveColor(pctFromOpen: number): string {
  if (pctFromOpen > 0) return 'var(--green)';
  if (pctFromOpen < 0) return 'var(--red)';
  return 'var(--muted)';
}

function PriceRow({ code, color, price, openingPrice }: {
  code: string; color: string; price: number; openingPrice: number;
}) {
  const pctFromOpen = openingPrice > 0 ? ((price - openingPrice) / openingPrice) * 100 : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr 62px 52px', gap: 6, alignItems: 'center', marginBottom: 3 }}>
      <span className="mono" style={{ fontSize: 9, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{code}</span>
      <div style={{ height: 10, borderRadius: 5, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${fillPct(price)}%`, height: '100%', background: color, borderRadius: 5 }} />
      </div>
      <span className="mono" style={{ fontSize: 9, textAlign: 'right' }}>{money(price)}</span>
      <span className="mono" style={{ fontSize: 9, textAlign: 'right', color: moveColor(pctFromOpen) }}>
        {pctFromOpen === 0 ? '—' : pct(pctFromOpen)}
      </span>
    </div>
  );
}

export default function PriceTrack() {
  const s = useGameState();
  const sectorGroups: Record<string, typeof STOCKS> = {};
  for (const st of STOCKS) {
    if (!sectorGroups[st.sector]) sectorGroups[st.sector] = [];
    sectorGroups[st.sector].push(st);
  }

  return (
    <div className="card-box">
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>PRICE TRACK</div>
      <div style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 8 }}>
        Live price and move from opening. Bar spans {money(BAR_MIN)}–{money(BAR_MAX)}.
      </div>

      {Object.entries(sectorGroups).map(([sec, stocks]) => {
        const sector = SECTORS[sec as keyof typeof SECTORS];
        return (
          <div key={sec} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, color: sector.color, marginBottom: 2 }}>{sector.name}</div>
            {stocks.map((st) => (
              <PriceRow
                key={st.code}
                code={st.code}
                color={sector.color}
                price={s.prices[st.code] ?? st.base}
                openingPrice={st.base}
              />
            ))}
          </div>
        );
      })}

      {s.ipos.some((ip) => ip.revealed) && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 9, color: 'var(--green)', marginBottom: 2 }}>IPOs</div>
          {s.ipos.filter((ip) => ip.revealed).map((ip) => (
            <PriceRow key={ip.code} code={ip.code} color="var(--green)" price={ip.price} openingPrice={ip.startPrice} />
          ))}
        </div>
      )}
    </div>
  );
}
