import { STOCK_BY_CODE } from '../data';
import type { Card, Effect } from '../data/types';
import { eventPool, stepOf } from './rules';
import type { GameState, MarketSignal, MarketSignalImpact } from './types';

const MAX_SIGNALS = 24;

type SignalInput = Omit<MarketSignal, 'id' | 'lap'> & { lap?: number };

/** Add a curated market-moving event. Routine rolls and trades stay in the full log. */
export function recordMarketSignal(s: GameState, input: SignalInput): void {
  s.marketSignalSeq += 1;
  s.marketSignals.unshift({
    ...input,
    id: s.marketSignalSeq,
    lap: input.lap ?? s.lap,
  });
  if (s.marketSignals.length > MAX_SIGNALS) s.marketSignals.length = MAX_SIGNALS;
}

/** Events important enough for the compact 2D/3D highlights feed.
    Fed decisions have their own persistent Fed Watch panel; routine IPO
    reveals, purchases, and weak-demand markers remain in Details. */
export function importantMarketSignals(s: GameState): MarketSignal[] {
  return s.marketSignals.filter((signal) =>
    signal.kind === 'market' || signal.kind === 'claim' || signal.kind === 'close');
}

/** Promote a real ownership takeover, but not an initial purchase or a move
    into/out of Contested status. */
export function recordClaimTakeover(
  s: GameState,
  code: string,
  previousHolder: number | null,
): boolean {
  const nextHolder = s.soldOut[code]?.claimHolder ?? null;
  if (previousHolder == null || nextHolder == null || previousHolder === nextHolder) return false;
  recordMarketSignal(s, {
    kind: 'claim',
    title: `${code} Taken Over`,
    summary: `${s.players[nextHolder].name} took control of ${code} from ${s.players[previousHolder].name} and now holds its Payout Claim.`,
    impacts: [],
  });
  return true;
}

/** Resolve a card effect into the companies it is expected to move. */
export function effectImpacts(s: GameState, effect: Effect): MarketSignalImpact[] {
  const pool = eventPool(s);
  const impacts = new Map<string, number>();
  const add = (code: string, d: number) => impacts.set(code, (impacts.get(code) ?? 0) + d);
  const sector = (sec: string, d: number) => pool.filter((item) => item.sec === sec).forEach((item) => add(item.code, d));
  const risk = (level: string, d: number) => Object.values(STOCK_BY_CODE)
    .filter((stock) => stock.risk === level)
    .forEach((stock) => add(stock.code, d));

  switch (effect.k) {
    case 'sector':
      sector(effect.sec, effect.d);
      break;
    case 'all':
      pool.forEach((item) => add(item.code, effect.d));
      break;
    case 'risk':
      risk(effect.risk, effect.d);
      break;
    case 'multi':
      effect.m.forEach((move) => {
        if (move.sec) sector(move.sec, move.d);
        else if (move.risk) risk(move.risk, move.d);
      });
      break;
    case 'regime':
      Object.values(STOCK_BY_CODE).forEach((stock) => {
        const d = effect.regime === 'bull'
          ? (stock.risk === 'High' ? 2 : stock.risk === 'Med' ? 1 : 0)
          : (stock.risk === 'High' ? -2 : stock.risk === 'Med' ? -1 : 1);
        if (d !== 0) add(stock.code, d);
      });
      s.ipos.filter((ipo) => ipo.revealed).forEach((ipo) => add(ipo.code, effect.regime === 'bull' ? 1 : -1));
      break;
    case 'lowest': {
      const target = pool.slice().sort((a, b) => stepOf(s, a.code) - stepOf(s, b.code))[0];
      if (target) add(target.code, effect.d);
      break;
    }
    case 'highest': {
      const target = pool.slice().sort((a, b) => stepOf(s, b.code) - stepOf(s, a.code))[0];
      if (target) add(target.code, effect.d);
      break;
    }
    // A player-selected target is not known when the card is drawn. Cash,
    // margin, protection, timing, and close cards do not directly move a code.
    case 'pick':
    case 'cash':
    case 'margin':
    case 'circuitBreaker':
    case 'extend':
    case 'close':
    case 'none':
      break;
  }

  return [...impacts.entries()]
    .filter(([, d]) => d !== 0)
    .map(([code, d]) => ({ code, d }));
}

export function recordCardSignal(s: GameState, card: Card): void {
  recordMarketSignal(s, {
    kind: card.deck === 'FED' ? 'fed' : 'market',
    title: card.title,
    summary: `${card.story} ${card.effect}`,
    stance: card.signal?.stance,
    insight: card.signal?.insight,
    impacts: effectImpacts(s, card.eff),
  });
}

export type FedSignalTone = 'tailwind' | 'headwind' | 'mixed' | 'neutral';

export interface FedStockSignal {
  tone: FedSignalTone;
  label: string;
  net: number;
  lastTitle: string | null;
  related: number;
}

/** A company's Fed read is based on the three most recent Fed decisions. */
export function fedSignalForStock(s: GameState, code: string): FedStockSignal {
  const decisions = s.marketSignals.filter((signal) => signal.kind === 'fed').slice(0, 3);
  const moves = decisions.flatMap((signal) => signal.impacts
    .filter((impact) => impact.code === code)
    .map((impact) => ({ ...impact, title: signal.title })));
  const net = moves.reduce((total, move) => total + move.d, 0);
  const hasUp = moves.some((move) => move.d > 0);
  const hasDown = moves.some((move) => move.d < 0);
  const tone: FedSignalTone = hasUp && hasDown
    ? 'mixed'
    : net > 0
      ? 'tailwind'
      : net < 0
        ? 'headwind'
        : 'neutral';
  const label = tone === 'tailwind'
    ? `Fed Tailwind +${net}`
    : tone === 'headwind'
      ? `Fed Headwind ${net}`
      : tone === 'mixed'
        ? `Fed Mixed ${net > 0 ? '+' : ''}${net}`
        : 'No recent Fed effect';

  return {
    tone,
    label,
    net,
    lastTitle: moves[0]?.title ?? decisions[0]?.title ?? null,
    related: moves.length,
  };
}

/** Summarize how one important event touches a player's current companies. */
export function playerSignalExposure(s: GameState, signal: MarketSignal, playerIndex = s.cur): string {
  const player = s.players[playerIndex];
  if (!player) return 'No portfolio exposure.';
  const held = signal.impacts.filter((impact) => (player.shares[impact.code] ?? 0) > 0);
  if (held.length === 0) return 'No direct portfolio exposure.';
  const up = held.filter((impact) => impact.d > 0).map((impact) => impact.code);
  const down = held.filter((impact) => impact.d < 0).map((impact) => impact.code);
  const parts: string[] = [];
  if (up.length) parts.push(`Tailwind: ${up.join(', ')}`);
  if (down.length) parts.push(`Headwind: ${down.join(', ')}`);
  return parts.join(' · ');
}
