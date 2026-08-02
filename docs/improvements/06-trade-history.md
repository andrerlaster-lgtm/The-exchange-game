# 06 — Trade History

**Phase:** 2 — Stock Simulator Feel
**Priority:** Medium
**Status:** Pending

---

## Goal

Separate financial trade events from the general game log so players can review what trades were made without hunting through move messages.

---

## Why It Matters

The current Log mixes all game events together: rolls, card draws, buys, sells, dividends. Players cannot easily review what trades happened or who made what moves without reading every line.

---

## User-Facing Behavior

A dedicated Trade History panel (separate from the general Log) shows only financial transactions:

```
TRADE HISTORY

Morgan   bought  2 × CCAI  at $1,000   → $2,000
Riley    sold    1 × SAFE   at $500     → +$500
Avery    IPO     2 × NDRV   at $750     → $1,500
Quinn    shorted OILW       at Step 6
Morgan   loan taken                     +$2,000
Riley    loan repaid                    -$2,000
Morgan   dividend FTRB                  +$100
```

---

## Files Likely Affected

- `src/engine/types.ts` — add `TradeEntry` type and `tradeLog: TradeEntry[]` to `GameState`
- `src/engine/actionResolver.ts` — push entries on buy, sell, ipoBuy, takeLoan, repayLoan, short
- `src/engine/turnState.ts` — do not clear tradeLog on turn end
- `src/components/game/TradeHistory.tsx` — new component
- `src/components/game/GameScreen.tsx` — add TradeHistory to left or center column
- `src/store/gameStore.ts` — ensure tradeLog initialized as `[]`

---

## Rules That Must Not Be Broken

- Do not change how buy/sell/loan actions work — only append to log after the action resolves.
- Do not use tradeLog for any game logic. It is read-only history.
- Engine may append entries; UI only reads them.

---

## Implementation Notes

```ts
// In types.ts
export interface TradeEntry {
  turn: number;
  player: string;
  action: 'buy' | 'sell' | 'ipo' | 'short' | 'loan' | 'repay' | 'dividend';
  code?: string;
  qty?: number;
  price?: number;
  amount?: number;
}
```

Append in actionResolver after the action resolves:
```ts
s.tradeLog.push({ turn: s.turn, player: p.name, action: 'buy', code, qty, price, amount: qty * price });
```

TradeHistory component renders the log in reverse order (most recent first).

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

Consider adding a test: after a buy action, `s.tradeLog` has one entry with correct fields.

---

## Completion Checklist

- [ ] `TradeEntry` type added to `types.ts`
- [ ] `tradeLog: TradeEntry[]` added to `GameState` and initialized as `[]`
- [ ] Buy action appends entry
- [ ] Sell action appends entry
- [ ] IPO buy appends entry
- [ ] Short sell appends entry
- [ ] Loan taken appends entry
- [ ] Loan repaid appends entry
- [ ] Dividend appends entry
- [ ] `TradeHistory.tsx` component created (renders most recent first)
- [ ] Added to `GameScreen.tsx`
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
