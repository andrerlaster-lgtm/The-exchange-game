// RANDOM RATE SHOCKS (2026-09-20) — how the game reacts when the Bank Rate
// moves at unpredictable times, and whether cheap money makes borrowing work.
//
// The live rule drifts the rate a quiet 25 bp every other round, which is
// almost no movement at all across a 20-round game. This asks what happens
// when the rate instead JUMPS at rounds nobody can predict, and pairs that
// with the open question from the leverage simulation: borrowing loses money
// because 3% a round compounds to ~81% over a game, so does a cheaper rate
// make it a live strategy or just a smaller loss?
//
// Each regime runs twice on the same seeds and dice — once with seat 1
// playing flat, once with seat 1 borrowing and never repaying — so the cost
// of leverage is measured against the same games, not against an average.
//
// The engine's own every-other-round nudge stays on in every arm; the shocks
// here are ADDED on top at random rounds. The reported rate path shows what
// the combination actually produced.
//
// Run with:
//   npx vitest run --config vitest.sim.config.ts src/tests/simulation/rateShocks.sim.ts

import { describe, it } from 'vitest';
import { BANK_RATE_MAX_BP, BANK_RATE_MIN_BP } from '../../data';
import { bankLoanBalance, initialState, netWorth, reduce } from '../../engine';
import type { GameState } from '../../engine';
import { makeRng } from '../../utils/rng';
import type { Rng } from '../../utils/rng';
import { resolveOrderRoll } from '../helpers';
import { development, leverage, playTurn, trading } from './bot';

const ROUNDS_PER_GAME = 20;
const TURN_SAFETY_CAP = 2_000;
const GAMES_PER_SIZE = 24;
const PLAYER_COUNTS = [4, 5, 6];
const BORROWER = 0;

interface Regime {
  name: string;
  note: string;
  startBp: number;
  /** Chance, per completed round, that the rate jumps at all. */
  chance: number;
  /** Sizes a jump can take, in bp; sign is drawn separately. */
  steps: number[];
}

const REGIMES: Regime[] = [
  { name: 'LIVE RULE', note: 'no shocks — the quiet 25 bp drift only', startBp: 300, chance: 0, steps: [] },
  { name: 'RANDOM', note: '1 round in 3 jumps 25-75 bp either way', startBp: 300, chance: 0.33, steps: [25, 50, 75] },
  { name: 'RANDOM WILD', note: '1 round in 2 jumps 50-150 bp either way', startBp: 300, chance: 0.5, steps: [50, 100, 150] },
  { name: 'CHEAP + RANDOM', note: 'opens at 1%, same shocks as RANDOM', startBp: 100, chance: 0.33, steps: [25, 50, 75] },
];

interface Stats {
  games: number;
  borrowerWorth: number[];
  tableWorth: number[];
  wins: number;
  interest: number;
  balanceAtClose: number[];
  insolvencies: number;      // table-wide
  ratePath: number[];        // every observed rate, for min/mean/max
  rateChanges: number;
  rateMin: number;
  rateMax: number;
}

const empty = (): Stats => ({
  games: 0, borrowerWorth: [], tableWorth: [], wins: 0, interest: 0, balanceAtClose: [],
  insolvencies: 0, ratePath: [], rateChanges: 0, rateMin: BANK_RATE_MAX_BP, rateMax: BANK_RATE_MIN_BP,
});

function startedInRoundsMode(numPlayers: number, seed: string, startBp: number): GameState {
  const r = makeRng(seed);
  let s = initialState(r);
  s = reduce(s, { t: 'setNum', n: numPlayers }, r);
  s = reduce(s, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: ROUNDS_PER_GAME, companyUpgrades: true } }, r);
  s = reduce(s, { t: 'startGame' }, r);
  s = resolveOrderRoll(s, numPlayers);
  // The opening rate is state, so a regime can set it without touching the
  // engine's constants.
  return { ...s, bankRateBp: startBp };
}

/** The shock this round delivers, in bp, or 0. */
function shock(regime: Regime, rng: Rng): number {
  if (regime.chance === 0) return 0;
  if (rng.int(1, 100) > Math.round(regime.chance * 100)) return 0;
  const size = regime.steps[rng.int(0, regime.steps.length - 1)];
  return rng.int(0, 1) === 0 ? -size : size;
}

function run(numPlayers: number, regime: Regime, levered: boolean): Stats {
  development.enabled = true;
  trading.enabled = true;
  leverage.enabled = levered;
  leverage.seats = [BORROWER];
  leverage.repayWhenFlush = false;

  const st = empty();
  for (let game = 0; game < GAMES_PER_SIZE; game += 1) {
    const seed = `shock-${numPlayers}p-${game}`;
    const rng = makeRng(seed);
    const botRng = makeRng(`${seed}:bot`);
    // The shock stream is its own, so the same game rolls the same dice with
    // or without leverage, and each regime's shocks are reproducible.
    const shockRng = makeRng(`${seed}:shock`);
    let s = startedInRoundsMode(numPlayers, seed, regime.startBp);

    const observe = (before: GameState, _a: unknown, after: GameState) => {
      const accrued = (after.players[BORROWER].bankLoanInterest ?? 0)
        - (before.players[BORROWER].bankLoanInterest ?? 0);
      if (accrued > 0) st.interest += accrued;
      if (after.insolvency && !before.insolvency) st.insolvencies += 1;
    };

    let lap = s.lap;
    for (let turn = 0; turn < TURN_SAFETY_CAP; turn += 1) {
      const next = playTurn(s, rng, observe, botRng);
      if (next === s || next.phase === 'over') { s = next; break; }
      s = next;
      if (s.lap > lap) {
        lap = s.lap;
        const bp = shock(regime, shockRng);
        if (bp !== 0) {
          const before = s.bankRateBp;
          const after = Math.min(BANK_RATE_MAX_BP, Math.max(BANK_RATE_MIN_BP, before + bp));
          if (after !== before) { s = { ...s, bankRateBp: after }; st.rateChanges += 1; }
        }
        st.ratePath.push(s.bankRateBp);
        st.rateMin = Math.min(st.rateMin, s.bankRateBp);
        st.rateMax = Math.max(st.rateMax, s.bankRateBp);
      }
    }

    st.games += 1;
    const worths = s.players.map((p) => netWorth(s, p));
    st.borrowerWorth.push(worths[BORROWER]);
    st.tableWorth.push(worths.filter((_, i) => i !== BORROWER).reduce((a, b) => a + b, 0) / (worths.length - 1));
    if (worths.every((w, i) => i === BORROWER || worths[BORROWER] >= w)) st.wins += 1;
    st.balanceAtClose.push(bankLoanBalance(s.players[BORROWER]));
  }

  leverage.enabled = false;
  leverage.seats = null;
  trading.enabled = false;
  return st;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const $ = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
const pct = (bp: number) => `${(bp / 100).toFixed(2)}%`;

describe('random rate shocks', () => {
  it('reports how the table and a borrower react at 4-6 players', () => {
    const out: string[] = [];
    const w = (l = '') => out.push(l);
    w('='.repeat(84));
    w(`RANDOM RATE SHOCK SIMULATION · ${GAMES_PER_SIZE} games × ${ROUNDS_PER_GAME} rounds per size`);
    w('Each regime runs flat and levered on the SAME seeds and dice.');
    w('The engine\'s every-other-round 25 bp drift is on in every arm; shocks are extra.');
    w('='.repeat(84));

    for (const n of PLAYER_COUNTS) {
      w();
      w(`── ${n} PLAYERS ${'─'.repeat(68)}`);
      w(`  ${'Regime'.padEnd(16)}${'rate min/avg/max'.padEnd(24)}${'flat'.padStart(10)}${'levered'.padStart(10)}${'cost of debt'.padStart(14)}`);
      for (const regime of REGIMES) {
        const flat = run(n, regime, false);
        const lev = run(n, regime, true);
        const fw = mean(flat.borrowerWorth);
        const lw = mean(lev.borrowerWorth);
        const path = `${pct(lev.rateMin)} / ${pct(mean(lev.ratePath))} / ${pct(lev.rateMax)}`;
        w(`  ${regime.name.padEnd(16)}${path.padEnd(24)}${$(fw).padStart(10)}${$(lw).padStart(10)}${$(lw - fw).padStart(14)}`);
        w(`  ${' '.repeat(16)}${regime.note}`);
        w(`  ${' '.repeat(16)}interest ${$(lev.interest / lev.games)}/game · owed at close ${$(mean(lev.balanceAtClose))} · shocks ${lev.rateChanges}`);
        w(`  ${' '.repeat(16)}table insolvencies flat ${flat.insolvencies} → levered ${lev.insolvencies} · borrower wins ${flat.wins}/${flat.games} → ${lev.wins}/${lev.games}`);
        w();
      }
    }

    w('='.repeat(84));
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  }, 900_000);
});
