# 05 — Buying Power Display

**Phase:** 2 — Stock Simulator Feel
**Priority:** Medium
**Status:** Pending

---

## Goal

Help players understand what they can actually afford before and during a trade.

---

## Why It Matters

Players currently have to mentally calculate whether they can buy shares or need a loan. Showing buying power upfront reduces confusion, speeds up turns, and teaches the concept of leverage.

---

## User-Facing Behavior

Shown in Portfolio or ActionPanel during a purchase context:

```
Cash:            $6,000
Loan Balance:    $2,000
──────────────────────
Buying Power:    $6,000   (no loan available here)

  — or during a stock purchase —

Cash:            $6,000
+ Available Loan: $2,000
──────────────────────
Buying Power:    $8,000
```

Rules:
- Buying Power = Cash when not in a purchase context.
- Buying Power = Cash + $2,000 (LOAN constant) when in a valid purchase context and no loan is already active.
- If a loan is already active, no additional loan is available — show only Cash.
- "Loan available" badge appears only when `s.trade` or `s.ipoBuy` is active and `player.loans === 0`.

---

## Files Likely Affected

- `src/components/game/Portfolio.tsx` — add buying power rows
- `src/components/game/ActionPanel.tsx` — optional: show buying power near trade buttons
- `src/data/stocks.ts` — `LOAN` constant already exported (`$2,000`)
- No engine changes needed

---

## Rules That Must Not Be Broken

- Do not change engine loan logic.
- Loan availability in UI must mirror the engine condition exactly: `trade || ipoBuy` context, `player.loans === 0`.
- Buying Power is a display calculation only — never used by the engine directly.

---

## Implementation Notes

```ts
const inPurchaseContext = !!(s.trade || s.ipoBuy);
const loanAvailable = inPurchaseContext && p.loans === 0;
const buyingPower = p.cash + (loanAvailable ? LOAN : 0);
```

Display only — never passed to the engine.

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

No new engine tests needed. This is UI-only.

---

## Completion Checklist

- [ ] Buying Power row added to Portfolio or ActionPanel
- [ ] Shows cash, loan balance, and buying power clearly
- [ ] Loan bonus only shown during valid purchase context
- [ ] Correct when loan already active (no bonus)
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
