// Market Open Report: the small recap shown where the old Market Open Trading
// Window used to be — this lap's buy/sell trades plus current holdings'
// gain/loss, generated the instant a player completes a lap.

import { describe, expect, it } from 'vitest';
import { holdingGainLoss } from '../engine';
import { dispatch, patch, rng, rollTo, scriptedRng, started } from './helpers';

/** Buys MEDI on its stock space, then wraps the same player past space 1
    (Market Open) via a second, non-double roll from near the end of the
    board — non-double so End Turn actually advances instead of granting a
    bonus roll. */
function buyThenWrap() {
  let s = started(2);
  s = rollTo(s, 5); // MEDI stock space
  s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
  s = patch(s, (d) => { d.players[0].pos = 34; d.turnPhase = 'preRoll'; });
  return dispatch(s, { t: 'roll' }, scriptedRng([1, 3])); // 34 + 4 wraps to space 2
}

describe('Market Open Report', () => {
  it('captures this lap\'s buy as a trade, and clears it from the player afterward', () => {
    const s = buyThenWrap();

    expect(s.marketOpenReport).not.toBeNull();
    expect(s.marketOpenReport!.player).toBe(s.players[0].name);
    expect(s.marketOpenReport!.trades).toHaveLength(1);
    expect(s.marketOpenReport!.trades[0]).toMatchObject({ kind: 'buy', player: s.players[0].name });
    expect(s.players[0].lapTrades).toEqual([]);
  });

  it('reports unrealized gain/loss for a currently held stock, matching holdingGainLoss', () => {
    let s = started(2);
    s = rollTo(s, 5); // MEDI stock space
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    // Bump MEDI's price up a step before the lap completes, so the report
    // captures a real unrealized gain (not just a $0 baseline).
    s = patch(s, (d) => { d.prices.MEDI += 1; d.players[0].pos = 34; d.turnPhase = 'preRoll'; });
    const expected = holdingGainLoss(s, s.players[0], 'MEDI');
    expect(expected.unrealized).toBeGreaterThan(0); // sanity: the bump actually created a gain

    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // wraps past space 1

    const holding = s.marketOpenReport!.holdings.find((h) => h.code === 'MEDI');
    expect(holding).toBeDefined();
    expect(holding!.qty).toBe(s.players[0].shares.MEDI);
    expect(holding!.unrealized).toBe(expected.unrealized);
    expect(holding!.returnPct).toBe(expected.returnPct);
  });

  it('has no trades or holdings listed when the player did nothing this lap', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].pos = 34; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2]));

    expect(s.marketOpenReport!.trades).toEqual([]);
    expect(s.marketOpenReport!.holdings).toEqual([]);
  });

  it('dismissMarketOpenReport clears it immediately', () => {
    let s = buyThenWrap();
    expect(s.marketOpenReport).not.toBeNull();
    s = dispatch(s, { t: 'dismissMarketOpenReport' }, rng());
    expect(s.marketOpenReport).toBeNull();
  });

  it('clears on its own once the turn passes to the next player', () => {
    let s = buyThenWrap();
    expect(s.marketOpenReport).not.toBeNull();
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.marketOpenReport).toBeNull();
  });

  it('survives a doubles bonus roll on the same turn (not cleared mid-turn)', () => {
    let s = started(2);
    s = rollTo(s, 5); // MEDI stock space
    s = dispatch(s, { t: 'buy', code: 'MEDI' }, rng());
    s = patch(s, (d) => { d.players[0].pos = 34; d.turnPhase = 'preRoll'; });
    s = dispatch(s, { t: 'roll' }, scriptedRng([2, 2])); // double — wraps AND earns a bonus roll
    expect(s.marketOpenReport).not.toBeNull();
    expect(s.bonusRollPending).toBe(true);

    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng()); // consumes the bonus roll, same player again
    expect(s.marketOpenReport).not.toBeNull();
  });
});
