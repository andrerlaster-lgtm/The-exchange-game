// LEVERAGE SIMULATION (2026-09-20) — can a borrower outrun the Bank Rate?
//
// One seat plays the borrow-and-hold strategy: draw bank debt up to the
// collateral limit, keep a standing pile of cash so a whole company is always
// affordable on landing, spend it on upgrades and on paying a premium in
// trades, and never repay a dollar early. Everyone else plays normally.
//
// The question is arithmetic. Bank interest is charged at the Bank Rate on
// EVERY ONE OF THE BORROWER'S TURNS — 3% a turn at the opening rate — while
// the market moves a sector by 2.5-7.5% once per ROUND, and a round is one
// turn each. So the debt compounds at roughly the speed the market moves, and
// only half the market moves in the borrower's favour. Upgrades and Payout
// Claims have to make up the difference.
//
// Three arms, same seeds and the same dice:
//   FLAT      — nobody borrows (baseline for seat 0)
//   LEVERED   — seat 0 borrows and never repays
//   DISCIPLINED — seat 0 borrows but pays down when cash is deep
//
// Run with:
//   npx vitest run --config vitest.sim.config.ts src/tests/simulation/leverage.sim.ts

import { describe, it } from 'vitest';
import { bankLoanBalance, initialState, netWorth, reduce } from '../../engine';
import type { GameState } from '../../engine';
import { makeRng } from '../../utils/rng';
import { resolveOrderRoll } from '../helpers';
import { development, leverage, playTurn, trading } from './bot';

const ROUNDS_PER_GAME = 20;
const TURN_SAFETY_CAP = 2_000;
const GAMES_PER_SIZE = 24;
const PLAYER_COUNTS = [4, 5, 6];
const BORROWER = 0; // the seat running the strategy

type Arm = 'FLAT' | 'LEVERED' | 'DISCIPLINED';

interface Stats {
  games: number;
  /** Seat 0's final net worth, per game. */
  borrowerWorth: number[];
  /** Mean final net worth of every other seat, per game. */
  tableWorth: number[];
  /** Games seat 0 finished first on net worth. */
  wins: number;
  borrowed: number;       // principal drawn, total
  interest: number;       // interest accrued, total
  balanceAtClose: number[];
  upgrades: number[];     // upgrade levels seat 0 holds at the end
  companies: number[];    // distinct companies seat 0 holds at the end
  insolvencies: number;   // seat 0 only
  brokeAtClose: number;   // seat 0 finished under $500 cash
  tradesAccepted: number;
}

const empty = (): Stats => ({
  games: 0, borrowerWorth: [], tableWorth: [], wins: 0, borrowed: 0, interest: 0,
  balanceAtClose: [], upgrades: [], companies: [], insolvencies: 0, brokeAtClose: 0,
  tradesAccepted: 0,
});

function startedInRoundsMode(numPlayers: number, seed: string): GameState {
  const r = makeRng(seed);
  let s = initialState(r);
  s = reduce(s, { t: 'setNum', n: numPlayers }, r);
  s = reduce(s, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: ROUNDS_PER_GAME, companyUpgrades: true } }, r);
  s = reduce(s, { t: 'startGame' }, r);
  return resolveOrderRoll(s, numPlayers);
}

function run(numPlayers: number, arm: Arm): Stats {
  development.enabled = true;
  trading.enabled = true;
  leverage.enabled = arm !== 'FLAT';
  leverage.seats = [BORROWER];
  leverage.repayWhenFlush = arm === 'DISCIPLINED';

  const st = empty();
  for (let game = 0; game < GAMES_PER_SIZE; game += 1) {
    const seed = `lev-${numPlayers}p-${game}`;
    const rng = makeRng(seed);
    const botRng = makeRng(`${seed}:bot`);
    let s = startedInRoundsMode(numPlayers, seed);

    const observe = (before: GameState, a: { t: string }, after: GameState) => {
      const b = before.players[BORROWER];
      const c = after.players[BORROWER];
      const drawn = (c.bankLoanPrincipal ?? 0) - (b.bankLoanPrincipal ?? 0);
      if (drawn > 0) st.borrowed += drawn;
      const accrued = (c.bankLoanInterest ?? 0) - (b.bankLoanInterest ?? 0);
      if (accrued > 0) st.interest += accrued;
      if (a.t === 'acceptP2POffer') st.tradesAccepted += 1;
      if (after.insolvency && !before.insolvency && after.insolvency.player === BORROWER) {
        st.insolvencies += 1;
      }
    };

    for (let turn = 0; turn < TURN_SAFETY_CAP; turn += 1) {
      const next = playTurn(s, rng, observe, botRng);
      if (next === s || next.phase === 'over') { s = next; break; }
      s = next;
    }

    st.games += 1;
    const worths = s.players.map((p) => netWorth(s, p));
    st.borrowerWorth.push(worths[BORROWER]);
    st.tableWorth.push(
      worths.filter((_, i) => i !== BORROWER).reduce((a, b) => a + b, 0) / (worths.length - 1),
    );
    if (worths.every((w, i) => i === BORROWER || worths[BORROWER] >= w)) st.wins += 1;
    st.balanceAtClose.push(bankLoanBalance(s.players[BORROWER]));
    st.upgrades.push(
      Object.entries(s.development)
        .filter(([code]) => (s.players[BORROWER].shares[code] ?? 0) > 0)
        .reduce((sum, [, d]) => sum + (d?.level ?? 0), 0),
    );
    st.companies.push(Object.values(s.players[BORROWER].shares).filter((q) => (q ?? 0) > 0).length);
    if (s.players[BORROWER].cash < 500) st.brokeAtClose += 1;
  }

  leverage.enabled = false;
  leverage.seats = null;
  leverage.repayWhenFlush = false;
  trading.enabled = false;
  return st;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const $ = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;

describe('leverage — borrowing from the bank as a strategy', () => {
  it('reports whether the market outpaces the loan at 4-6 players', () => {
    const out: string[] = [];
    const w = (l = '') => out.push(l);
    w('='.repeat(84));
    w(`LEVERAGE SIMULATION · ${GAMES_PER_SIZE} games × ${ROUNDS_PER_GAME} rounds per player count`);
    w(`Seat ${BORROWER + 1} borrows from the bank, keeps a cash buffer, spends it on upgrades`);
    w('and trades, and (in LEVERED) never repays. Everyone else plays normally.');
    w('Trading and Company Upgrades are on for every seat in all three arms.');
    w('='.repeat(84));

    for (const n of PLAYER_COUNTS) {
      const arms: Array<[Arm, Stats]> = (['FLAT', 'LEVERED', 'DISCIPLINED'] as const)
        .map((arm) => [arm, run(n, arm)]);
      const flat = arms[0][1];

      w();
      w(`── ${n} PLAYERS ${'─'.repeat(68)}`);
      for (const [arm, st] of arms) {
        const bw = mean(st.borrowerWorth);
        const tw = mean(st.tableWorth);
        w(`  ${arm.padEnd(11)} borrower net worth ${$(bw).padStart(9)} · rest of table ${$(tw).padStart(9)} · edge ${$(bw - tw).padStart(9)}`);
        w(`  ${' '.repeat(11)} wins ${String(st.wins).padStart(2)}/${st.games} · vs FLAT ${$(bw - mean(flat.borrowerWorth)).padStart(9)}`);
        if (arm !== 'FLAT') {
          w(`  ${' '.repeat(11)} borrowed ${$(st.borrowed / st.games)}/game · interest ${$(st.interest / st.games)}/game · owed at close ${$(mean(st.balanceAtClose))}`);
          const cost = st.interest / Math.max(1, st.borrowed);
          w(`  ${' '.repeat(11)} interest as a share of every dollar borrowed: ${(cost * 100).toFixed(0)}%`);
        }
        w(`  ${' '.repeat(11)} upgrade levels held ${mean(st.upgrades).toFixed(1)} · companies held ${mean(st.companies).toFixed(1)} · trades ${st.tradesAccepted}`);
        w(`  ${' '.repeat(11)} seat insolvencies ${st.insolvencies} · finished under $500 cash ${st.brokeAtClose}/${st.games}`);
        w();
      }
    }

    w('='.repeat(84));
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  }, 900_000);
});
