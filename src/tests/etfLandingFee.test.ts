import { describe, expect, it } from 'vitest';
import { ETF_DEFS, etfLandingFee } from '../data';
import { reduce } from '../engine';
import { patch, scriptedRng, started } from './helpers';

describe('railroad-style ETF landing fees', () => {
  it('pays the fund owner a fee based on distinct funds controlled', () => {
    let s = started(2);
    s = patch(s, (d) => {
      d.players[0].cash = 10_000;
      d.players[1].cash = 10_000;
      d.players[1].etfShares = { GRW: 1, INC: 1, PROP: 1 };
      d.players[0].pos = 1;
      d.players[0].hasCompletedLap = true;
      d.turnPhase = 'preRoll';
    });
    s = reduce(s, { t: 'roll' }, scriptedRng([1, 2])); // 1 + 3 = fund space 4
    expect(s.etfPick).toBeNull();
    expect(s.landingNotice?.amount).toBe(1_500);
    s = reduce(s, { t: 'payLandingFee' }, scriptedRng([]));
    expect(s.players[0].cash).toBe(8_500);
    expect(s.players[1].cash).toBe(11_500);
    expect(s.log.some((entry) => /lands on .* owes/.test(entry.text))).toBe(true);
  });

  it('uses the agreed fee ladder', () => {
    expect(etfLandingFee(1)).toBe(500);
    expect(etfLandingFee(2)).toBe(1_000);
    expect(etfLandingFee(3)).toBe(1_500);
    expect(etfLandingFee(4)).toBe(2_500);
    expect(ETF_DEFS).toHaveLength(4);
  });
});
