# 10 — Strategy Mode Features

**Phase:** 5 — Strategy Mode Features
**Priority:** Later
**Status:** Pending

---

## Goal

Re-activate the deeper rules that were stripped for Fast Prototype Mode once the core game feels smooth and setup options (improvement 09) are in place.

---

## Why It Matters

Fast Prototype Mode simplified many rules to speed up playtesting. Strategy Mode brings back realistic complexity: extended trading windows, advanced IPO mechanics, true diversification benefits, and commission costs.

---

## Strategy Mode Rule Pack

These rules are inactive in Fast Prototype Mode. All of them require `opts.mode === 'strategy'`.

### Extended Hours
- After-Hours cards with `strategyOnly: true` are included in the draw deck.
- Extended Hours card triggers a second trade action for the active player.
- Currently: no-op in Fast Prototype.

### Market Event Pre-Trade
- When a player lands on a Market Event space, they may make one trade action BEFORE the card is drawn.
- Currently: card draws immediately, no pre-trade.

### Advanced Weak Demand
- Six or more players at a price step triggers Weak Demand marker, not a simple skip counter.
- Weak Demand removed when a player buys from that space.
- Currently: simple 3-skip counter.

### Same-Sector Rebalance
- During Extended Hours, player may sell one stock and buy another in the same sector without triggering a price move.
- Currently: removed.

### IPO Volatility Categories
- IPOs with `vol: 'spec'` get 2× price movement on buys.
- IPOs with `vol: 'high'` get 1.5× price movement.
- Currently: all IPOs move +1 step per buy.

### Known IPO Discount
- When a player has previously seen a revealed IPO, they buy at 1 step below current price.
- Currently: always buy at current price.

### Full Diversified Portfolio Benefit
- Diversified Portfolio protection triggers a pick on any all-negative market event (already in place).
- Additional benefit: +$200 salary bonus per lap.
- Currently: salary bonus not implemented.

### Trading Fees / Commissions
- Each buy or sell costs a flat $50 commission.
- Currently: no fees.

---

## Files Likely Affected

- `src/engine/actionResolver.ts` — all strategy mode branches
- `src/engine/eventCardResolver.ts` — pre-trade, extended hours
- `src/engine/stockState.ts` — IPO volatility, vol amplification
- `src/engine/turnState.ts` — salary bonus
- `src/data/afterHoursDeck.ts` — strategy-only cards re-enter deck
- `src/data/stocks.ts` — vol field on IPOs already present
- `src/engine/types.ts` — may need `GameOptions.mode` branching

---

## Rules That Must Not Be Broken

- Fast Prototype Mode must remain completely unaffected by Strategy Mode code.
- All Strategy Mode rules must be gated by `s.opts.mode === 'strategy'` checks.
- Do not activate partial Strategy Mode rules.
- All existing Fast Prototype tests must continue to pass when mode is 'fast'.
- Add separate Strategy Mode tests — do not modify existing ones.

---

## Implementation Notes

Add a helper:
```ts
export function isStrategy(s: GameState): boolean {
  return s.opts.mode === 'strategy';
}
```

Use this guard before every strategy-mode branch in the engine.

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

Add new test files:
- `src/tests/strategyMode.test.ts` — cover Extended Hours, pre-trade, IPO vol, fees

---

## Completion Checklist

- [ ] `isStrategy()` helper added
- [ ] Extended Hours activates second trade in strategy mode
- [ ] Market Event pre-trade works in strategy mode
- [ ] Advanced Weak Demand rules active in strategy mode
- [ ] Same-sector rebalance active during Extended Hours
- [ ] IPO vol amplification active in strategy mode
- [ ] Known IPO discount active in strategy mode
- [ ] Salary bonus for Diversified Portfolio active in strategy mode
- [ ] Trading fees/commissions active in strategy mode
- [ ] Strategy-only cards included in AH deck when `mode === 'strategy'`
- [ ] All Fast Prototype tests still pass
- [ ] New Strategy Mode tests added and passing
- [ ] TypeScript check passes
- [ ] Production build succeeds
