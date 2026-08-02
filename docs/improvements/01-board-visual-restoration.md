# 01 — Restore Board-Game Visual Look

**Phase:** 1 — Keep the App Playable and Clean
**Priority:** Highest
**Status:** Done ✓

---

## Goal

Bring back the original board-game look while keeping the current working engine intact.

---

## Why It Matters

The board was temporarily flattened into a 12-column grid during refactoring. The game needs to feel like a real board game — a loop, not a spreadsheet.

---

## User-Facing Behavior

- The 36-space board renders as a proper square/loop (perimeter ring).
- Top row: spaces 1–10, left to right.
- Right column: spaces 11–18, top to bottom.
- Bottom row: spaces 19–28, right to left.
- Left column: spaces 29–36, bottom to top.
- Corners at 1, 10, 19, 28 are visually distinct.
- Center area shows "THE EXCHANGE / STOCK MARKET GAME" logo.
- Stock spaces show: ticker, sector color strip, current price, shares left, Weak Demand badge.
- Special spaces (MKT EVENT, THE FED, IPO, etc.) have distinct background + accent colors.
- Active player token visible as a colored dot on their current space.
- Multiple player tokens stack on the same space.

---

## Files Affected

- `src/components/game/BoardTrack.tsx`
- `src/components/game/GameScreen.tsx`
- `src/index.css`

---

## Rules That Must Not Be Broken

- Do not change any engine logic.
- Do not change any test files.
- Do not change any data files.
- All 43 tests must continue to pass.

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

---

## Completion Checklist

- [x] Board renders as 10×10 CSS grid perimeter loop
- [x] All 36 spaces placed correctly by gridPos()
- [x] Sector color strip on left edge of stock tiles
- [x] Ticker, price, supply shown on stock tiles
- [x] Weak Demand badge (X/3) shown when skips > 0
- [x] Special spaces use boardSpaces.ts color + glyph
- [x] Player tokens rendered as colored dots with glow
- [x] Center logo rendered
- [x] TypeScript check passes
- [x] All 43 tests pass
- [x] Production build succeeds
