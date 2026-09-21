// Play screen, layout A (2026-09-19 redesign): one rail for the table, the
// board in the middle with the rates bar above it and whatever the turn is
// waiting on directly below, and money, development and the market on the
// right. Every column scrolls on its own so the board never moves.

import BoardTrack from './BoardTrack';
import TradeHistory from './TradeHistory';
import TradingMarket from './TradingMarket';
import CompanyDevelopment from './CompanyDevelopment';
import StockTradeCard from './StockTradeCard';
import PlayerCards from './PlayerCards';
import DeckStatus from './DeckStatus';
import Portfolio from './Portfolio';
import Leaderboard from './Leaderboard';
import P2PTradeDesk from './P2PTradeDesk';
import ActionPanel, { EtfPicker } from './ActionPanel';
import CardDisplay from '../cards/CardDisplay';
import IpoPanel from '../cards/IpoPanel';
import MarketIntelligence from './MarketIntelligence';
import MarketTicker from './MarketTicker';
import RatesStrip from './RatesStrip';
import Log from './Log';
import { useDispatch, useGameState } from '../../store';

export default function GameScreen() {
  const s = useGameState();
  const dispatch = useDispatch();
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '252px 1fr 300px',
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

      {/* Drawn-card and stock-trade overlays float above everything else in
          the grid so they're always visible the instant they appear,
          regardless of scroll position in any column. */}
      <CardDisplay />
      <StockTradeCard />

      {/* Left rail — who is at the table, what is left in the decks, and the
          running log of what just happened. */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        overflowY: 'auto', overflowX: 'hidden', minHeight: 0, paddingRight: 2,
      }}>
        <PlayerCards />
        <DeckStatus />
        <MarketIntelligence />
        <div style={{ flex: '0 0 230px', minHeight: 230, display: 'flex', flexDirection: 'column' }}>
          <Log />
        </div>
      </div>

      {/* Centre — rates, board, then the turn's own business. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', minHeight: 0 }}>
        <RatesStrip />
        <BoardTrack />
        <ActionPanel />
        {s.etfPick && <EtfPicker code={s.etfPick} s={s} dispatch={dispatch} />}
        <IpoPanel />
        <TradingMarket />
        <TradeHistory />
      </div>

      {/* Right rail — standings, your money, your companies, the market. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden', minHeight: 0 }}>
        <Leaderboard />
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Portfolio fills a block of its own and scrolls inside it: its root
              is flex:1, so in a shared scrolling column it would otherwise
              collapse to its header. */}
          <div style={{ flexShrink: 0, display: 'flex', minHeight: 380, maxHeight: 520 }}>
            <Portfolio />
          </div>
          {s.opts.companyUpgrades && <CompanyDevelopment />}
          <P2PTradeDesk />
        </div>
      </div>

    </div>
  );
}
