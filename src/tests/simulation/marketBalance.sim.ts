// Balance simulation for the percentage-based market model (2026-09-18).
//
// Required by the redesign brief before any bp constant is tuned. Runs real
// games through the real engine at 2-6 players on fixed seeds and reports price
// volatility by risk tier, Payout Claim sizes, cash stress, income mix, and how
// often the $10,000 claim cap binds.
//
// Run with:  npx vitest run src/tests/simulation/marketBalance.sim.ts --reporter=basic

import { describe, it } from 'vitest';
import {
  PAYOUT_CLAIM_TOTAL_CAP, PRICE_FLOOR, CEILING_TRIGGER, STOCK_BY_CODE,
} from '../../data';
import type { GameState } from '../../engine';
import { makeRng } from '../../utils/rng';
import { started } from '../helpers';
import { playTurn } from './bot';

const TURNS_PER_GAME = 400;
const GAMES_PER_SIZE = 12;
const PLAYER_COUNTS = [2, 3, 4, 5, 6];

interface Stats {
  priceSamples: Record<'Low' | 'Med' | 'High', number[]>;
  claims: number[];
  cappedClaims: number;
  nearZeroCashPlayers: number;
  totalPlayers: number;
  salary: number;
  investmentIncome: number;
  shareSaleInflow: number;
  maxPrice: number;
  minPrice: number;
  frozen: number;
  observed: number;
}

function emptyStats(): Stats {
  return {
    priceSamples: { Low: [], Med: [], High: [] },
    claims: [], cappedClaims: 0,
    nearZeroCashPlayers: 0, totalPlayers: 0,
    salary: 0, investmentIncome: 0, shareSaleInflow: 0,
    maxPrice: 0, minPrice: Infinity, frozen: 0, observed: 0,
  };
}

/** Percentage move of every company from its own opening price. */
function samplePrices(s: GameState, stats: Stats): void {
  for (const stock of Object.values(STOCK_BY_CODE)) {
    const price = s.prices[stock.code];
    if (price == null) continue;
    stats.priceSamples[stock.risk].push(((price - stock.base) / stock.base) * 100);
    stats.maxPrice = Math.max(stats.maxPrice, price);
    stats.minPrice = Math.min(stats.minPrice, price);
    stats.observed += 1;
    if (price === stock.base) stats.frozen += 1;
  }
}

function scanLog(s: GameState, stats: Stats, seen: Set<string>): void {
  for (const entry of s.log) {
    const key = `${s.lap}|${entry.t}|${entry.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const money = /\$([\d,]+)/.exec(entry.text);
    const amount = money ? Number(money[1].replace(/,/g, '')) : 0;
    if (/Payout Claim|claim of/i.test(entry.text) && amount > 0) {
      stats.claims.push(amount);
      if (amount >= PAYOUT_CLAIM_TOTAL_CAP) stats.cappedClaims += 1;
    }
    if (/salary|Market Open/i.test(entry.text) && amount > 0) stats.salary += amount;
    if (/dividend|ETF|payout/i.test(entry.text) && amount > 0) stats.investmentIncome += amount;
    if (/sells \d+/i.test(entry.text) && amount > 0) stats.shareSaleInflow += amount;
  }
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function pctl(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function runSize(numPlayers: number): Stats {
  const stats = emptyStats();
  for (let game = 0; game < GAMES_PER_SIZE; game += 1) {
    const seed = `sim-${numPlayers}p-${game}`;
    const rng = makeRng(seed);
    let s = started(numPlayers, makeRng(seed));
    const seen = new Set<string>();
    for (let turn = 0; turn < TURNS_PER_GAME; turn += 1) {
      const next = playTurn(s, rng);
      if (next === s || next.phase === 'over') { s = next; break; }
      s = next;
      if (turn % 20 === 0) samplePrices(s, stats);
      scanLog(s, stats, seen);
    }
    samplePrices(s, stats);
    for (const p of s.players) {
      stats.totalPlayers += 1;
      if (p.cash < 500) stats.nearZeroCashPlayers += 1;
    }
  }
  return stats;
}

describe('percentage market model — balance simulation', () => {
  it('reports price volatility, claim sizes, and cash stress at 2-6 players', () => {
    const lines: string[] = [];
    const push = (l = '') => lines.push(l);

    push('='.repeat(78));
    push('PERCENTAGE MARKET MODEL — BALANCE SIMULATION');
    push(`${GAMES_PER_SIZE} games x up to ${TURNS_PER_GAME} turns per player count, fixed seeds`);
    push('='.repeat(78));

    for (const numPlayers of PLAYER_COUNTS) {
      const st = runSize(numPlayers);
      push();
      push(`── ${numPlayers} PLAYERS ${'─'.repeat(60)}`);

      push('  Price volatility by risk tier (% from opening price):');
      for (const tier of ['Low', 'Med', 'High'] as const) {
        const xs = st.priceSamples[tier];
        push(`    ${tier.padEnd(5)} mean ${mean(xs).toFixed(1).padStart(7)}%  `
          + `sd ${stdev(xs).toFixed(1).padStart(6)}  `
          + `p5 ${pctl(xs, 5).toFixed(1).padStart(7)}%  p95 ${pctl(xs, 95).toFixed(1).padStart(7)}%`);
      }

      push(`  Price range observed: ${st.minPrice === Infinity ? 'n/a' : `$${st.minPrice.toLocaleString()}`}`
        + ` – $${st.maxPrice.toLocaleString()}`
        + `   (floor $${PRICE_FLOOR}, event mark $${CEILING_TRIGGER.toLocaleString()})`);
      push(`  Never moved from opening: ${((st.frozen / Math.max(1, st.observed)) * 100).toFixed(1)}% of samples`);

      if (st.claims.length > 0) {
        push(`  Payout Claims: n=${st.claims.length}  avg $${Math.round(mean(st.claims)).toLocaleString()}`
          + `  median $${Math.round(pctl(st.claims, 50)).toLocaleString()}`
          + `  max $${Math.round(Math.max(...st.claims)).toLocaleString()}`);
        push(`  Claims at the $${PAYOUT_CLAIM_TOTAL_CAP.toLocaleString()} cap: ${st.cappedClaims}`
          + ` (${((st.cappedClaims / st.claims.length) * 100).toFixed(1)}%)`);
      } else {
        push('  Payout Claims: none recorded');
      }

      push(`  Players ending under $500 cash: ${st.nearZeroCashPlayers}/${st.totalPlayers}`
        + ` (${((st.nearZeroCashPlayers / Math.max(1, st.totalPlayers)) * 100).toFixed(1)}%)`);
      push(`  Income mix: salary/Market Open $${Math.round(st.salary).toLocaleString()}`
        + `  ·  dividends+ETF $${Math.round(st.investmentIncome).toLocaleString()}`
        + `  ·  share sales $${Math.round(st.shareSaleInflow).toLocaleString()}`);
    }

    push();
    push('='.repeat(78));
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 600_000);
});
