// Balance simulation for the percentage market + company development
// (2026-09-18 / 2026-09-19).
//
// Plays real games through the real reducer at 2-6 players on fixed seeds,
// once with development disabled (baseline) and once enabled, and measures by
// observing state transitions — not by parsing log text — so every number is
// exact. Run with `npm run sim`.

import { describe, it } from 'vitest';
import { PAYOUT_CLAIM_TOTAL_CAP, STOCK_BY_CODE, developmentRefund } from '../../data';
import type { GameState } from '../../engine';
import { makeRng } from '../../utils/rng';
import { initialState, reduce } from '../../engine';
import { resolveOrderRoll } from '../helpers';
import { development, playTurn } from './bot';
import type { Observer } from './bot';

// Rounds mode at a realistic table length. Card mode ran 45-200 rounds per game
// (and often hit the turn cap before Market Close was drawn), which let every
// compounding effect — upgrade drift especially — run far past a real game.
const ROUNDS_PER_GAME = 20;
const TURN_SAFETY_CAP = 2_000; // only guards against a stuck game
const GAMES_PER_SIZE = 12;
const PLAYER_COUNTS = [2, 3, 4, 5, 6];
const SAMPLE_EVERY = 20;

type Tier = 'Low' | 'Med' | 'High';

interface Claim { owed: number; level: number; capped: boolean; bonusLostToCap: number }

interface Stats {
  claims: Claim[];
  upgradesBought: [number, number, number];
  shieldsBought: number;
  shieldsConsumed: number;
  refunds: number[];
  pctByTier: Record<Tier, number[]>;
  pctByLevel: number[][];
  insolvencies: number;
  shortfalls: number;
  endUnder500: number;
  players: number;
  income: { salary: number; dividends: number; etf: number; development: number; other: number; claimsReceived: number; shareSales: number };
  maxPrice: number;
  rounds: number[];
  completed: number;
}

const empty = (): Stats => ({
  claims: [], upgradesBought: [0, 0, 0], shieldsBought: 0, shieldsConsumed: 0, refunds: [],
  pctByTier: { Low: [], Med: [], High: [] }, pctByLevel: [[], [], [], []],
  insolvencies: 0, shortfalls: 0, endUnder500: 0, players: 0,
  income: { salary: 0, dividends: 0, etf: 0, development: 0, other: 0, claimsReceived: 0, shareSales: 0 },
  maxPrice: 0, rounds: [], completed: 0,
});

function observer(st: Stats): Observer {
  return (before, action, after) => {
    // Payout Claims — a new payout notice appeared.
    const notice = after.landingNotice;
    if (notice && notice.kind === 'payout' && notice !== before.landingNotice) {
      const code = notice.title.split('· ').pop()!.trim();
      const lost = /only \$([\d,]+) applies/.exec(notice.detail);
      const bonus = [0, 750, 1_500, 2_500][after.development[code]?.level ?? 0];
      st.claims.push({
        owed: notice.amount,
        level: after.development[code]?.level ?? 0,
        capped: notice.amount >= PAYOUT_CLAIM_TOTAL_CAP,
        bonusLostToCap: lost ? bonus - Number(lost[1].replace(/,/g, '')) : 0,
      });
      st.income.claimsReceived += notice.amount;
    }
    if (!before.payoutShortfallChoice && after.payoutShortfallChoice && after.players[after.cur].cash < after.payoutShortfallChoice.owed) st.shortfalls += 1;
    if (!before.insolvency && after.insolvency) st.insolvencies += 1;

    // Development transitions.
    let refundThisAction = 0;
    for (const code of Object.keys(after.development ?? {})) {
      const b = before.development[code]; const a = after.development[code];
      if (!b || !a) continue;
      if (a.level > b.level) st.upgradesBought[a.level - 1] += 1;
      if (!b.shieldActive && a.shieldActive) st.shieldsBought += 1;
      if (b.fundedBy != null && a.fundedBy == null) {
        if (b.totalInvested > 0) { const r = developmentRefund(b.totalInvested); st.refunds.push(r); refundThisAction += r; }
      } else if (b.shieldActive && !a.shieldActive) {
        st.shieldsConsumed += 1;
      }
    }

    // Income: the Market Open report is the exact breakdown.
    const report = after.marketOpenReport;
    if (report && report !== before.marketOpenReport) {
      const inc = report.income;
      st.income.salary += inc.salary;
      st.income.dividends += inc.dividends + inc.conditionDividend;
      st.income.etf += inc.etfPayout + inc.etfDiversificationBonus + inc.conditionEtf;
      st.income.development += inc.developmentBonus;
      st.income.other += inc.diversificationBonus + inc.recoveryBonus;
    }
    if (action.t === 'sell' || action.t === 'forcedSell' || action.t === 'marginSell' || action.t === 'choosePayoutForceSell') {
      const gained = after.players[before.cur].cash - before.players[before.cur].cash - refundThisAction;
      if (gained > 0) st.income.shareSales += gained;
    }
  };
}

function sample(s: GameState, st: Stats): void {
  for (const stock of Object.values(STOCK_BY_CODE)) {
    const price = s.prices[stock.code];
    const pct = ((price - stock.base) / stock.base) * 100;
    st.pctByTier[stock.risk].push(pct);
    st.pctByLevel[s.development[stock.code]?.level ?? 0].push(pct);
    st.maxPrice = Math.max(st.maxPrice, price);
  }
}

/** A started game set to end after ROUNDS_PER_GAME rounds. Options must be set
    before startGame: the deck is built for the close mode at that point. */
function startedInRoundsMode(numPlayers: number, seed: string): GameState {
  const r = makeRng(seed);
  let s = initialState(r);
  s = reduce(s, { t: 'setNum', n: numPlayers }, r);
  s = reduce(s, { t: 'setOpt', opt: { closeMode: 'rounds', closeRounds: ROUNDS_PER_GAME } }, r);
  s = reduce(s, { t: 'startGame' }, r);
  return resolveOrderRoll(s, numPlayers);
}

function run(numPlayers: number, upgrades: boolean): Stats {
  development.enabled = upgrades;
  const st = empty();
  const observe = observer(st);
  for (let game = 0; game < GAMES_PER_SIZE; game += 1) {
    const seed = `sim-${numPlayers}p-${game}`;
    const rng = makeRng(seed);
    let s = startedInRoundsMode(numPlayers, seed);
    for (let turn = 0; turn < TURN_SAFETY_CAP; turn += 1) {
      const next = playTurn(s, rng, observe);
      if (next === s || next.phase === 'over') { s = next; break; }
      s = next;
      if (turn % SAMPLE_EVERY === 0) sample(s, st);
    }
    sample(s, st);
    st.rounds.push(s.lap);
    if (s.phase === 'over') st.completed += 1;
    for (const p of s.players) { st.players += 1; if (p.cash < 500) st.endUnder500 += 1; }
  }
  return st;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const $ = (n: number) => `$${Math.round(n).toLocaleString()}`;
const share = (part: number, whole: number) => `${whole ? ((part / whole) * 100).toFixed(0) : 0}%`;

describe('percentage market + company development — balance simulation', () => {
  it('reports 2-6 player results with development off and on', () => {
    const out: string[] = [];
    const w = (l = '') => out.push(l);
    w('='.repeat(84));
    w(`BALANCE SIMULATION · ${GAMES_PER_SIZE} games × ${ROUNDS_PER_GAME} rounds (rounds mode) per player count · fixed seeds`);
    w('='.repeat(84));

    for (const n of PLAYER_COUNTS) {
      const base = run(n, false);
      const dev = run(n, true);
      w();
      w(`── ${n} PLAYERS ${'─'.repeat(68)}`);
      w(`  Games reaching Market Close: ${dev.completed}/${GAMES_PER_SIZE} · rounds played avg ${mean(dev.rounds).toFixed(1)}`);

      w('  Payout Claims (development ON), by upgrade level:');
      for (let lv = 0; lv <= 3; lv += 1) {
        const cs = dev.claims.filter((c) => c.level === lv);
        if (!cs.length) { w(`    ${['Base', 'Ⅰ', 'Ⅱ', 'Ⅲ'][lv].padEnd(4)} none`); continue; }
        w(`    ${['Base', 'Ⅰ', 'Ⅱ', 'Ⅲ'][lv].padEnd(4)} n=${String(cs.length).padStart(4)}  avg ${$(mean(cs.map((c) => c.owed))).padStart(7)}  max ${$(Math.max(...cs.map((c) => c.owed))).padStart(7)}`);
      }
      const capped = dev.claims.filter((c) => c.capped);
      w(`  Claims at the ${$(PAYOUT_CLAIM_TOTAL_CAP)} cap: ${capped.length} of ${dev.claims.length} (value ${$(capped.reduce((a, c) => a + c.owed, 0))}; upgrade bonus lost to cap ${$(capped.reduce((a, c) => a + c.bonusLostToCap, 0))})`);
      w(`  Baseline (dev OFF): claims n=${base.claims.length} avg ${$(mean(base.claims.map((c) => c.owed)))} · at cap ${base.claims.filter((c) => c.capped).length}`);

      w(`  Upgrades bought: Ⅰ ${dev.upgradesBought[0]} · Ⅱ ${dev.upgradesBought[1]} · Ⅲ ${dev.upgradesBought[2]}`);
      w(`  Shields: bought ${dev.shieldsBought} · consumed ${dev.shieldsConsumed}`);
      w(`  Refunds: ${dev.refunds.length}${dev.refunds.length ? ` · avg ${$(mean(dev.refunds))}` : ''}`);

      w('  Price volatility, sd of % from opening (OFF → ON):');
      for (const tier of ['Low', 'Med', 'High'] as const) {
        w(`    ${tier.padEnd(5)} ${sd(base.pctByTier[tier]).toFixed(1).padStart(5)} → ${sd(dev.pctByTier[tier]).toFixed(1).padStart(5)}   mean ${mean(dev.pctByTier[tier]).toFixed(1).padStart(6)}%`);
      }
      w(`  By upgrade level (ON): ${dev.pctByLevel.map((xs, lv) => `${['Base', 'Ⅰ', 'Ⅱ', 'Ⅲ'][lv]} mean ${mean(xs).toFixed(1)}% sd ${sd(xs).toFixed(1)} (n=${xs.length})`).join(' · ')}`);
      w(`  Max price observed: ${$(dev.maxPrice)}`);

      w(`  Cash stress (OFF → ON): insolvencies ${base.insolvencies} → ${dev.insolvencies} · claim shortfalls ${base.shortfalls} → ${dev.shortfalls} · players ending < $500: ${base.endUnder500}/${base.players} → ${dev.endUnder500}/${dev.players}`);

      const i = dev.income;
      const total = i.salary + i.dividends + i.etf + i.development + i.other + i.claimsReceived + i.shareSales;
      w(`  Income mix (ON): salary ${share(i.salary, total)} · dividends ${share(i.dividends, total)} · ETF ${share(i.etf, total)} · development ${share(i.development, total)} · claims received ${share(i.claimsReceived, total)} · share sales ${share(i.shareSales, total)} · other ${share(i.other, total)}`);
    }
    w();
    w('='.repeat(84));
    development.enabled = true;
    // eslint-disable-next-line no-console
    console.log(out.join('\n'));
  }, 900_000);
});
