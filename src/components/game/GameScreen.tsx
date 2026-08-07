import BoardTrack from './BoardTrack';
import TradeHistory from './TradeHistory';
import TradingMarket from './TradingMarket';
import StockTradeCard from './StockTradeCard';
import PlayerCards from './PlayerCards';
import DeckStatus from './DeckStatus';
import Portfolio from './Portfolio';
import Leaderboard from './Leaderboard';
import P2PTradeDesk from './P2PTradeDesk';
import ActionPanel, { EtfPicker } from './ActionPanel';
import CardDisplay from '../cards/CardDisplay';
import IpoPanel from '../cards/IpoPanel';
import ShortPanel from '../cards/ShortPanel';
import MarketIntelligence from './MarketIntelligence';
import MarketTicker from './MarketTicker';
import { useDispatch, useGameState } from '../../store';

export default function GameScreen() {
  const s = useGameState();
  const dispatch = useDispatch();
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '252px 1fr 282px',
      gridTemplateRows: '34px minmax(0, 1fr)',
      height: '100vh',
      gap: 10,
      padding: 10,
      overflow: 'hidden',
      background: 'radial-gradient(ellipse 130% 90% at 50% -5%, #2e2010 0%, #1e1608 45%, var(--bg) 70%)',
    }}>
      <div style={{ gridColumn: '1 / -1', minWidth: 0, marginRight: 128 }}>
        <MarketTicker />
      </div>

      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, overflowY: 'auto' }}>
          <PlayerCards />
          <DeckStatus />
          <CardDisplay />
          <ActionPanel />
          <StockTradeCard />
          {s.etfPick && <EtfPicker code={s.etfPick} s={s} dispatch={dispatch} />}
          <IpoPanel />
          <ShortPanel />
        </div>
      </div>

      {/* Center column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0 }}>
        <MarketIntelligence />
        <BoardTrack />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TradingMarket />
          <TradeHistory />
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minHeight: 0 }}>
        <Leaderboard />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Portfolio />
          <P2PTradeDesk />
        </div>
      </div>

    </div>
  );
}
