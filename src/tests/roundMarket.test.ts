// THE ROUND-END MARKET (2026-09-19 rules). The market moves once per
// completed round and nowhere else: dice move pieces, cards move only what
// they name, and there is no bull/bear needle to push.

import { describe, expect, it } from 'vitest';
import {
  FED_CARDS, IPO_BY_CODE, PRICE_FLOOR, ROUND_MARKET_BP, SECTOR_CODES, STOCK_BY_CODE, applyBasisPoints,
} from '../data';
import type { SectorId } from '../data/types';
import { eligibleSectors, resolveRoundEndMarket, roundMarketForecast } from '../engine/roundMarket';
import { bankRateBp, marketRateBp } from '../engine';
import type { GameState } from '../engine';
import { dispatch, patch, rng, scriptedRng, started } from './helpers';

const SECTORS = Object.keys(SECTOR_CODES) as SectorId[];

/** Sectors whose regular companies changed price between two snapshots. */
function movedSectors(before: Record<string, number>, after: Record<string, number>): SectorId[] {
  return SECTORS.filter((sec) => SECTOR_CODES[sec].some((code) => after[code] !== before[code]));
}

/** Resolve one round-end market on a copy, with a named seed. */
function resolve(s: GameState, seed: string): GameState {
  return patch(s, (d) => { resolveRoundEndMarket(d, rng(seed)); });
}

describe('round-end market resolution', () => {
  it('moves exactly one sector, in one direction, by 2.5%, 5% or 7.5%', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const s = started(2);
      const before = { ...s.prices };
      const t = resolve(s, seed);
      const moved = movedSectors(before, t.prices);
      expect(moved).toHaveLength(1);

      const round = t.marketRound!;
      expect(round.sector).toBe(moved[0]);
      expect(ROUND_MARKET_BP).toContain(round.bp);
      const dir = round.direction === 'bull' ? 1 : -1;
      for (const code of SECTOR_CODES[moved[0]]) {
        expect(t.prices[code]).toBe(applyBasisPoints(before[code], dir * round.bp));
      }
    }
  });

  it('is a coin flip between Bullish and Bearish, and draws all three sizes', () => {
    const seen = { bull: 0, bear: 0 };
    const sizes = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const t = resolve(started(2), `flip-${i}`);
      seen[t.marketRound!.direction] += 1;
      sizes.add(t.marketRound!.bp);
    }
    expect(seen.bull).toBeGreaterThan(70);
    expect(seen.bear).toBeGreaterThan(70);
    expect([...sizes].sort((a, b) => a - b)).toEqual([...ROUND_MARKET_BP]);
  });

  it('moves revealed IPOs in the drawn sector, and never unrevealed ones', () => {
    const base = started(2);
    const ipoSector = IPO_BY_CODE[base.ipos[0].code].sector;
    const other = base.ipos.find((ip) => IPO_BY_CODE[ip.code].sector !== ipoSector)!;
    // Only the drawn sector's companies may move, so force that sector by
    // clamping every other sector's stocks to the floor and going Bearish.
    let s = patch(base, (d) => {
      d.ipos[0].revealed = true;
      const un = d.ipos.find((ip) => ip.code === other.code)!;
      un.revealed = false;
      for (const sec of SECTORS) {
        if (sec === ipoSector) continue;
        for (const code of SECTOR_CODES[sec]) d.prices[code] = PRICE_FLOOR;
      }
    });
    const ipoBefore = s.ipos[0].price;
    const unrevealedBefore = other.price;
    s = resolve(s, 'ipo-seed-bear');
    // Every other sector is pinned at the floor, so a Bearish round can only
    // pick this one; a Bullish round may pick any, so only assert on bear.
    if (s.marketRound!.direction === 'bear') {
      expect(s.marketRound!.sector).toBe(ipoSector);
      expect(s.ipos[0].price).toBe(applyBasisPoints(ipoBefore, -s.marketRound!.bp));
    }
    expect(s.ipos.find((ip) => ip.code === other.code)!.price).toBe(unrevealedBefore);
  });

  it('keeps prices on the $25 grid and never below the $100 floor', () => {
    const atFloor = patch(started(2), (d) => {
      for (const code of Object.keys(STOCK_BY_CODE)) d.prices[code] = PRICE_FLOOR;
    });
    const t = resolve(atFloor, 'floor');
    for (const code of Object.keys(STOCK_BY_CODE)) {
      expect(t.prices[code]).toBeGreaterThanOrEqual(PRICE_FLOOR);
      expect(t.prices[code] % 25).toBe(0);
    }
  });

  it('records the marker, and it stays until the next resolution', () => {
    const first = resolve(started(2), 'first');
    const marker = first.marketRound!;
    expect(marker.lap).toBe(first.lap);
    // Any number of other actions in between leave the marker alone.
    const later = dispatch(first, { t: 'skipShort' }, rng());
    expect(later.marketRound).toEqual(marker);
    const second = resolve(first, 'second');
    expect(second.marketRound).not.toEqual(marker);
  });

  it('still sets the marker when every sector is clamped in that direction', () => {
    const atFloor = patch(started(2), (d) => {
      for (const code of Object.keys(STOCK_BY_CODE)) d.prices[code] = PRICE_FLOOR;
      d.ipos.forEach((ip) => { ip.revealed = false; });
    });
    const before = { ...atFloor.prices };
    const t = resolve(atFloor, 'clamped-bear');
    if (t.marketRound!.direction === 'bear') {
      expect(t.marketRound!.sector).toBeNull();
      expect(t.prices).toEqual(before);
      expect(t.log.some((l) => /no sector could move/.test(l.text))).toBe(true);
    }
  });

  it('nudges the Bank Rate with the marker: up on Bullish, down on Bearish', () => {
    for (const seed of ['r1', 'r2', 'r3', 'r4']) {
      const s = started(2);
      const t = resolve(s, seed);
      const expected = bankRateBp(s) + (t.marketRound!.direction === 'bull' ? 25 : -25);
      expect(bankRateBp(t)).toBe(expected);
    }
  });

  it('feeds the Market Rate: neutral before any round, then last round\'s move', () => {
    const fresh = started(2);
    expect(marketRateBp(fresh)).toBe(300);
    const t = resolve(fresh, 'rate');
    const round = t.marketRound!;
    expect(marketRateBp(t)).toBe(300 + (round.direction === 'bull' ? round.bp : -round.bp));
  });

  it('does nothing when the round-end market rule is switched off', () => {
    const off = patch(started(2), (d) => { d.opts.roundMarket = false; });
    const before = { ...off.prices };
    const t = resolve(off, 'off');
    expect(t.prices).toEqual(before);
    expect(t.marketRound).toBeNull();
  });

  it('explains itself without naming anything before it is drawn', () => {
    const forecast = roundMarketForecast();
    expect(forecast.headline).toContain('2.5% (250 bp)');
    expect(forecast.headline).toContain('7.5% (750 bp)');
    expect(forecast.detail).toContain('moves your piece only');
  });

  it('lists a sector as eligible only while something in it can still move', () => {
    const atFloor = patch(started(2), (d) => {
      for (const code of SECTOR_CODES.tech) d.prices[code] = PRICE_FLOOR;
      d.ipos.forEach((ip) => { ip.revealed = false; });
    });
    expect(eligibleSectors(atFloor, -1)).not.toContain('tech');
    expect(eligibleSectors(atFloor, 1)).toContain('tech');
  });
});

describe('nothing else moves the broad market', () => {
  it('a dice roll moves the piece and no prices', () => {
    const s = patch(started(2), (d) => {
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    const before = { ...s.prices };
    const rolled = dispatch(s, { t: 'roll' }, scriptedRng([2, 1])); // to space 4, an ETF space
    expect(rolled.players[0].pos).toBe(4);
    expect(rolled.prices).toEqual(before);
    expect(rolled.marketRound).toBeNull();
  });

  it('a narrow card moves only what it names — no extra random sector', () => {
    // Rate Hike names Finance, Real Estate and High-Risk. Nothing else may move.
    const s = patch(started(2), (d) => {
      d.pendingDraws = ['FED'];
      d.decks.FED = [FED_CARDS.findIndex((c) => c.title === 'Rate Hike')];
      d.turnPhase = 'acted';
    });
    const before = { ...s.prices };
    const t = dispatch(s, { t: 'draw', deck: 'FED' }, rng('no-ripple'));
    for (const [code, stock] of Object.entries(STOCK_BY_CODE)) {
      const named = stock.sector === 'finance' || stock.sector === 'realestate' || stock.risk === 'High';
      if (!named) expect(t.prices[code], code).toBe(before[code]);
    }
    expect(t.marketSignals.some((sig) => sig.title.includes('Ripple'))).toBe(false);
  });
});
