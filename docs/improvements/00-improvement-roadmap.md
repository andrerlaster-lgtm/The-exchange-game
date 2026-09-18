# THE EXCHANGE — Improvement Roadmap

> **Current working checklist:** see [15-current-game-todo.md](15-current-game-todo.md) for the reconciled Deep Audit follow-up list.

## Development Order

| # | Improvement | Phase | Priority | Status |
|---|-------------|-------|----------|--------|
| 01 | Restore Board-Game Visual Look | 1 | Highest | Done ✓ |
| 02 | Fast Prototype Cleanup (strategy-only cards) | 1 | High | Done ✓ |
| 03 | Trade Ticket Panel | 2 | High | Done ✓ |
| 04 | Stock Detail / Research Card | 2 | High | Done ✓ |
| 05 | Buying Power Display | 2 | Medium | Done ✓ |
| 06 | Trade History | 2 | Medium | Done ✓ |
| 07 | Leaderboard Upgrades | 3 | Medium | Done ✓ |
| 08 | Risk Warning System | 3 | Medium | Done ✓ |
| 09 | Game Setup Options | 4 | Later | Done ✓ |
| 10 | Strategy Mode Features | 5 | Later | Rescoped — 6 independent ideas, see [10-strategy-mode-features.md](10-strategy-mode-features.md) |
| 11 | Physical Board Game Support | 6 | Later | Saved for Later |
| 12 | Sector Control (Rent) | — | Shipped | Done ✓ |
| — | InvestaBear Help Tips / Tooltips | — | Later | Saved for Later |
| — | The Bear Exchange Help / Tutorial Section | — | Later | Saved for Later |

---

## Phase Overview

### Phase 1 — Keep the App Playable and Clean ✓ COMPLETE
- Restore board-game visual look ✓
- Remove strategy-only cards from Fast Prototype draw decks ✓

### Phase 2 — Stock Simulator Feel ✓ COMPLETE
- Trade Ticket Panel ✓
- Stock Detail / Research Card ✓
- Buying Power Display ✓
- Trade History ✓

### Phase 3 — Competition and Risk Feedback ✓ COMPLETE
- Leaderboard Upgrades ✓
- Risk Warning System ✓

### Phase 4 — Game Setup Options ✓ COMPLETE
- Customizable game setup before starting ✓

### Phase 5 — Strategy Mode Features (Rescoped 2026-09-18)
- No longer a single mode toggle — Extended Hours already shipped separately, Advanced Weak Demand was dropped (conflicts with the tuned mechanic), and the remaining 6 ideas (Market Event Pre-Trade, Same-Sector Rebalance, IPO Volatility, Known IPO Discount, Diversified salary bonus, Trading Fees) are each independent and can be picked up one at a time — see [10-strategy-mode-features.md](10-strategy-mode-features.md)

### Phase 6 — Physical Board Game Support (Saved for Later)
- Printable cards, reference sheets, player portfolio sheets

### Sector Control ✓ COMPLETE
- Own both companies in a Sector Control pair → collect rent when anyone lands on either space, stacked on top of the existing Payout Claim (see [12-sector-control.md](12-sector-control.md) for how the shipped mechanic differs from the original design)

### Saved for Later — Mascot & Help System
- InvestaBear Help Tips / Tooltips
- The Bear Exchange Help / Tutorial Section

---

## Implementation Rules

- Do not implement all improvements at once.
- Each improvement has its own file in this folder.
- Do not change engine logic unless an improvement file explicitly calls for it.
- Do not change tests unless a new component requires a new test.
- All tests must pass before marking an improvement complete.
- Run `npx tsc --noEmit`, `npm test`, and `npm run build` before closing any improvement.
