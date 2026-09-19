import { describe, it, expect } from 'vitest';
import { getStockMovementStatus, getPlayerNetWorthMovement } from '../engine';
import { STOCK_BY_CODE } from '../data';
import { started, patch } from './helpers';

describe('getStockMovementStatus', () => {
  it('returns flat when price equals its opening price', () => {
    const s = started();
    const code = 'SAFE';
    const status = getStockMovementStatus(code, s);
    expect(status.direction).toBe('flat');
    expect(status.difference).toBe(0);
    expect(status.pctFromOpen).toBe(0);
  });

  it('returns up when price is above its opening price, with the real % change from opening', () => {
    const s = started();
    const code = 'SAFE';
    const open = STOCK_BY_CODE[code].base;
    const higher = patch(s, d => { d.prices[code] = open * 2; });
    const status = getStockMovementStatus(code, higher);
    expect(status.direction).toBe('up');
    expect(status.label).toBe('Up');
    // SAFE opens at $500 (Starter tier); doubling it is +$500 and +100%.
    expect(status.difference).toBe(500);
    expect(status.pctFromOpen).toBeCloseTo(100, 5);
  });

  it('returns down when price is below its opening price, with the real % change from opening', () => {
    const s = started();
    const code = 'CCAI';
    const open = STOCK_BY_CODE[code].base;
    const lower = patch(s, d => { d.prices[code] = open - 250; });
    const status = getStockMovementStatus(code, lower);
    expect(status.direction).toBe('down');
    expect(status.label).toBe('Down');
    // CCAI opens at $750 (Growth tier); $500 is -$250 and -33.33%.
    expect(status.difference).toBe(-250);
    expect(status.pctFromOpen).toBeCloseTo(-33.333, 2);
  });
});

describe('getPlayerNetWorthMovement', () => {
  it('returns flat at game start (net worth equals starting cash)', () => {
    const s = started();
    const mv = getPlayerNetWorthMovement(0, s);
    expect(mv.direction).toBe('flat');
  });

  it('returns up when cash increases above starting cash', () => {
    const s = started();
    const richer = patch(s, d => { d.players[0].cash += 500; });
    const mv = getPlayerNetWorthMovement(0, richer);
    expect(mv.direction).toBe('up');
    expect(mv.difference).toBe(500);
  });

  it('returns down when net worth drops below starting cash', () => {
    const s = started();
    const poorer = patch(s, d => { d.players[0].cash -= 1000; });
    const mv = getPlayerNetWorthMovement(0, poorer);
    expect(mv.direction).toBe('down');
    expect(mv.difference).toBe(-1000);
  });
});
