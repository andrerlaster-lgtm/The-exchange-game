import { STOCK_BY_CODE } from '../data';
import { distinctSectors } from './sector';
import { feeDebtBalance } from './feeDebt';
import { getRankedPlayers } from './selectors';
import { priceOf } from './rules';
import type { GameState, Player } from './types';

export interface DebriefSummary {
  lapsReached: number;
  players: number;
  companiesCornered: number;
  companiesUntouched: number;
  outstandingFees: number;
  interestStillOwed: number;
  biggestSwing: number;
  biggestSwingPlayer: string;
  marketEvents: number;
}

export interface PlayerDebrief {
  playerIdx: number;
  title: string;
  verdict: string;
  sectors: number;
  controlledCompanies: number;
  largestHolding: string | null;
  concentrationPct: number;
}

export interface TapeEntry {
  lap: number;
  text: string;
  tone: 'up' | 'down' | 'neutral';
}

export interface SessionDebrief {
  summary: DebriefSummary;
  players: PlayerDebrief[];
  tape: TapeEntry[];
}

const IMPORTANT_LOG = /buys the|carries .*outstanding fees|outstanding fees add|payout claim|bull run|bear run|market close|launched ipo|taken over|takes margin|repays margin/i;

export function buildSessionDebrief(s: GameState): SessionDebrief {
  const ranked = getRankedPlayers(s);
  const biggestSwing = ranked.reduce((best, candidate) => (
    Math.abs(candidate.marketGain) > Math.abs(best.marketGain) ? candidate : best
  ), ranked[0]);
  const companiesCornered = Object.keys(s.soldOut).length;

  return {
    summary: {
      lapsReached: s.lap,
      players: s.players.length,
      companiesCornered,
      companiesUntouched: Math.max(0, Object.keys(STOCK_BY_CODE).length - companiesCornered),
      outstandingFees: s.players.reduce((total, player) => total + feeDebtBalance(player), 0),
      interestStillOwed: s.players.reduce((total, player) => total + player.feeDebtInterest, 0),
      biggestSwing: biggestSwing?.marketGain ?? 0,
      biggestSwingPlayer: biggestSwing?.name ?? 'Nobody',
      marketEvents: s.marketSignals.length,
    },
    players: ranked.map((rankedPlayer, rank) => {
      const player = s.players[rankedPlayer.playerIdx];
      const portfolio = portfolioSnapshot(s, player, rankedPlayer.playerIdx);
      const joke = playerJoke({
        name: player.name,
        rank,
        marketGain: rankedPlayer.marketGain,
        cash: player.cash,
        margin: player.margin,
        feeDebt: rankedPlayer.feeDebt,
        sectors: portfolio.sectors,
        controlledCompanies: portfolio.controlledCompanies,
        largestHolding: portfolio.largestHolding,
        concentrationPct: portfolio.concentrationPct,
      });

      return {
        playerIdx: rankedPlayer.playerIdx,
        ...portfolio,
        ...joke,
      };
    }),
    tape: buildTape(s),
  };
}

function portfolioSnapshot(s: GameState, player: Player, playerIdx: number) {
  let totalValue = 0;
  let largestValue = 0;
  let largestHolding: string | null = null;

  for (const [code, qty] of Object.entries(player.shares)) {
    if (qty <= 0) continue;
    const value = qty * priceOf(s, code);
    totalValue += value;
    if (value > largestValue) {
      largestValue = value;
      largestHolding = code;
    }
  }

  return {
    sectors: distinctSectors(player),
    controlledCompanies: Object.values(s.soldOut)
      .filter((entry) => entry.claimHolder === playerIdx).length,
    largestHolding,
    concentrationPct: totalValue > 0 ? Math.round((largestValue / totalValue) * 100) : 0,
  };
}

interface JokeFacts {
  name: string;
  rank: number;
  marketGain: number;
  cash: number;
  margin: number;
  feeDebt: number;
  sectors: number;
  controlledCompanies: number;
  largestHolding: string | null;
  concentrationPct: number;
}

function playerJoke(facts: JokeFacts): Pick<PlayerDebrief, 'title' | 'verdict'> {
  if (facts.feeDebt > 0) {
    return {
      title: 'Collections Has Your Number',
      verdict: `${facts.name} did not dodge the fee. They adopted it, fed it 5% interest, and brought it home for the final score.`,
    };
  }
  if (facts.margin > 0 && facts.marketGain < 0) {
    return {
      title: 'Leveraged And Learning',
      verdict: `Borrowed money met a red portfolio. The bank calls this interest; ${facts.name} can call it tuition.`,
    };
  }
  if (facts.largestHolding && facts.concentrationPct >= 70) {
    return {
      title: 'All Eggs, One Ticker',
      verdict: `${facts.concentrationPct}% rode on ${facts.largestHolding}. Diversification watched from across the room and quietly left.`,
    };
  }
  if (facts.sectors >= 3) {
    return {
      title: facts.sectors >= 6 ? 'Human Index Fund' : 'Diversified-ish',
      verdict: `${facts.sectors} sectors, zero commitment issues. ${facts.name} collected the bonus and avoided making eye contact with risk.`,
    };
  }
  if (!facts.largestHolding) {
    const cashOnlyJokes = [
      {
        title: 'Cash Is a Personality',
        verdict: `${facts.name} finished with no stock holdings. The market cannot hurt you if you never text it back.`,
      },
      {
        title: 'Treasury Secretary Cosplay',
        verdict: `${facts.name} guarded the cash like it contained state secrets. The buy button has filed a missing-person report.`,
      },
      {
        title: 'Allergic to Buy Buttons',
        verdict: `${facts.name} researched every opportunity and invested in none of them. Due diligence achieved its final form: avoidance.`,
      },
      {
        title: 'Diamond Hands, No Diamonds',
        verdict: `${facts.name} never sold because there was never anything to sell. Technically flawless discipline.`,
      },
      {
        title: 'Liquidity Enthusiast',
        verdict: `${facts.name} stayed liquid enough to pour. The portfolio was mostly a very confident checking account.`,
      },
      {
        title: 'Market on Read',
        verdict: `${facts.name} saw every stock notification and chose peace. Wall Street is still waiting for a reply.`,
      },
    ];
    return cashOnlyJokes[facts.rank % cashOnlyJokes.length];
  }
  if (facts.rank === 0) {
    return {
      title: 'Boringly Correct',
      verdict: `${facts.name} won the session and is now legally required to explain every decision like it was obvious.`,
    };
  }
  if (facts.controlledCompanies >= 2) {
    return {
      title: 'Tiny Corporate Empire',
      verdict: `${facts.name} controlled ${facts.controlledCompanies} companies and only one chair. Hostile takeovers are exhausting.`,
    };
  }
  if (facts.marketGain > 0) {
    return {
      title: 'Green Candles, Loud Confidence',
      verdict: `${facts.name} finished above water. The strategy is now a masterclass; the lucky parts have been removed from the presentation.`,
    };
  }
  if (facts.marketGain < 0) {
    return {
      title: 'Bought High, Built Character',
      verdict: `${facts.name} lost money but gained a powerful story about long-term investing. Please do not ask how long.`,
    };
  }
  return {
    title: 'Respectably Chaotic',
    verdict: `${facts.name} finished exactly where the spreadsheet stopped arguing. A rare draw between strategy and vibes.`,
  };
}

function buildTape(s: GameState): TapeEntry[] {
  const entries: TapeEntry[] = [];
  const seen = new Set<string>();
  const add = (lap: number, text: string, tone: TapeEntry['tone']) => {
    const key = `${lap}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ lap, text, tone });
  };

  for (const signal of [...s.marketSignals].reverse()) {
    const impact = signal.impacts.reduce((sum, item) => sum + item.d, 0);
    add(signal.lap, `${signal.title} — ${signal.summary}`, impact > 0 ? 'up' : impact < 0 ? 'down' : 'neutral');
  }

  for (const entry of [...s.log].reverse()) {
    if (!IMPORTANT_LOG.test(entry.text)) continue;
    const lower = entry.text.toLowerCase();
    const tone = lower.includes('bear') || lower.includes('interest') || lower.includes('carries')
      ? 'down'
      : lower.includes('bull') || lower.includes('buys the') || lower.includes('repays')
        ? 'up'
        : 'neutral';
    add(entry.t, entry.text, tone);
  }

  if (entries.length === 0) {
    return [{
      lap: s.lap,
      text: 'The market kept its secrets. The spreadsheet, unfortunately, kept receipts.',
      tone: 'neutral',
    }];
  }

  return entries
    .sort((a, b) => a.lap - b.lap)
    .slice(-12);
}

export function debriefShareText(s: GameState): string {
  const debrief = buildSessionDebrief(s);
  const ranked = getRankedPlayers(s);
  const mode = s.opts.scoringMode === 'gainLoss' ? 'Market Gain' : 'Net Worth';
  const lines = ranked.map((player, index) => {
    const score = s.opts.scoringMode === 'gainLoss' ? signedMoney(player.marketGain) : money(player.nw);
    return `${index + 1}. ${player.name}: ${score}`;
  });
  return [
    'THE EXCHANGE — SESSION DEBRIEF',
    `${debrief.summary.lapsReached} laps · ${debrief.summary.players} players · ${mode}`,
    ...lines,
    `Outstanding Fees: ${money(debrief.summary.outstandingFees)}`,
    `Biggest swing: ${signedMoney(debrief.summary.biggestSwing)} (${debrief.summary.biggestSwingPlayer})`,
  ].join('\n');
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function signedMoney(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return '$0';
  return `${rounded > 0 ? '+' : '−'}$${Math.abs(rounded).toLocaleString()}`;
}
