# 02 — Fast Prototype Cleanup (Strategy-Only Cards)

**Phase:** 1 — Keep the App Playable and Clean
**Priority:** High
**Status:** Pending

---

## Goal

Strategy Mode cards (e.g. Extended Hours) are currently saved in the data deck but still get drawn during Fast Prototype gameplay. They should be silently filtered out of the active draw deck in Fast Prototype Mode.

---

## Why It Matters

Fast Prototype Mode has a simpler ruleset. Drawing an Extended Hours card and showing a "STRATEGY MODE ONLY" banner mid-game confuses players and creates dead draws. The fix is clean: never put those cards into the shuffle to begin with.

---

## User-Facing Behavior

- In Fast Prototype Mode, `strategyOnly: true` cards never appear when a deck is drawn.
- The card is still saved in `src/data/afterHoursDeck.ts` for future Strategy Mode use.
- No banner appears for strategy-only cards in Fast Prototype Mode (because they never get drawn).
- Deck size will be slightly smaller — this is acceptable and expected.

---

## Files Likely Affected

- `src/data/afterHoursDeck.ts` — card marked `strategyOnly: true` already exists
- `src/engine/deckState.ts` or wherever decks are initialized/shuffled — add filter
- `src/engine/types.ts` — `strategyOnly?: true` already on Card type
- Possibly `src/store/gameStore.ts` or `src/engine/actionResolver.ts` if deck init happens there

---

## Rules That Must Not Be Broken

- Do not remove any card from the data files.
- Do not change engine logic beyond the deck initialization filter.
- Fast Prototype Mode must remain the only active mode.
- All existing tests must pass.
- Do not add a mode-switching UI yet (that belongs in improvement 09).

---

## Implementation Notes

Add a helper function — do not inline the filter in multiple places:

```ts
// src/data/index.ts or src/engine/deckState.ts
export function getActiveDeck(cards: Card[]): Card[] {
  return cards.filter(c => !c.strategyOnly);
}
```

Call it wherever decks are shuffled at game start.

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

Add a test if needed:
- Assert that a shuffled After-Hours deck in Fast Prototype Mode contains 0 cards with `strategyOnly: true`.

---

## Completion Checklist

- [ ] `strategyOnly: true` cards never drawn in Fast Prototype Mode
- [ ] Extended Hours card remains in `afterHoursDeck.ts` unchanged
- [ ] Helper function added (not inlined)
- [ ] No strategy-only banner visible during normal gameplay
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
