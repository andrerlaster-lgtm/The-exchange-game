// STRATEGY AUDIT (2026-09-20) — does the Monopoly loop actually close?
//
// Monopoly's engine is: land on a property, buy it, COMPLETE the colour group,
// build on it, and collect rent that is several times what an ungrouped
// property earns. The Exchange claims the same shape — company, Sector Control
// group, upgrades, Payout Claim — so this measures whether each rung is
// actually reached in a real 20-round game, or whether the ladder tops out.
//
// Measured by observing state, never by parsing logs. Run with:
//   npx vitest run --config vitest.sim.config.ts src/tests/simulation/strategyAudit.sim.ts

import { describe, it } from 'vitest';
import { SECTOR_CODES, SECTOR_PAIRS } from '../../data';
import type { SectorId, SectorPairId } from '../../data/types';
import { controlledSectorPairs, initialState, reduce } from '../../engine';
import type { GameState } from '../../engine';
import { makeRng } from '../../utils/rng';
import { resolveOrderRoll } from '../helpers';
import { development, playTurn, trading } from './bot';

const ROUNDS_PER_GAME = 20;
const TURN_SAFETY_CAP = 2_000;
const GAMES_PER_SIZE = 12;
const PLAYER_COUNTS = [2, 3, 4, 6];

interface Stats {
  games: number;
  /** Games in which at least one player held a completed Sector Control group at the end. */
  gamesWithAnyGroup: number;
  /** Per game: how many of the nine groups were controlled by someone at the end. */
  groupsHeldAtEnd: number[];
  /** How often each group was controlled at the end, by id. */
  byGroup: Record<string, number>;
  /** Games where someone completed a Sector Portfolio (1 share of every company in a sector). */
  gamesWithAnySectorPortfolio: number;
  portfoliosAtEnd: number[];
  /** Whole companies bought out, per game. */
  buyouts: number[];
  /** Sector Rent actually charged, in dollars and in events. */
  sectorRentEvents: number;
  sectorRentPaid: number;
  claimEvents: number;
  claimPaid: number;
  /** Upgrades reached, per game. */
  upgrades: number[];
  tradesAccepted: number;
  tradesDeclined: number;
  tradeCash: number;
}

const empty = (): Stats => ({
  games: 0, gamesWithAnyGroup: 0, groupsHeldAtEnd: [], byGroup: {},
  gamesWithAnySectorPortfolio: 0, portfoliosAtEnd: [], buyouts: [],
  sectorRentEvents: 0, sectorRentPaid: 0, claimEvents: 0, claimPaid: 0, upgrades: [],
  tradesAccepted: 0, tradesDeclined: 0, tradeCash: 0,
});

/** Does this player hold at least one share of every company in the sector? */
function hasSector(s: GameState, pi: number, sector: SectorId): boolean {
  return SECTOR_CODES[sector].every((c) => (s.players[pi].shares[c] ?? 0) > 0);
}

function startedInRoundsMode(numPlayers: number, seed: string): GameState {
  const r = makeRng(seed);
  let s = initialState(r);
  s = reduce(s, { t: 'setNum', n: numPlayers }, r);
  s = reduce(s, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: ROUNDS_PER_GAME, companyUpgrades: true } }, r);
  s = reduce(s, { t: 'startGame' }, r);
  return resolveOrderRoll(s, numPlayers);
}

function run(numPlayers: number, tradesEnabled: boolean): Stats {
  development.enabled = true;
  trading.enabled = tradesEnabled;
  const st = empty();
  for (let game = 0; game < GAMES_PER_SIZE; game += 1) {
    const seed = `audit-${numPlayers}p-${game}`;
    const rng = makeRng(seed);
    const botRng = makeRng(`${seed}:bot`);
    let s = startedInRoundsMode(numPlayers, seed);
    let buyouts = 0;

    const observe = (before: GameState, a: { t: string; id?: number }, after: GameState) => {
      if (a.t === 'acceptP2POffer') {
        const o = before.p2pOffers.find((x) => x.id === a.id);
        // An accepted offer that could not settle leaves holdings untouched.
        const settled = !!o && (after.players[o.to].shares[o.code] ?? 0) !== (before.players[o.to].shares[o.code] ?? 0);
        if (settled) { st.tradesAccepted += 1; st.tradeCash += o!.price; } else st.tradesDeclined += 1;
      }
      if (a.t === 'declineP2POffer') st.tradesDeclined += 1;
      // A whole-company buyout: supply falls from full to zero.
      for (const code of Object.keys(after.supply)) {
        if ((before.supply[code] ?? 0) > 0 && (after.supply[code] ?? 0) === 0) buyouts += 1;
      }
      // Sector Rent and Payout Claim, read off the landing notice as it appears.
      const n = after.landingNotice;
      if (n && n !== before.landingNotice && n.kind === 'payout') {
        st.claimEvents += 1;
        st.claimPaid += n.amount;
        // Sector Rent has no field of its own on the notice; the resolver
        // folds it into the total and names it in the title.
        if (n.title.includes('Sector Rent')) {
          st.sectorRentEvents += 1;
          const m = /plus \$([\d,]+) Sector Rent/.exec(n.detail);
          if (m) st.sectorRentPaid += Number(m[1].replace(/,/g, ''));
        }
      }
    };

    for (let turn = 0; turn < TURN_SAFETY_CAP; turn += 1) {
      const next = playTurn(s, rng, observe, botRng);
      if (next === s || next.phase === 'over') { s = next; break; }
      s = next;
    }

    st.games += 1;
    st.buyouts.push(buyouts);

    const groups = new Set<SectorPairId>();
    for (let pi = 0; pi < s.players.length; pi += 1) {
      for (const g of controlledSectorPairs(s, pi)) groups.add(g);
    }
    st.groupsHeldAtEnd.push(groups.size);
    if (groups.size > 0) st.gamesWithAnyGroup += 1;
    for (const g of groups) st.byGroup[g] = (st.byGroup[g] ?? 0) + 1;

    let portfolios = 0;
    for (let pi = 0; pi < s.players.length; pi += 1) {
      for (const sector of Object.keys(SECTOR_CODES) as SectorId[]) {
        if (hasSector(s, pi, sector)) portfolios += 1;
      }
    }
    st.portfoliosAtEnd.push(portfolios);
    if (portfolios > 0) st.gamesWithAnySectorPortfolio += 1;

    st.upgrades.push(Object.values(s.development).reduce((sum, d) => sum + (d?.level ?? 0), 0));
  }
  return st;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const $ = (n: number) => `$${Math.round(n).toLocaleString()}`;

describe('strategy audit — the Monopoly ladder', () => {
  it('reports how far the collect-a-set loop actually gets', () => {
    const out: string[] = [];
    const w = (l = '') => out.push(l);
    w('='.repeat(84));
    w(`STRATEGY AUDIT · ${GAMES_PER_SIZE} games × ${ROUNDS_PER_GAME} rounds per player count`);
    w('The Monopoly ladder: buy a company → complete the group → upgrade → collect rent.');
    w('='.repeat(84));

    const groupSize = Object.fromEntries(
      (Object.keys(SECTOR_PAIRS) as SectorPairId[]).map((id) => [id, SECTOR_PAIRS[id].codes.length]),
    );

    for (const n of PLAYER_COUNTS) {
      for (const [label, trades] of [['NO TRADING', false], ['TRADING ON', true]] as const) {
      const st = run(n, trades);
      w();
      w(`── ${n} PLAYERS · ${label} ${'─'.repeat(52)}`);
      w(`  Whole companies bought out per game: avg ${mean(st.buyouts).toFixed(1)} of 24`);
      w(`  Games where ANY Sector Control group was completed: ${st.gamesWithAnyGroup}/${st.games}`);
      w(`  Groups controlled at game end: avg ${mean(st.groupsHeldAtEnd).toFixed(2)} of 9`);
      const rows = Object.entries(st.byGroup).sort((a, b) => b[1] - a[1]);
      w(`  By group: ${rows.length === 0 ? 'none ever completed' : rows.map(([g, c]) => `${g}(${groupSize[g]}co) ${c}`).join(' · ')}`);
      w(`  Games where ANY Sector Portfolio completed: ${st.gamesWithAnySectorPortfolio}/${st.games} · avg ${mean(st.portfoliosAtEnd).toFixed(2)} held at end`);
      w(`  Upgrade levels standing at end: avg ${mean(st.upgrades).toFixed(1)}`);
      w(`  Payout Claims charged: ${st.claimEvents} (${$(st.claimPaid)} total)`);
      w(`  Sector Rent charged: ${st.sectorRentEvents} landings (${$(st.sectorRentPaid)} total) — ${st.claimEvents ? ((st.sectorRentEvents / st.claimEvents) * 100).toFixed(1) : '0'}% of claim landings`);
      w(`  Trades accepted: ${st.tradesAccepted} · declined ${st.tradesDeclined} · ${$(st.tradeCash)} changed hands`);
      }
    }

    w();
    w('='.repeat(84));
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  }, 600_000);
});
