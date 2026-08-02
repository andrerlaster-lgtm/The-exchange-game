# 07 — Leaderboard Upgrades

**Phase:** 3 — Competition and Risk Feedback
**Priority:** Medium
**Status:** Pending

---

## Goal

Make the leaderboard more competitive and informative with rank movement indicators, portfolio breakdowns, and active player highlights.

---

## Why It Matters

The current leaderboard is a static list of net worths. Players have no sense of momentum — who is climbing, who is falling, or how much of someone's wealth is liquid vs. locked in stocks.

---

## User-Facing Behavior

```
STANDINGS

#1 ▲  Morgan   $24,500  👑 Leader
#2 ▼  Riley    $22,000
#3 —  Avery    $18,750
#4 ▼  Quinn    $14,000  ← active player highlighted
```

On hover or tap, a breakdown appears:
```
Riley — $22,000
  Cash:    $8,000
  Stocks: $16,000
  Loans:  -$2,000
```

---

## Files Likely Affected

- `src/components/game/Leaderboard.tsx` — extend with rank tracking, breakdown
- `src/engine/types.ts` — may add `prevRank?: number` to Player if tracking across turns
- `src/engine/scoringEngine.ts` or `turnState.ts` — update prevRank each turn end

---

## Rules That Must Not Be Broken

- Net worth formula must not change: `Cash + Share Value - Loans`.
- Do not use rank for any game logic. Display only.
- Breakdown values must match Portfolio display exactly.

---

## Implementation Notes

**Rank movement:** compare current sorted rank to `prevRank` stored on Player. Update `prevRank` at the end of each player's turn.

**Breakdown toggle:** local UI state (useState) — no engine involvement needed.

**Active player highlight:** `p.i === s.cur`.

**Leader label:** rank === 0 in sorted list.

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

No new engine tests needed unless `prevRank` is added to Player type (in which case, verify it initializes correctly).

---

## Completion Checklist

- [ ] Rank movement indicators (▲ ▼ —) shown
- [ ] Leader label on rank #1
- [ ] Active player row highlighted
- [ ] Portfolio breakdown toggle (Cash / Stocks / Loans)
- [ ] `prevRank` updated at turn end if implemented
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
