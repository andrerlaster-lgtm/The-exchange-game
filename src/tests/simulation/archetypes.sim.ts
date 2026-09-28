// ARCHETYPES (2026-09-27) — the cash player against the investor.
//
// Seat 1 hoards liquidity: it buys only what still leaves a $20,000 cushion,
// never borrows, never develops a company, and never trades. Every Payout
// Claim it owes is payable from hand, and nothing it owns compounds.
//
// Seat 2 does the opposite: it keeps $1,500 back, buys whatever it lands on
// and can afford, upgrades and shields its companies, funds IPO growth,
// trades to complete sets, and borrows against its holdings.
//
// Seat 3 is the investor without the debt — identical policy, but it never
// borrows — which separates owning things from using debt to own them.
//
// Every other seat plays the ordinary middle policy, so the archetypes are
// measured against the same field and against each other in the same games.
//
// Run with:
//   npx vitest run --config vitest.sim.config.ts src/tests/simulation/archetypes.sim.ts

import { describe, it } from 'vitest';
import { bankLoanBalance, initialState, netWorth, reduce } from '../../engine';
import type { GameState } from '../../engine';
import { makeRng } from '../../utils/rng';
import { resolveOrderRoll } from '../helpers';
import { development, leverage, playTurn, styles, trading } from './bot';

const ROUNDS_PER_GAME = 20;
const TURN_SAFETY_CAP = 2_000;
const GAMES_PER_SIZE = 30;
const PLAYER_COUNTS = [4, 5, 6];
const CASH_SEAT = 0;
const INVESTOR_SEAT = 1;
const OWNER_SEAT = 2; // the investor policy with borrowing switched off

interface SeatStats {
  worth: number[];
  cash: number[];
  wins: number;
  companies: number[];
  upgrades: number[];
  claimsPaid: number;
  claimsReceived: number;
  insolvencies: number;
  loanAtClose: number[];
}

const emptySeat = (): SeatStats => ({
  worth: [], cash: [], wins: 0, companies: [], upgrades: [],
  claimsPaid: 0, claimsReceived: 0, insolvencies: 0, loanAtClose: [],
});

function startedInRoundsMode(numPlayers: number, seed: string): GameState {
  const r = makeRng(seed);
  let s = initialState(r);
  s = reduce(s, { t: 'setNum', n: numPlayers }, r);
  s = reduce(s, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: ROUNDS_PER_GAME, companyUpgrades: true } }, r);
  s = reduce(s, { t: 'startGame' }, r);
  return resolveOrderRoll(s, numPlayers);
}

/** Seats other than the two archetypes. */
const fieldSeats = (n: number) => Array.from({ length: n }, (_, i) => i)
  .filter((i) => i !== CASH_SEAT && i !== INVESTOR_SEAT && i !== OWNER_SEAT);

function run(numPlayers: number) {
  development.enabled = true;
  trading.enabled = true;
  leverage.enabled = true;
  leverage.seats = [INVESTOR_SEAT]; // only the investor borrows
  leverage.repayWhenFlush = false;
  styles.enabled = true;
  styles.bySeat = { [CASH_SEAT]: 'cash', [INVESTOR_SEAT]: 'investor', [OWNER_SEAT]: 'owner' };

  const cash = emptySeat();
  const investor = emptySeat();
  const owner = emptySeat();
  const field = emptySeat();

  for (let game = 0; game < GAMES_PER_SIZE; game += 1) {
    const seed = `arch-${numPlayers}p-${game}`;
    const rng = makeRng(seed);
    const botRng = makeRng(`${seed}:bot`);
    let s = startedInRoundsMode(numPlayers, seed);

    const observe = (before: GameState, _a: unknown, after: GameState) => {
      const n = after.landingNotice;
      if (n && n !== before.landingNotice && n.kind === 'payout') {
        // The payer is whoever is on turn; the payee is named in the notice.
        const payer = after.cur;
        if (payer === CASH_SEAT) cash.claimsPaid += n.amount;
        else if (payer === INVESTOR_SEAT) investor.claimsPaid += n.amount;
        else if (payer === OWNER_SEAT) owner.claimsPaid += n.amount;
        else field.claimsPaid += n.amount;
        // The notice names the PAYER, not the payee, so the claim holder has
        // to come from state: the title carries the company code.
        const code = n.title.split('·').pop()?.trim() ?? '';
        const payeeIndex = before.soldOut[code]?.claimHolder ?? -1;
        if (payeeIndex === CASH_SEAT) cash.claimsReceived += n.amount;
        else if (payeeIndex === INVESTOR_SEAT) investor.claimsReceived += n.amount;
        else if (payeeIndex === OWNER_SEAT) owner.claimsReceived += n.amount;
        else if (payeeIndex >= 0) field.claimsReceived += n.amount;
      }
      if (after.insolvency && !before.insolvency) {
        const who = after.insolvency.player;
        if (who === CASH_SEAT) cash.insolvencies += 1;
        else if (who === INVESTOR_SEAT) investor.insolvencies += 1;
        else if (who === OWNER_SEAT) owner.insolvencies += 1;
        else field.insolvencies += 1;
      }
    };

    for (let turn = 0; turn < TURN_SAFETY_CAP; turn += 1) {
      const next = playTurn(s, rng, observe, botRng);
      if (next === s || next.phase === 'over') { s = next; break; }
      s = next;
    }

    const worths = s.players.map((p) => netWorth(s, p));
    const best = Math.max(...worths);
    const holdings = (pi: number) => Object.values(s.players[pi].shares).filter((q) => (q ?? 0) > 0).length;
    const levels = (pi: number) => Object.entries(s.development)
      .filter(([code]) => (s.players[pi].shares[code] ?? 0) > 0)
      .reduce((sum, [, d]) => sum + (d?.level ?? 0), 0);

    const record = (st: SeatStats, pi: number) => {
      st.worth.push(worths[pi]);
      st.cash.push(s.players[pi].cash);
      st.companies.push(holdings(pi));
      st.upgrades.push(levels(pi));
      st.loanAtClose.push(bankLoanBalance(s.players[pi]));
      if (worths[pi] === best) st.wins += 1;
    };
    record(cash, CASH_SEAT);
    record(investor, INVESTOR_SEAT);
    record(owner, OWNER_SEAT);
    for (const pi of fieldSeats(numPlayers)) record(field, pi);
  }

  styles.enabled = false;
  styles.bySeat = {};
  leverage.enabled = false;
  leverage.seats = null;
  trading.enabled = false;
  return { cash, investor, owner, field };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const $ = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;

describe('archetypes — the cash player vs the investor', () => {
  it('reports how each finishes at 4-6 players', () => {
    const out: string[] = [];
    const w = (l = '') => out.push(l);
    w('='.repeat(84));
    w(`ARCHETYPE SIMULATION · ${GAMES_PER_SIZE} games × ${ROUNDS_PER_GAME} rounds per player count`);
    w(`Seat 1 = CASH (keeps ${$(styles.cashReserve)}, no debt, no upgrades, no trades)`);
    w(`Seat 2 = INVESTOR (keeps ${$(styles.investorReserve)}, buys, upgrades, trades, borrows)`);
    w('Seat 3 = OWNER    (the same as the investor, but never borrows)');
    w('Every other seat plays the ordinary policy.');
    w('='.repeat(84));

    for (const n of PLAYER_COUNTS) {
      const { cash, investor, owner, field } = run(n);
      const games = cash.worth.length;
      w();
      w(`── ${n} PLAYERS ${'─'.repeat(68)}`);
      w(`  ${''.padEnd(12)}${'net worth'.padStart(11)}${'cash held'.padStart(11)}${'wins'.padStart(8)}${'cos'.padStart(6)}${'lvls'.padStart(6)}${'claims paid'.padStart(13)}${'claims got'.padStart(12)}${'insolv'.padStart(8)}`);
      const row = (label: string, st: SeatStats, seats: number) => {
        w(`  ${label.padEnd(12)}${$(mean(st.worth)).padStart(11)}${$(mean(st.cash)).padStart(11)}`
          + `${`${st.wins}/${games}`.padStart(8)}${mean(st.companies).toFixed(1).padStart(6)}${mean(st.upgrades).toFixed(1).padStart(6)}`
          + `${$(st.claimsPaid / games / seats).padStart(13)}${$(st.claimsReceived / games / seats).padStart(12)}${String(st.insolvencies).padStart(8)}`);
      };
      row('CASH', cash, 1);
      row('INVESTOR', investor, 1);
      row('OWNER', owner, 1);
      row('field (avg)', field, n - 3);
      w(`  investor's bank debt at close: ${$(mean(investor.loanAtClose))}`);
      w(`  gap, investor - cash: ${$(mean(investor.worth) - mean(cash.worth))}`);
      w(`  cost of the debt, owner - investor: ${$(mean(owner.worth) - mean(investor.worth))}`);
    }

    w();
    w('Claims paid/got are per seat per game. "cos" = companies held at close,');
    w('"lvls" = upgrade levels standing on companies that seat still controls.');
    w('='.repeat(84));
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  }, 900_000);
});
