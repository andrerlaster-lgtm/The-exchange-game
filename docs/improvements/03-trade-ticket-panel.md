# 03 — Trade Ticket Panel

**Phase:** 2 — Stock Simulator Feel
**Priority:** High
**Status:** Pending

---

## Goal

Make buying and selling feel like a real stock trading action with a dedicated trade ticket UI.

---

## Why It Matters

Right now, the action panel shows Buy/Sell buttons with minimal context. Players have no visual feedback on what the trade will cost, how it affects their cash, or how many shares are available. A trade ticket makes the game feel like real investing.

---

## User-Facing Behavior

When a player lands on a stock space, the Trade Ticket Panel replaces or supplements the current action area:

```
┌─────────────────────────────────┐
│  TRADE TICKET                   │
│  CloudCore AI              CCAI │
│  Sector: Technology    Risk: ■■□ │
│                                 │
│  Current Price:       $1,000    │
│  Shares Available:    6 / 10    │
│  You Own:             2         │
│                                 │
│  Action:   [ Buy ]  [ Sell ]    │
│  Quantity:  [ - ]  1  [ + ]     │
│                                 │
│  Estimated Cost:     $1,000     │
│  Cash After Trade:   $9,000     │
│  Price Effect:  ↑ Moves up 1 step │
│                                 │
│  [ Confirm Buy ]  [ Skip ]      │
└─────────────────────────────────┘
```

---

## Files Likely Affected

- `src/components/game/ActionPanel.tsx` — integrate or replace with TradeTicket
- `src/components/game/TradeTicket.tsx` — new component (UI only, reads state + dispatches)
- `src/engine/types.ts` — read existing `TradeContext`
- No engine changes needed

---

## Rules That Must Not Be Broken

- Do not put trade logic in UI components.
- All buy/sell/skip actions must still dispatch through `actionResolver`.
- `TradeContext` is the source of truth for what action is valid.
- UI reads state; engine decides outcomes.
- Loan button must only appear in purchase context.
- Do not change engine logic.

---

## Implementation Notes

- Quantity selector starts at 1, clamps between 1 and available/owned.
- Estimated cost = quantity × current price.
- Cash after = player.cash − estimated cost (for buy) or + proceeds (for sell).
- Price effect shown as text only (not simulated in UI — engine handles it).
- "Skip" dispatches `{ t: 'skipStock', code }`.
- "Confirm Buy" dispatches `{ t: 'buy', code, qty }`.
- "Confirm Sell" dispatches `{ t: 'sell', code, qty }`.

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

No new engine tests required — this is UI only. Consider a component smoke test if desired.

---

## Completion Checklist

- [ ] `TradeTicket.tsx` component created
- [ ] Shows stock name, ticker, sector, price, supply, owned count
- [ ] Buy/Sell toggle and quantity selector
- [ ] Estimated cost and cash-after calculated correctly
- [ ] Price effect message shown
- [ ] Confirm dispatches correct action
- [ ] Skip dispatches `skipStock`
- [ ] Loan button visible only in purchase context
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
