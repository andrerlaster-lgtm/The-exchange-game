// IPO model — a single shared reveal queue of 4 IPOs, all at a fixed $3,000,
// no price movement from buying/selling, and only the player who lands on an
// IPO space may buy during that landing.

import { describe, expect, it } from 'vitest';
import { IPO_FIXED_PRICE, LADDER } from '../data';
import { dispatch, patch, rng, rollTo, started } from './helpers';

const IPO_SPACE = 10;

describe('IPO reveal — shared queue, fixed price', () => {
  it('landing on an IPO space with hidden IPOs reveals the next one at $3,000', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    const revealed = s.ipos.filter((ip) => ip.revealed);
    expect(revealed).toHaveLength(1);
    expect(LADDER[revealed[0].step]).toBe(IPO_FIXED_PRICE);
  });

  it('offers the revealed IPO only to the player who landed on the space', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    expect(s.ipoBuy).not.toBeNull();
    expect(s.ipoBuy!.actor).toBe(s.cur);
    expect(s.ipoBuy!.price).toBe(IPO_FIXED_PRICE);
    expect(s.ipoListPick).toBe(false);
  });

  it('the revealer can buy up to 2 shares and price never moves', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    const code = s.ipoBuy!.code;
    const stepBefore = s.ipos.find((ip) => ip.code === code)!.step;
    s = dispatch(s, { t: 'ipoBuyShare' }, rng());
    expect(s.players[0].shares[code]).toBe(1);
    expect(s.ipos.find((ip) => ip.code === code)!.step).toBe(stepBefore); // unchanged
    s = dispatch(s, { t: 'ipoBuyShare' }, rng());
    expect(s.players[0].shares[code]).toBe(2);
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'ipoBuyShare' }, rng()); // 3rd blocked (max 2)
    expect(s.players[0].cash).toBe(cash);
    expect(s.players[0].shares[code]).toBe(2);
    expect(s.ipos.find((ip) => ip.code === code)!.step).toBe(stepBefore);
  });

  it('closes the purchase after the landing player finishes', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    const code = s.ipoBuy!.code;

    s = dispatch(s, { t: 'ipoBuyShare' }, rng());
    s = dispatch(s, { t: 'ipoBuyDone' }, rng());
    expect(s.ipoBuy).toBeNull();
    expect(s.players[0].shares[code]).toBe(1);
    expect(s.players[1].shares[code] ?? 0).toBe(0);
    expect(s.players[2].shares[code] ?? 0).toBe(0);
  });

  it('lets the landing player skip without offering the IPO to anyone else', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    const code = s.ipoBuy!.code;
    s = dispatch(s, { t: 'skipIpo' }, rng());
    expect(s.ipoBuy).toBeNull();
    expect(s.players.every((p) => (p.shares[code] ?? 0) === 0)).toBe(true);
  });

  it('End Turn is blocked only until the landing player resolves the IPO choice', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    s = patch(s, (d) => { d.turnPhase = 'acted'; });
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(0); // still player 0's turn — blocked

    s = dispatch(s, { t: 'ipoBuyDone' }, rng());
    s = dispatch(s, { t: 'endTurn' }, rng());
    expect(s.cur).toBe(1);
  });
});

describe('IPO — after reveal, normal buy-list flow resumes', () => {
  it('both IPO spaces draw from the same shared queue, not independent decks', () => {
    let s = started(2);
    s = rollTo(s, IPO_SPACE); // space 10 reveals IPO #1
    const firstCode = s.ipos.find((ip) => ip.revealed)!.code;
    s = dispatch(s, { t: 'ipoBuyDone' }, rng());
    expect(s.ipoBuy).toBeNull();

    // Landing on the OTHER IPO space reveals the next queue entry, not the
    // same one again — proving it's one shared queue, not per-space decks.
    s = patch(s, (d) => { d.turnPhase = 'preRoll'; d.players[d.cur].pos = IPO_SPACE; });
    s = rollTo(s, 28);
    const revealedNow = s.ipos.filter((ip) => ip.revealed);
    expect(revealedNow).toHaveLength(2);
    expect(s.ipoBuy!.code).not.toBe(firstCode);
  });

  it('once all 4 IPOs are revealed, landing opens the general buy list for the landing player', () => {
    let s = started(2);
    s = patch(s, (d) => { d.ipos.forEach((ip) => { ip.revealed = true; }); });
    s = rollTo(s, IPO_SPACE);
    expect(s.ipoListPick).toBe(true);
    expect(s.ipoBuy).toBeNull();
  });
});

describe('IPO — supply, control, and market isolation', () => {
  it('IPO shares cannot be bought via the regular buy action', () => {
    let s = started(2);
    s = rollTo(s, IPO_SPACE);
    const code = s.ipoBuy!.code;
    s = dispatch(s, { t: 'ipoBuyDone' }, rng());
    s = patch(s, (d) => { d.trade = { scope: 'free', actionsLeft: 1 }; });
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'buy', code }, rng());
    expect(s.players[0].cash).toBe(cash);
  });

  it('exactly 4 IPOs exist in the shared queue', () => {
    const s = started(2);
    expect(s.ipos).toHaveLength(4);
  });
});
