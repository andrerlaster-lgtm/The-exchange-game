// IPO + ETF redesign balance simulation (2026-09-19).
//
// The plan's validation gate: compare ETF distributions and diversification
// bonuses with stock dividends, IPO milestones, salary, and Payout Claims at
// 2-6 players; measure how often IPO milestones are reached; and test, paired,
// whether buying ETFs and funding IPO growth pays the player who does it.
// 20-round games in rounds mode; Company Upgrades off (the default).
//
// Run with: npx vitest run --config vitest.sim.config.ts src/tests/simulation/investing.sim.ts

import { describe, it } from 'vitest';
import { IPO_MILESTONES } from '../../data';
import type { GameState } from '../../engine';
import { initialState, netWorth, reduce } from '../../engine';
import { makeRng } from '../../utils/rng';
import { resolveOrderRoll } from '../helpers';
import { development, markets, playTurn } from './bot';
import type { Observer } from './bot';

const ROUNDS = 20;
const TABLE_GAMES = 24;
const PAIRED_GAMES = 48;

function start(n: number, seed: string): GameState {
  const r = makeRng(seed); let s = initialState(r);
  s = reduce(s, { t: 'setNum', n }, r);
  s = reduce(s, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: ROUNDS } }, r);
  s = reduce(s, { t: 'startGame' }, r);
  return resolveOrderRoll(s, n);
}

function play(s0: GameState, seed: string, observe?: Observer): GameState {
  const rng = makeRng(seed); const bot = makeRng(`${seed}:bot`); let s = s0;
  for (let t = 0; t < 3000; t++) { const nx = playTurn(s, rng, observe, bot); if (nx === s || nx.phase === 'over') return nx; s = nx; }
  return s;
}

interface Table {
  income: Record<'salary' | 'dividends' | 'etf' | 'etfBonus' | 'ipoMilestones' | 'claims' | 'other', number>;
  etfShares: number; ipoShares: number; growthSpend: number; growthCount: number;
  milestoneHits: [number, number, number]; iposRevealed: number;
  shortfalls: number; insolvencies: number;
}

function table(n: number): Table {
  const T: Table = {
    income: { salary: 0, dividends: 0, etf: 0, etfBonus: 0, ipoMilestones: 0, claims: 0, other: 0 },
    etfShares: 0, ipoShares: 0, growthSpend: 0, growthCount: 0, milestoneHits: [0, 0, 0], iposRevealed: 0,
    shortfalls: 0, insolvencies: 0,
  };
  markets.onlyPlayers = null;
  for (let g = 0; g < TABLE_GAMES; g++) {
    const seed = `inv-${n}p-${g}`;
    const end = play(start(n, seed), seed, (b, a0, a) => {
      const r = a.marketOpenReport;
      if (r && r !== b.marketOpenReport) {
        T.income.salary += r.income.salary;
        T.income.dividends += r.income.dividends + r.income.conditionDividend;
        T.income.etf += r.income.etfPayout + r.income.conditionEtf;
        T.income.etfBonus += r.income.etfDiversificationBonus;
        T.income.other += r.income.diversificationBonus + r.income.recoveryBonus + r.income.developmentBonus;
      }
      const nt = a.landingNotice;
      if (nt && nt.kind === 'payout' && nt !== b.landingNotice) T.income.claims += nt.amount;
      if (!b.payoutShortfallChoice && a.payoutShortfallChoice && a.players[a.cur].cash < a.payoutShortfallChoice.owed) T.shortfalls++;
      if (!b.insolvency && a.insolvency) T.insolvencies++;
      if (a0.t === 'investIpoGrowth') { T.growthCount++; T.growthSpend += b.players[b.cur].cash - a.players[b.cur].cash; }
      // Milestone payouts: what each player's cash rose by from milestones
      // this action, recomputed exactly as the engine pays them.
      a.ipos.forEach((ip, idx) => {
        const before = b.ipos[idx]?.milestonesPaid ?? 0;
        for (let m = before; m < (ip.milestonesPaid ?? 0); m++) {
          T.milestoneHits[m]++;
          a.players.forEach((p, i) => {
            const q = Math.min(b.ipoSharesAtTurnStart[i]?.[ip.code] ?? 0, p.shares[ip.code] ?? 0);
            T.income.ipoMilestones += q * IPO_MILESTONES[m].perShare;
          });
        }
      });
    });
    T.iposRevealed += end.ipos.filter((ip) => ip.revealed).length;
    for (const p of end.players) {
      T.etfShares += Object.values(p.etfShares).reduce((x, y) => x + y, 0);
      T.ipoShares += Object.entries(p.shares).filter(([c]) => end.ipos.some((ip) => ip.code === c)).reduce((x, [, q]) => x + q, 0);
    }
  }
  return T;
}

/** Net-worth change for one rotating seat between two policies, same dice. */
function paired(n: number, configure: (seat: number, on: boolean) => void) {
  const d: number[] = []; let winsOff = 0; let winsOn = 0;
  for (let g = 0; g < PAIRED_GAMES; g++) {
    const seat = g % n; const seed = `pair-${n}p-${g}`;
    configure(seat, false); const off = play(start(n, seed), seed);
    configure(seat, true); const on = play(start(n, seed), seed);
    const w0 = off.players.map((p) => netWorth(off, p)); const w1 = on.players.map((p) => netWorth(on, p));
    d.push(w1[seat] - w0[seat]);
    if (w0[seat] === Math.max(...w0)) winsOff++;
    if (w1[seat] === Math.max(...w1)) winsOn++;
  }
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const se = Math.sqrt(d.reduce((a, b) => a + (b - mean) ** 2, 0) / (d.length - 1)) / Math.sqrt(d.length);
  return `${mean >= 0 ? '+' : '-'}$${Math.abs(Math.round(mean)).toLocaleString()} ±$${Math.round(se).toLocaleString()} · wins ${winsOff}→${winsOn}/${PAIRED_GAMES}`;
}

const k = (x: number) => `$${Math.round(x / 1000).toLocaleString()}k`;
const share = (x: number, tot: number) => `${tot ? Math.round((x / tot) * 100) : 0}%`;

describe('IPO + ETF redesign — balance simulation', () => {
  it('reports the plan\'s validation gate at 2-6 players', () => {
    development.enabled = false;
    const out: string[] = [];
    out.push(`INVESTING SIMULATION · ${ROUNDS}-round games · ${TABLE_GAMES} games per table row, ${PAIRED_GAMES} per paired row`);
    for (const n of [2, 3, 4, 5, 6]) {
      Object.assign(markets, { etfs: true, ipos: true, ipoGrowth: true, onlyPlayers: null, growthPlayers: null });
      const T = table(n);
      const i = T.income; const tot = Object.values(i).reduce((a, b) => a + b, 0);
      out.push(`── ${n} PLAYERS`);
      out.push(`  Income mix: salary ${share(i.salary, tot)} · dividends ${share(i.dividends, tot)} · ETF distributions ${share(i.etf, tot)} · ETF diversification ${share(i.etfBonus, tot)} · IPO milestones ${share(i.ipoMilestones, tot)} · claims ${share(i.claims, tot)} · other ${share(i.other, tot)}`);
      out.push(`  Per player per game: salary ${k(i.salary / (n * TABLE_GAMES))} · dividends ${k(i.dividends / (n * TABLE_GAMES))} · ETF ${k((i.etf + i.etfBonus) / (n * TABLE_GAMES))} · IPO milestones ${k(i.ipoMilestones / (n * TABLE_GAMES))} · claims received ${k(i.claims / (n * TABLE_GAMES))}`);
      out.push(`  Holdings at end, per player: ETF shares ${(T.etfShares / (n * TABLE_GAMES)).toFixed(1)} · IPO shares ${(T.ipoShares / (n * TABLE_GAMES)).toFixed(1)}`);
      out.push(`  IPOs revealed per game ${(T.iposRevealed / TABLE_GAMES).toFixed(1)} · milestones hit (per revealed IPO): +25% ${share(T.milestoneHits[0], T.iposRevealed)} · +50% ${share(T.milestoneHits[1], T.iposRevealed)} · +100% ${share(T.milestoneHits[2], T.iposRevealed)}`);
      out.push(`  Growth investments: ${T.growthCount} (${k(T.growthSpend)} total, ${k(T.growthSpend / TABLE_GAMES)}/game)`);
      out.push(`  Cash stress: shortfalls ${T.shortfalls} · insolvencies ${T.insolvencies}`);
      // Each pair differs in exactly one behaviour for the tracked seat; every
      // other player does neither, so the comparison isolates that behaviour.
      out.push(`  Paired: buys ETFs vs doesn't: ${paired(n, (s, on) => Object.assign(markets, { etfs: true, ipos: false, ipoGrowth: false, onlyPlayers: on ? [s] : [], growthPlayers: null }))}`);
      out.push(`  Paired: buys IPOs (no growth) vs doesn't: ${paired(n, (s, on) => Object.assign(markets, { etfs: false, ipos: true, ipoGrowth: false, onlyPlayers: on ? [s] : [], growthPlayers: null }))}`);
      out.push(`  Paired: buys IPOs + funds growth vs buys IPOs only: ${paired(n, (s, on) => Object.assign(markets, { etfs: false, ipos: true, ipoGrowth: true, onlyPlayers: [s], growthPlayers: on ? [s] : [] }))}`);
    }
    Object.assign(markets, { etfs: true, ipos: true, ipoGrowth: true, onlyPlayers: null, growthPlayers: null });
    development.enabled = true;
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  }, 3_600_000);
});
