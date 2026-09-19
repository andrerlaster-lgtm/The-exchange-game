// Recovery Bonus — 2026-09-18 cash-flow pass. A live 200-turn trace found
// average Payout Claim hits of $4,000-4,300 driving players to $0 cash in
// every run. Salary and dividend rates were raised at the same time, but
// this is the piece that responds directly to a player having just been
// wiped out: a flat top-up on top of normal Market Open income, checked
// against their cash BEFORE that income is added.

import { describe, expect, it } from 'vitest';
import { ETF_FUND_DISTRIBUTION, RECOVERY_BONUS, RECOVERY_BONUS_THRESHOLD, SALARY } from '../data';
import { patch, started } from './helpers';
import { payMarketOpen } from '../engine/playerState';

describe('Recovery Bonus', () => {
  it('pays the bonus on top of salary when cash is under the threshold', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].cash = 1_000; }); // well under $3,000
    const before = s.players[0].cash;
    s = patch(s, (d) => payMarketOpen(d, 0));
    expect(s.players[0].cash - before).toBe(SALARY + RECOVERY_BONUS);
    expect(s.log.some((entry) => entry.text.includes('Recovery Bonus'))).toBe(true);
  });

  it('does not pay the bonus once cash is at or above the threshold', () => {
    let s = started(2);
    s = patch(s, (d) => { d.players[0].cash = RECOVERY_BONUS_THRESHOLD; });
    const before = s.players[0].cash;
    s = patch(s, (d) => payMarketOpen(d, 0));
    expect(s.players[0].cash - before).toBe(SALARY);
    expect(s.log.some((entry) => entry.text.includes('Recovery Bonus'))).toBe(false);
  });

  it('checks cash from BEFORE this Market Open\'s own income, not after', () => {
    // At $2,900 the player is under the threshold walking in, even though
    // Salary alone would have carried them past $3,000 on its own.
    let s = started(2);
    s = patch(s, (d) => { d.players[0].cash = RECOVERY_BONUS_THRESHOLD - 100; });
    const before = s.players[0].cash;
    s = patch(s, (d) => payMarketOpen(d, 0));
    expect(s.players[0].cash - before).toBe(SALARY + RECOVERY_BONUS);
  });

  it('stacks with dividends, ETF payouts, and every other Market Open payment', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 500;
      d.players[0].shares = { SAFE: 2 }; // Low-risk, $110/share
      d.players[0].etfShares = { GRW: 1 };
    });
    const before = s.players[0].cash;
    s = patch(s, (d) => payMarketOpen(d, 0));
    const dividend = 2 * 110;
    const etfPay = ETF_FUND_DISTRIBUTION[1]; // one share of one fund
    expect(s.players[0].cash - before).toBe(SALARY + dividend + etfPay + RECOVERY_BONUS);
  });

  it('a player who is never cash-poor never sees it, across several passes', () => {
    let s = started(2);
    for (let i = 0; i < 3; i++) {
      s = patch(s, (d) => payMarketOpen(d, 0));
    }
    expect(s.log.filter((entry) => entry.text.includes('Recovery Bonus')).length).toBe(0);
  });
});
