# 11 — Physical Board Game Support

**Phase:** 6 — Physical Board Game Support
**Priority:** Later
**Status:** Pending

---

## Goal

Prepare the app rules and data for physical board-game print materials. The digital app becomes the authoritative rules reference that printed materials are generated from.

---

## Why It Matters

THE EXCHANGE is designed to work as a physical board game. The app currently handles all rule logic, but if players want to play physically, they need printable cards, reference sheets, and trackers.

---

## Materials to Create

### Card Sets (printable)
- Stock cards (one per stock — 24 cards)
- IPO cards (one per IPO — up to 6 cards)
- Market Event cards (full ME deck)
- Fed Rate cards (full FED deck)
- After-Hours cards (full AH deck)

### Reference Sheets
- Trading Desk reference sheet (actions available per space type)
- Player portfolio sheet (track cash, shares, loans, net worth)
- Weak Demand token guide (how the counter works)
- Short Sell tracker (open position, target step, settlement)
- Quick-start rule sheet (Fast Prototype Mode only)

---

## User-Facing Behavior

A "Print Materials" section in the app (separate from gameplay) that renders each card or sheet as a styled HTML page ready for browser print.

---

## Files Likely Affected

- `src/components/print/` — new folder for all print components
- `src/components/print/StockCard.tsx`
- `src/components/print/IpoCard.tsx`
- `src/components/print/EventCard.tsx`
- `src/components/print/ReferenceSheet.tsx`
- `src/components/print/PortfolioSheet.tsx`
- `src/app/PrintScreen.tsx` — new route or mode
- `src/index.css` — `@media print` rules

---

## Rules That Must Not Be Broken

- Do not change any engine logic.
- Print components are purely presentational — they read from data files only.
- Do not create PDF files unless explicitly requested separately.
- Print layout must use `@media print` CSS — not canvas or image rendering.
- Game data in print must match digital app data exactly (no duplication, pull from same source).

---

## Implementation Notes

Print cards should be fixed-size (e.g. standard card size 63mm × 88mm in print units).

Use CSS:
```css
@media print {
  .print-card {
    width: 63mm;
    height: 88mm;
    page-break-inside: avoid;
  }
}
```

Each card rendered from the same data arrays already in `/data`:
- `STOCKS` → stock cards
- `IPOS` → IPO cards
- `ME_DECK`, `FED_DECK`, `AH_DECK` → event cards

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

No new engine tests needed. Consider a smoke test: each deck array renders without error.

---

## Completion Checklist

- [ ] `src/components/print/` folder created
- [ ] Stock cards render (one per stock, pulls from STOCKS)
- [ ] IPO cards render (one per IPO, pulls from IPOS)
- [ ] Market Event cards render (pulls from ME_DECK)
- [ ] Fed Rate cards render (pulls from FED_DECK)
- [ ] After-Hours cards render (pulls from AH_DECK)
- [ ] Trading Desk reference sheet
- [ ] Player portfolio sheet
- [ ] Weak Demand token guide
- [ ] Short Sell tracker
- [ ] Quick-start rule sheet (Fast Prototype Mode)
- [ ] `@media print` CSS added
- [ ] Print route or screen accessible from app
- [ ] All data pulled from existing source files (no duplication)
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
