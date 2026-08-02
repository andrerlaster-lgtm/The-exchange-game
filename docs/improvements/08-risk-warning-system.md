# 08 — Risk Warning System

**Phase:** 3 — Competition and Risk Feedback
**Priority:** Medium
**Status:** Pending

---

## Goal

Show players a risk badge when their portfolio has dangerous characteristics — not to punish them, but to teach real investing risk concepts.

---

## Why It Matters

New players may not realize they are over-leveraged or over-concentrated until a bad card hits. A risk badge gives immediate, visual feedback about portfolio health.

---

## User-Facing Behavior

A Risk Badge appears in the Portfolio panel:

```
Portfolio Risk:  [ HIGH RISK ]
```

Possible badge states:

| Badge | Color | Conditions |
|-------|-------|------------|
| LOW RISK | Green | No loans, no shorts, balanced sectors |
| BALANCED | Blue | Diversified, no leverage |
| HIGH RISK | Red | Loan active AND short active |
| LEVERAGED | Orange | Loan active |
| SHORT EXPOSURE | Orange | Short active |
| OVERCONCENTRATED | Yellow | >60% portfolio value in one stock or sector |
| LOW CASH | Yellow | Cash < $1,000 |
| IPO HEAVY | Yellow | >40% of shares are IPO holdings |

Only one badge shown at a time — highest severity wins.

---

## Files Likely Affected

- `src/components/game/Portfolio.tsx` — add risk badge display
- `src/components/game/RiskBadge.tsx` — new component (or inline in Portfolio)
- `src/engine/scoringEngine.ts` — add `portfolioRisk(state, player)` helper if logic is non-trivial
- No action or reducer changes needed

---

## Rules That Must Not Be Broken

- Risk badge is display-only. Never affects scoring, rules, or actions.
- Do not put risk calculation logic in the UI component — move it to a helper or `scoringEngine.ts`.
- Risk must recalculate every render based on current state.

---

## Implementation Notes

```ts
// src/engine/scoringEngine.ts
export type RiskLevel = 'low' | 'balanced' | 'leveraged' | 'short' | 'high' | 'concentrated' | 'lowcash' | 'ipoheavy';

export function portfolioRisk(s: GameState, p: Player): RiskLevel {
  if (p.loans > 0 && s.shorts.some(sh => sh.player === p.name)) return 'high';
  if (p.loans > 0) return 'leveraged';
  if (s.shorts.some(sh => sh.player === p.name)) return 'short';
  // concentration check: sum share value by sector
  // cash check: p.cash < 1000
  // ipo heavy: count IPO shares vs total shares
  return 'balanced';
}
```

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

Consider adding tests for `portfolioRisk()`:
- Player with loan → `'leveraged'`
- Player with loan + short → `'high'`
- Player with cash < $1,000 → `'lowcash'`

---

## Completion Checklist

- [ ] `portfolioRisk()` helper added to `scoringEngine.ts`
- [ ] `RiskBadge` component created (or inline in Portfolio)
- [ ] Badge shown in Portfolio panel
- [ ] Correct badge for: no risk, leveraged, short, high risk, concentrated, low cash, IPO heavy
- [ ] Severity priority order correct (HIGH RISK beats LEVERAGED)
- [ ] No game logic affected
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
