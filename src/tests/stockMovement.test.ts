import { describe, it, expect } from 'vitest';
import { getStockMovementStatus, getPlayerNetWorthMovement } from '../engine';
import { STOCK_BY_CODE } from '../data';
import { started, patch } from './helpers';

describe('getStockMovementStatus', () => {
  it('returns flat when price equals starting step', () => {
    const s = started();
    const code = 'SAFE';
    const status = getStockMovementStatus(code, s);
    expect(status.direction).toBe('flat');
    expect(status.stepDifference).toBe(0);
  });

  it('returns up when price is above starting step', () => {
    const s = started();
    const code = 'SAFE';
    const startStep = STOCK_BY_CODE[code].step;
    const higher = patch(s, d => { d.prices[code] = startStep + 2; });
    const status = getStockMovementStatus(code, higher);
    expect(status.direction).toBe('up');
    expect(status.label).toBe('Up');
    expect(status.stepDifference).toBe(2);
  });

  it('returns down when price is below starting step', () => {
    const s = started();
    const code = 'CCAI';
    const startStep = STOCK_BY_CODE[code].step;
    const lower = patch(s, d => { d.prices[code] = startStep - 1; });
    const status = getStockMovementStatus(code, lower);
    expect(status.direction).toBe('down');
    expect(status.label).toBe('Down');
    expect(status.stepDifference).toBe(-1);
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
    expect(mv.stepDifference).toBe(500);
  });

  it('returns down when net worth drops below starting cash', () => {
    const s = started();
    const poorer = patch(s, d => { d.players[0].cash -= 1000; });
    const mv = getPlayerNetWorthMovement(0, poorer);
    expect(mv.direction).toBe('down');
    expect(mv.stepDifference).toBe(-1000);
  });
});
