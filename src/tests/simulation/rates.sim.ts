// Bank Rate / Market Rate balance simulation (2026-09-19).
//
// Plays 20-round games at 2-6 players on fixed seeds and reports where the
// Bank Rate ends up, what borrowing costs, how rate-sensitive stocks drift
// against the rest, and the cash-stress counts. It reads only plain state
// fields (bankRateBp defaults to 300 when absent) so the same file runs on a
// checkout from before the rate existed, for a like-for-like comparison.
//
// Run with: npx vitest run --config vitest.sim.config.ts src/tests/simulation/rates.sim.ts

import { describe, it } from 'vitest';
import { STOCK_BY_CODE } from '../../data';
import type { GameState } from '../../engine';
import { initialState, netWorth, reduce } from '../../engine';
import { makeRng } from '../../utils/rng';
import { resolveOrderRoll } from '../helpers';
import { development, playTurn } from './bot';

const ROUNDS = 20;
const GAMES = 24;

function start(n: number, seed: string): GameState {
  const r = makeRng(seed); let s = initialState(r);
  s = reduce(s, { t: 'setNum', n }, r);
  s = reduce(s, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: ROUNDS } }, r);
  s = reduce(s, { t: 'startGame' }, r);
  return resolveOrderRoll(s, n);
}

type Group = 'rateUp' | 'rateDown' | 'other';
const group = (code: string): Group => {
  const st = STOCK_BY_CODE[code];
  if (st.sector === 'finance') return 'rateUp';
  if (st.sector === 'realestate' || st.risk === 'High') return 'rateDown';
  return 'other';
};

describe('Bank Rate — balance simulation', () => {
  it('reports rates, borrowing cost, sector drift, and cash stress', () => {
    development.enabled = false;
    const out: string[] = [`RATES SIMULATION · ${ROUNDS}-round games · ${GAMES} games per player count`];
    for (const n of [2, 3, 4, 5, 6]) {
      const endRates: number[] = []; let rateChanges = 0;
      let feeInterest = 0; let loans = 0; let loanRateSum = 0; let loanInterest = 0;
      let shortfalls = 0; let insolvencies = 0; let worth = 0;
      const drift: Record<Group, number[]> = { rateUp: [], rateDown: [], other: [] };
      for (let g = 0; g < GAMES; g++) {
        const seed = `rates-${n}p-${g}`;
        const rng = makeRng(seed); const bot = makeRng(`${seed}:bot`);
        let s = start(n, seed); const open = { ...s.prices };
        for (let t = 0; t < 3000; t++) {
          const b = s;
          const nx = playTurn(s, rng, (before, _a, after) => {
            if ((before.bankRateBp ?? 300) !== (after.bankRateBp ?? 300)) rateChanges++;
            if (!before.payoutShortfallChoice && after.payoutShortfallChoice && after.players[after.cur].cash < after.payoutShortfallChoice.owed) shortfalls++;
            if (!before.insolvency && after.insolvency) insolvencies++;
            after.players.forEach((p, i) => { feeInterest += Math.max(0, p.feeDebtInterest - (before.players[i]?.feeDebtInterest ?? 0)); });
            for (const d of after.playerDebts) {
              const prev = before.playerDebts.find((x) => x.id === d.id);
              if (!prev) { loans++; loanRateSum += d.rate; } else loanInterest += Math.max(0, d.interest - prev.interest);
            }
          }, bot);
          if (nx === b || nx.phase === 'over') { s = nx; break; }
          s = nx;
        }
        endRates.push(s.bankRateBp ?? 300);
        for (const code of Object.keys(STOCK_BY_CODE)) drift[group(code)].push((s.prices[code] - open[code]) / open[code] * 100);
        worth += s.players.reduce((a, p) => a + netWorth(s, p), 0) / n;
      }
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const sorted = [...endRates].sort((a, b) => a - b);
      out.push(`── ${n} PLAYERS`);
      out.push(`  End Bank Rate: mean ${(avg(endRates) / 100).toFixed(2)}% · min ${sorted[0] / 100}% · median ${sorted[Math.floor(sorted.length / 2)] / 100}% · max ${sorted[sorted.length - 1] / 100}% · rate changes/game ${(rateChanges / GAMES).toFixed(1)}`);
      out.push(`  Price change open→end: Finance ${avg(drift.rateUp).toFixed(1)}% · Real Estate/High-Risk ${avg(drift.rateDown).toFixed(1)}% · others ${avg(drift.other).toFixed(1)}%`);
      out.push(`  Borrowing: fee interest $${Math.round(feeInterest / GAMES).toLocaleString()}/game · player loans ${loans} (avg rate ${loans ? (loanRateSum / loans).toFixed(2) : '—'}%) · loan interest $${Math.round(loanInterest / GAMES).toLocaleString()}/game`);
      out.push(`  Cash stress: shortfalls ${shortfalls} · insolvencies ${insolvencies} · mean end net worth $${Math.round(worth / GAMES).toLocaleString()}`);
    }
    development.enabled = true;
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  }, 3_600_000);
});
