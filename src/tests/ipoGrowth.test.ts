// IPO growth investments and milestones (2026-09-19 redesign).

import { describe, expect, it } from 'vitest';
import { IPO_GROWTH_INVESTMENTS, IPO_MILESTONES, applyBasisPoints } from '../data';
import type { GameState } from '../engine';
import { ipoGrowthAtRisk, ipoGrowthBlockReason } from '../engine';
import { dispatch, patch, rng, started } from './helpers';

/** Player 0 holds 2 shares of the first IPO, which has launched; it's their
    turn, they've rolled, nothing is pending. Holdings are recorded as of the
    start of the turn. */
function setup(extra: (d: GameState) => void = () => {}): { s: GameState; code: string } {
  const base = started(2);
  const code = base.ipos[0].code;
  const s = patch(base, (d) => {
    d.ipos[0].revealed = true;
    d.players[0].shares[code] = 2;
    d.players[0].cash = 50_000;
    d.turnPhase = 'acted';
    d.cur = 0;
    d.ipoSharesAtTurnStart = { 0: { [code]: 2 }, 1: {} };
    extra(d);
  });
  return { s, code };
}

const invest = (s: GameState, code: string, size: 'standard' | 'major' = 'major') =>
  dispatch(s, { t: 'investIpoGrowth', code, size }, rng());
/** Move an IPO to an exact percent from launch, then run any action so the
    reducer's after-action milestone check fires. */
function setPct(s: GameState, code: string, pct: number): GameState {
  const moved = patch(s, (d) => { const ip = d.ipos.find((x) => x.code === code)!; ip.price = ip.startPrice * (1 + pct / 100); });
  return dispatch(moved, { t: 'skipShort' }, rng());
}

describe('IPO growth investment', () => {
  it('costs $500 for +250 bp or $1,000 for +500 bp, on the $25 grid', () => {
    const { s, code } = setup();
    const before = s.ipos[0].price;
    const std = invest(s, code, 'standard');
    expect(s.players[0].cash - std.players[0].cash).toBe(IPO_GROWTH_INVESTMENTS.standard.cost);
    expect(std.ipos[0].price).toBe(applyBasisPoints(before, 250)); // $3,000 → $3,075
    const maj = invest(s, code, 'major');
    expect(s.players[0].cash - maj.players[0].cash).toBe(IPO_GROWTH_INVESTMENTS.major.cost);
    expect(maj.ipos[0].price).toBe(applyBasisPoints(before, 500)); // $3,000 → $3,150
    expect(maj.lastMove[code]).toMatchObject({ source: 'ipoGrowth' });
  });

  it('requires owning at least one share', () => {
    const { s, code } = setup((d) => { d.players[0].shares = {}; });
    expect(ipoGrowthBlockReason(s, code, 'major')).toMatch(/at least 1 share/);
    expect(invest(s, code).players[0].cash).toBe(s.players[0].cash);
  });

  it('allows only one growth investment per player turn', () => {
    const { s, code } = setup();
    const once = invest(s, code);
    const twice = invest(once, code);
    expect(twice.players[0].cash).toBe(once.players[0].cash);
    expect(ipoGrowthBlockReason(once, code, 'standard')).toMatch(/already made an IPO growth investment/);
  });

  it('clears the limit when the turn passes, but not on a doubles re-roll', () => {
    const { s, code } = setup();
    const done = invest(s, code);
    const reroll = dispatch(patch(done, (d) => { d.bonusRollPending = true; }), { t: 'endTurn' }, rng());
    expect(reroll.cur).toBe(0);
    expect(reroll.ipoGrowthThisTurn).toBe(true);
    const passed = dispatch(done, { t: 'endTurn' }, rng());
    expect(passed.cur).toBe(1);
    expect(passed.ipoGrowthThisTurn).toBe(false);
  });

  it('cannot fund an IPO you bought shares of this turn', () => {
    const { s, code } = setup((d) => { d.ipoBuy = { code: d.ipos[0].code, max: 2, bought: 0, price: 3_000, actor: 0 }; });
    const bought = dispatch(dispatch(s, { t: 'ipoBuyShare' }, rng()), { t: 'ipoBuyDone' }, rng());
    expect(ipoGrowthBlockReason(bought, code, 'major')).toMatch(/bought .* shares this turn/);
  });

  it('needs the player to have rolled with nothing pending', () => {
    const { s, code } = setup((d) => { d.turnPhase = 'preRoll'; });
    expect(invest(s, code).ipos[0].price).toBe(s.ipos[0].price);
  });

  it('is refused for an IPO that has not launched', () => {
    const { s } = setup();
    const hidden = s.ipos[1].code;
    const withShare = patch(s, (d) => { d.players[0].shares[hidden] = 1; });
    expect(ipoGrowthBlockReason(withShare, hidden, 'major')).toMatch(/not launched/);
  });
});

describe('IPO milestones', () => {
  it('pays $250 / $500 / $750 per share at +25% / +50% / +100% from launch', () => {
    const { s, code } = setup();
    expect(IPO_MILESTONES.map((m) => [m.pct, m.perShare])).toEqual([[25, 250], [50, 500], [100, 750]]);
    const cash0 = s.players[0].cash;
    const m1 = setPct(s, code, 25);
    expect(m1.players[0].cash - cash0).toBe(2 * 250);
    const m2 = setPct(m1, code, 50);
    expect(m2.players[0].cash - m1.players[0].cash).toBe(2 * 500);
    const m3 = setPct(m2, code, 100);
    expect(m3.players[0].cash - m2.players[0].cash).toBe(2 * 750);
    expect(m3.ipos[0].milestonesPaid).toBe(3);
  });

  it('pays each milestone only once, even if the price falls and climbs back', () => {
    const { s, code } = setup();
    let t = setPct(s, code, 30);
    const afterFirst = t.players[0].cash;
    t = setPct(t, code, 0);
    t = setPct(t, code, 30);
    expect(t.players[0].cash).toBe(afterFirst);
  });

  it('pays every milestone a single big move clears, in order', () => {
    const { s, code } = setup();
    const t = setPct(s, code, 110);
    expect(t.players[0].cash - s.players[0].cash).toBe(2 * (250 + 500 + 750));
    expect(t.ipos[0].milestonesPaid).toBe(3);
  });

  it('pays every holder, not just the player whose turn it is', () => {
    const { s, code } = setup((d) => {
      d.players[1].shares[d.ipos[0].code] = 1;
      d.ipoSharesAtTurnStart[1] = { [d.ipos[0].code]: 1 };
    });
    const t = setPct(s, code, 25);
    expect(t.players[1].cash - s.players[1].cash).toBe(250);
  });

  it('shares bought during the turn do not qualify', () => {
    // Held 2 when the turn began, bought a 3rd since: pays on 2.
    const { s, code } = setup((d) => { d.players[0].shares[d.ipos[0].code] = 3; });
    const t = setPct(s, code, 25);
    expect(t.players[0].cash - s.players[0].cash).toBe(2 * 250);
  });

  it('shares sold during the turn do not qualify either', () => {
    const { s, code } = setup((d) => { d.players[0].shares[d.ipos[0].code] = 1; });
    const t = setPct(s, code, 25);
    expect(t.players[0].cash - s.players[0].cash).toBe(1 * 250);
  });

  it('a growth investment that crosses a threshold triggers it — and is repaid', () => {
    const { s, code } = setup((d) => { d.ipos[0].price = 3_600; }); // +20%
    const t = invest(s, code, 'major'); // +5% → $3,775, +25.8%
    expect(t.ipos[0].milestonesPaid).toBe(1);
    // -$1,000 invested, +$1,000 repaid at the milestone, +2 x $250 payout.
    expect(t.players[0].cash).toBe(s.players[0].cash + 2 * 250);
  });

  it('a new turn records current holdings for the next milestone', () => {
    const { s, code } = setup((d) => { d.players[0].shares[d.ipos[0].code] = 3; });
    const next = dispatch(s, { t: 'endTurn' }, rng());
    expect(next.ipoSharesAtTurnStart[0][code]).toBe(3);
  });
});

describe('IPO growth funding is repaid at the next milestone', () => {
  /** Invest on several separate turns by clearing the per-turn limit between. */
  function investTurns(s: GameState, code: string, times: number, size: 'standard' | 'major' = 'major'): GameState {
    let t = s;
    for (let i = 0; i < times; i++) t = invest(patch(t, (d) => { d.ipoGrowthThisTurn = false; }), code, size);
    return t;
  }

  it('tracks each player\'s growth spending since the last milestone', () => {
    const { s, code } = setup();
    const t = investTurns(s, code, 2, 'standard'); // $3,000 → $3,075 → $3,150: under +25%
    expect(ipoGrowthAtRisk(t, code, 0)).toBe(1_000);
    expect(t.players[0].cash).toBe(s.players[0].cash - 1_000);
  });

  it('repays the funder in full when the milestone is reached, then resets', () => {
    const { s, code } = setup();
    const funded = investTurns(s, code, 2, 'standard'); // $1,000 at risk
    const t = setPct(funded, code, 25);
    // +$1,000 repaid, +2 x $250 milestone payout.
    expect(t.players[0].cash - funded.players[0].cash).toBe(1_000 + 500);
    expect(ipoGrowthAtRisk(t, code, 0)).toBe(0);
    expect(t.log.some((l) => /growth funding repaid at Early Growth: .*\$1,000/.test(l.text))).toBe(true);
  });

  it('repays every funder their own amount', () => {
    const { s, code } = setup((d) => {
      d.players[1].shares[d.ipos[0].code] = 1;
      d.ipoSharesAtTurnStart[1] = { [d.ipos[0].code]: 1 };
    });
    let t = investTurns(s, code, 1, 'major'); // player 0: $1,000
    t = invest(patch(t, (d) => { d.cur = 1; d.ipoGrowthThisTurn = false; d.players[1].cash = 50_000; }), code, 'standard'); // player 1: $500
    expect(ipoGrowthAtRisk(t, code, 0)).toBe(1_000);
    expect(ipoGrowthAtRisk(t, code, 1)).toBe(500);
    const done = setPct(t, code, 25);
    expect(done.players[0].cash - t.players[0].cash).toBe(1_000 + 2 * 250);
    expect(done.players[1].cash - t.players[1].cash).toBe(500 + 1 * 250);
  });

  it('repays only once when one move clears several milestones', () => {
    const { s, code } = setup();
    const funded = investTurns(s, code, 1, 'major');
    const t = setPct(funded, code, 110);
    expect(t.players[0].cash - funded.players[0].cash).toBe(1_000 + 2 * (250 + 500 + 750));
  });

  it('repays a funder who has since sold their shares', () => {
    const { s, code } = setup();
    const funded = investTurns(s, code, 1, 'standard');
    const sold = patch(funded, (d) => { d.players[0].shares[code] = 0; });
    const t = setPct(sold, code, 25);
    expect(t.players[0].cash - sold.players[0].cash).toBe(500); // repayment only; no shares, no payout
  });

  it('stays at risk — not repaid — while the milestone is not reached', () => {
    const { s, code } = setup();
    const t = setPct(investTurns(s, code, 2, 'standard'), code, 20);
    expect(ipoGrowthAtRisk(t, code, 0)).toBe(1_000);
  });

  it('closes growth once every milestone has paid out', () => {
    const { s, code } = setup();
    const t = setPct(s, code, 110);
    expect(t.ipos[0].milestonesPaid).toBe(3);
    expect(ipoGrowthBlockReason(patch(t, (d) => { d.ipoGrowthThisTurn = false; }), code, 'major')).toMatch(/every milestone/);
  });
});

