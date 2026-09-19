import { IPO_RUN_BP, MARKET_RUN_MOVE_BY_RISK, STOCK_BY_CODE } from '../data';
import type { Card, Effect } from '../data/types';
import { eventPool, priceOf } from './rules';
import { netWorth } from './scoringEngine';
import type { GameState, MarketSignal, MarketSignalImpact } from './types';

const MAX_SIGNALS = 24;
const PORTFOLIO_MILESTONE = 100_000;

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

/** Events important enough for the compact 2D/3D highlights feed and closing
    Tape. Fed decisions have their own persistent panel. Routine cards, IPO
    reveals, purchases, fees, and weak-demand markers stay out of this feed.
    The Market Meter's own ambient repricing signals (kind `market`) are
    excluded — the always-visible Market Condition display covers those
    continuously. Bull Run / Bear Run board-space landings (kind `regime`)
    are NOT covered by that display and stay in: they move every company by
    risk tier and pay or charge every player stance cash, and they have no
    landing banner of their own, so the feed is their only prominent
    surfacing. */
export function importantMarketSignals(s: GameState): MarketSignal[] {
  return s.marketSignals.filter((signal) =>
    signal.kind === 'regime'
    || signal.kind === 'claim'
    || signal.kind === 'close'
    || signal.kind === 'milestone');
}

/** Record each player's highest $100k net-worth threshold once. This runs
    after every action so price moves, dividends, and trades can all trigger it. */
export function recordPortfolioMilestones(s: GameState): void {
  s.portfolioMilestones ??= {};
  s.players.forEach((player, playerIndex) => {
    const reached = Math.floor(netWorth(s, player) / PORTFOLIO_MILESTONE) * PORTFOLIO_MILESTONE;
    const previous = s.portfolioMilestones[playerIndex] ?? 0;
    if (reached < PORTFOLIO_MILESTONE || reached <= previous) return;

    s.portfolioMilestones[playerIndex] = reached;
    recordMarketSignal(s, {
      kind: 'milestone',
      title: `${player.name} Reaches $${reached.toLocaleString()}`,
      summary: `${player.name}'s portfolio reached a net worth milestone of $${reached.toLocaleString()}.`,
      impacts: [],
      playerIndex,
      milestone: reached,
    });
  });
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
  const add = (code: string, bp: number) => impacts.set(code, (impacts.get(code) ?? 0) + bp);
  const sector = (sec: string, bp: number) => pool.filter((item) => item.sec === sec).forEach((item) => add(item.code, bp));
  const risk = (level: string, bp: number) => Object.values(STOCK_BY_CODE)
    .filter((stock) => stock.risk === level)
    .forEach((stock) => add(stock.code, bp));

  switch (effect.k) {
    case 'sector':
      sector(effect.sec, effect.bp);
      break;
    case 'all':
      pool.forEach((item) => add(item.code, effect.bp));
      break;
    case 'risk':
      risk(effect.risk, effect.bp);
      break;
    case 'multi':
      effect.m.forEach((move) => {
        if (move.sec) sector(move.sec, move.bp);
        else if (move.risk) risk(move.risk, move.bp);
      });
      break;
    case 'regime': {
      // Reads the shared Run table rather than restating it. This block used to
      // hardcode its own copy, which had drifted: it still gave Low risk +1 in
      // a Bear Run long after MARKET_RUN_MOVE_BY_RISK moved that to 0, so the
      // forecast chips promised a gain the engine never delivered.
      const runBp = MARKET_RUN_MOVE_BY_RISK[effect.regime];
      Object.values(STOCK_BY_CODE).forEach((stock) => {
        const bp = runBp[stock.risk];
        if (bp !== 0) add(stock.code, bp);
      });
      s.ipos.filter((ipo) => ipo.revealed)
        .forEach((ipo) => add(ipo.code, effect.regime === 'bull' ? IPO_RUN_BP : -IPO_RUN_BP));
      break;
    }
    case 'lowest': {
      const target = pool.slice().sort((a, b) => priceOf(s, a.code) - priceOf(s, b.code))[0];
      if (target) add(target.code, effect.bp);
      break;
    }
    case 'highest': {
      const target = pool.slice().sort((a, b) => priceOf(s, b.code) - priceOf(s, a.code))[0];
      if (target) add(target.code, effect.bp);
      break;
    }
    // A player-selected target is not known when the card is drawn. Dividend,
    // protection, timing, and close cards do not directly move a code.
    case 'pick':
    case 'dividend':
    case 'cyberattack':
    case 'circuitBreaker':
    case 'extend':
    case 'close':
    case 'none':
      break;
  }

  // Basis points accumulate above; signals carry percentages (100 bp = 1%).
  return [...impacts.entries()]
    .filter(([, bp]) => bp !== 0)
    .map(([code, bp]) => ({ code, pct: bp / 100 }));
}

/**
 * Records a card's market signal. Pass `impacts` when the caller already
 * knows the REAL, post-clamp, post-protection deltas (Market Event, 2026-08-21
 * deck rebuild) — the signal must report what actually happened, not what the
 * card's definition alone would predict. Omit it to fall back to the
 * predicted `effectImpacts` computation, which is still correct for FED cards
 * (untouched by this rebuild) and any other immediate, unprotectable effect.
 */
export function recordCardSignal(s: GameState, card: Card, impacts?: MarketSignalImpact[]): void {
  recordMarketSignal(s, {
    kind: card.deck === 'FED' ? 'fed' : 'market',
    title: card.title,
    summary: `${card.story} ${card.effect}`,
    stance: card.signal?.stance,
    insight: card.signal?.insight,
    impacts: impacts ?? effectImpacts(s, card.eff),
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
  const net = moves.reduce((total, move) => total + move.pct, 0);
  const hasUp = moves.some((move) => move.pct > 0);
  const hasDown = moves.some((move) => move.pct < 0);
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
  const up = held.filter((impact) => impact.pct > 0).map((impact) => impact.code);
  const down = held.filter((impact) => impact.pct < 0).map((impact) => impact.code);
  const parts: string[] = [];
  if (up.length) parts.push(`Tailwind: ${up.join(', ')}`);
  if (down.length) parts.push(`Headwind: ${down.join(', ')}`);
  return parts.join(' · ');
}
