// IPO model — a single shared reveal queue of 3 IPOs, all at a fixed $2,000,
// no price movement from buying/selling, and only the player who lands on an
// IPO space may buy during that landing.

import { describe, expect, it } from 'vitest';
import { IPO_DEFS, IPO_FIXED_PRICE, IPO_PRESENTATION } from '../data';
import { dispatch, patch, rng, rollTo, started } from './helpers';

const IPO_SPACE = 11;

describe('IPO reveal — shared queue, fixed price', () => {
  it('has complete, unique card presentation copy for every listing', () => {
    const cards = IPO_DEFS.map((ipo) => IPO_PRESENTATION[ipo.code]);

    expect(cards.every((card) => card.icon && card.volatilityLabel && card.opportunityText && card.flavor)).toBe(true);
    expect(new Set(cards.map((card) => card.flavor)).size).toBe(IPO_DEFS.length);
    expect(IPO_PRESENTATION.RNST.opportunityTitle).toBe('INCOME + GROWTH');
    expect(IPO_PRESENTATION.RNST.opportunityText).toContain('$50 per-share dividend');
    expect(IPO_DEFS.filter((ipo) => ipo.div === 0).every((ipo) => IPO_PRESENTATION[ipo.code].opportunityText.includes('No dividend'))).toBe(true);
  });

  it('landing on an IPO space with hidden IPOs reveals the next one at $2,000', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    const revealed = s.ipos.filter((ip) => ip.revealed);
    expect(revealed).toHaveLength(1);
    expect(revealed[0].price).toBe(IPO_FIXED_PRICE);
  });

  it('offers the revealed IPO only to the player who landed on the space', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    expect(s.ipoBuy).not.toBeNull();
    expect(s.ipoBuy!.actor).toBe(s.cur);
    expect(s.ipoBuy!.price).toBe(IPO_FIXED_PRICE);
    expect(s.ipoListPick).toBe(false);
  });

  it('the revealer buys the entire 5-share offering and price never moves', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    const code = s.ipoBuy!.code;
    const priceBefore = s.ipos.find((ip) => ip.code === code)!.price;
    s = dispatch(s, { t: 'ipoBuyShare' }, rng());
    expect(s.players[0].shares[code]).toBe(5);
    expect(s.ipos.find((ip) => ip.code === code)!.supply).toBe(0);
    expect(s.ipos.find((ip) => ip.code === code)!.price).toBe(priceBefore); // unchanged
    const cash = s.players[0].cash;
    s = dispatch(s, { t: 'ipoBuyShare' }, rng()); // no offer remains after the full purchase
    expect(s.players[0].cash).toBe(cash);
    expect(s.players[0].shares[code]).toBe(5);
    expect(s.ipos.find((ip) => ip.code === code)!.price).toBe(priceBefore);
  });

  it('closes the purchase after the landing player finishes', () => {
    let s = started(3);
    s = rollTo(s, IPO_SPACE);
    const code = s.ipoBuy!.code;

    s = dispatch(s, { t: 'ipoBuyShare' }, rng());
    expect(s.ipoBuy).toBeNull();
    expect(s.players[0].shares[code]).toBe(5);
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
  it('repeat landings draw the next entry from the one shared queue', () => {
    let s = started(2);
    s = rollTo(s, IPO_SPACE); // reveals IPO #1
    const firstCode = s.ipos.find((ip) => ip.revealed)!.code;
    s = dispatch(s, { t: 'ipoBuyDone' }, rng());
    expect(s.ipoBuy).toBeNull();

    // Coming round to the same space again reveals the NEXT queue entry.
    s = patch(s, (d) => { d.turnPhase = 'preRoll'; d.players[d.cur].pos = IPO_SPACE - 4; });
    s = rollTo(s, IPO_SPACE);
    expect(s.ipos.filter((ip) => ip.revealed)).toHaveLength(2);
    expect(s.ipoBuy!.code).not.toBe(firstCode);
  });

  it('once every IPO is revealed, landing opens the available-offering list for the landing player', () => {
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

  it('exactly 3 IPOs exist in the shared queue', () => {
    // Cut from 4 on 2026-09-19 when board space 28 became Rate Decision.
    const s = started(2);
    expect(s.ipos).toHaveLength(3);
  });
});
