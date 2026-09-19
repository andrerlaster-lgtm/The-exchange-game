import { STOCKS } from '../../data';
import { getStockMovementStatus, priceOf } from '../../engine';
import type { GameState } from '../../engine';
import { money, pct } from '../../utils/formatMoney';
import { useGameState } from '../../store';
import MarketRegimeBadge from './MarketRegimeBadge';

interface TickerEntry {
  code: string;
  price: number;
  direction: 'up' | 'down' | 'flat';
  difference: number;   // dollars from opening
  pctFromOpen: number;  // percent from opening
}

function tickerEntries(s: GameState): TickerEntry[] {
  return STOCKS.map((stock) => {
    const movement = getStockMovementStatus(stock.code, s);
    return {
      code: stock.code,
      price: priceOf(s, stock.code),
      direction: movement.direction,
      difference: movement.difference,
      pctFromOpen: movement.pctFromOpen,
    };
  });
}

function TickerGroup({ entries, hidden = false }: { entries: TickerEntry[]; hidden?: boolean }) {
  return (
    <div className="market-ticker-group" aria-hidden={hidden || undefined}>
      {entries.map((entry) => {
        const glyph = entry.direction === 'up' ? '▲' : entry.direction === 'down' ? '▼' : '—';
        // Percentage is the headline number under the percentage market model;
        // the dollar move rides along in the tooltip for players settling by hand.
        const move = entry.direction === 'flat' ? '—' : pct(entry.pctFromOpen);
        return (
          <span
            className={`market-ticker-entry ${entry.direction}`}
            key={entry.code}
            title={`${entry.code} is ${money(Math.abs(entry.difference))} (${pct(entry.pctFromOpen)}) ${entry.direction} from its opening price`}
          >
            <strong>{entry.code}</strong>
            <span>${entry.price.toLocaleString()}</span>
            <span className="market-ticker-move">{glyph} {move}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function MarketTicker() {
  const s = useGameState();
  const entries = tickerEntries(s);

  return (
    <section className="market-ticker" aria-label="Live stock price tracker" tabIndex={0}>
      <div className="market-ticker-title">MARKET TICKER</div>
      {s.opts.marketMeter && <MarketRegimeBadge meter={s.meter} variant="ticker" />}
      <div className="market-ticker-viewport">
        <div className="market-ticker-track">
          <TickerGroup entries={entries} />
          <TickerGroup entries={entries} hidden />
        </div>
      </div>
    </section>
  );
}
