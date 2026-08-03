import { STOCKS } from '../../data';
import { getStockMovementStatus, priceOf } from '../../engine';
import type { GameState } from '../../engine';
import { useGameState } from '../../store';

interface TickerEntry {
  code: string;
  price: number;
  direction: 'up' | 'down' | 'flat';
  stepDifference: number;
}

function tickerEntries(s: GameState): TickerEntry[] {
  return STOCKS.map((stock) => {
    const movement = getStockMovementStatus(stock.code, s);
    return {
      code: stock.code,
      price: priceOf(s, stock.code),
      direction: movement.direction,
      stepDifference: movement.stepDifference,
    };
  });
}

function TickerGroup({ entries, hidden = false }: { entries: TickerEntry[]; hidden?: boolean }) {
  return (
    <div className="market-ticker-group" aria-hidden={hidden || undefined}>
      {entries.map((entry) => {
        const glyph = entry.direction === 'up' ? '▲' : entry.direction === 'down' ? '▼' : '—';
        const steps = `${entry.stepDifference > 0 ? '+' : ''}${entry.stepDifference}`;
        return (
          <span
            className={`market-ticker-entry ${entry.direction}`}
            key={entry.code}
            title={`${entry.code} is ${Math.abs(entry.stepDifference)} step${Math.abs(entry.stepDifference) === 1 ? '' : 's'} ${entry.direction} from its opening price`}
          >
            <strong>{entry.code}</strong>
            <span>${entry.price.toLocaleString()}</span>
            <span className="market-ticker-move">{glyph} {steps}</span>
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
      <div className="market-ticker-viewport">
        <div className="market-ticker-track">
          <TickerGroup entries={entries} />
          <TickerGroup entries={entries} hidden />
        </div>
      </div>
    </section>
  );
}
