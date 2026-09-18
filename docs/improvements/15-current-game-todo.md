# THE EXCHANGE — Current Game TODO

Use this as the working checklist for game improvements. It was created from
the Deep Audit and reconciled against the current code on 2026-09-18.

## How to use this list

- Check an item only after the code, player-facing wording, and tests agree.
- Keep a completed item here for history; add the commit link when practical.
- Items marked **Decision needed** are not necessarily bugs. Decide the desired
  game rule before changing code.

## Already addressed

- [x] **Margin calls cannot permanently freeze a player with no sellable shares.**
  Any unpaid amount is moved into Outstanding Fees and the turn can continue.
- [x] **Deferred ETF landing fees pay the ETF owner.**
- [x] **Weak Demand markers persist across laps** until they resolve or the company is bought.
- [x] **Company purchase wording uses live market price**, rather than a misleading fixed tier price.
- [x] **Landing Result messages have a readable solid background.**
- [x] **ETFs can be bought by more than one player** and their landing fees use the top holder.
- [x] **Share-for-share trades use the proper cost basis.**
- [x] **Rotating Market Conditions** now add a separate temporary Market Open effect.
- [x] **Market Meter visibility:** the game explains what the Meter will do next and shows the sector/stocks from the last Meter move.
- [x] **Market Open salary:** passing pays $2,000; landing exactly pays $4,000.
- [x] **Rulebook reconciled against current code** — Market Meter and its round-end sector movement, Market Conditions (including the later per-player ownership redesign), Sector Control rent, Payout Claim price multipliers and shareholder discounts, ETF landing fees/income/all-four-funds bonus, Player Loans, first-lap grace, current dividend multiplier, live company buyout cost, ETF payout table, and the eight sectors are all documented and match the app. This was already done before this checklist was written — the "Update the rulebook" item this checklist originally listed under Next Priorities was stale the moment it was added.
- [x] **Unused fixed company-buyout constant removed** (`COMPANY_BUYOUT_BY_TIER`) — nothing read it; the live `companyBuyoutCost()` formula (11× current price) already superseded it.
- [x] **Portfolio Tax now uses the shared `TAX_RATE` constant** instead of three separate hardcoded `0.10`/`"10%"` copies.
- [x] **Unreachable `'cash'`/`'margin'` card-effect cases removed** — no card in either deck ever used them.
- [x] **`operatingNetWorth` takes a player index** instead of re-deriving it from the Player object via `indexOf` on every call (an O(n) scan inside sorts/render loops, and one that silently zeroed a foreign player's debt legs instead of erroring).
- [x] **Direct automated test for share-for-share trade cost basis** — both legs' cost basis (not just cash/share movement) are now asserted for a pure swap and a mixed cash+share offer.
- [x] **Market Meter board visibility reviewed — left as-is.** Checked live: the ticker badge, the board-centered badge (with a pulse on zone change), and the Market Intelligence explainer/last-move recap all render clearly and unobstructed. No evidence of a real gap, so no change made rather than adding visual noise speculatively; revisit if a specific playtester complaint comes in.
- [x] **Selling another holding to finance a company buyout** no longer silently burns the landing's action (previously made Buy permanently unavailable afterward even once enough cash was raised).
- [x] **Market Open income breakdown** — the report shown after passing/landing on Market Open now lists every line item (salary, dividends, ETF payout, ETF diversification bonus, Market Condition income, Diversified/Broad Market bonus, Recovery Bonus, total, margin repayment) in one place, instead of only existing as a single collapsed activity-log line.

## Next priorities

### 1. Improve player understanding

- [ ] **Add a short in-game explanation of stock-price movement.** Cover Market Meter, Market Events/Fed cards, Bull/Bear Runs, Weak Demand, Strong Demand, and Payout Claims.

### 2. Decisions needed before changing balance

- [ ] **Payout Claim amounts:** decide whether stacked Sector Control, price multipliers, and sector rent should remain as they are or have a cap.
- [ ] **Stock risk and dividends:** decide whether low-risk companies should have lower dividends, or high-risk companies should receive stronger upside.
- [ ] **Player-loan interest:** decide whether the d6 rate should matter at small loan sizes; if yes, revise the minimum/rounding rule.
- [ ] **Sold-Out ownership tiers and Bull/Bear Run payouts:** decide whether partial-owner Payout Claim tiers should be more common and whether Runs should create less automatic bank money.

### 3. Remove or finish incomplete features

- [ ] **Short Selling:** either make the setup option fully playable or remove the toggle and unused code/UI. **Decision needed.**
- [ ] **Portfolio screen on laptops:** make the right column easier to use at 1366×768, likely with collapsible sections or a different layout.

## Completed work log

| Date | Change | Commit |
|---|---|---|
| 2026-09-18 | Rotating Market Conditions | `b8fc44c` |
| 2026-09-18 | Market Meter sector-move explanation | `5f77a51` |
| 2026-09-18 | Market Open salary increased to $2,000 / $4,000 | `b5d45f0` |
| 2026-09-18 | Rulebook reconciled against current code (Market Meter, Market Conditions, Sector Control, Payout Claim math, ETFs, Player Loans, first-lap grace, dividend multiplier, buyout cost, sectors) | `d965948` |
| 2026-09-18 | Dead-code cleanup: removed `COMPANY_BUYOUT_BY_TIER` and unreachable `'cash'`/`'margin'` card-effect cases, wired `TAX_RATE` into Portfolio Tax, `operatingNetWorth` takes a player index, added direct cost-basis test for share-for-share trades | — |
| 2026-09-18 | Selling another holding to finance a company buyout no longer silently burns the landing's action (previously made Buy permanently unavailable afterward even once enough cash was raised) | — |
| 2026-09-18 | Market Open income breakdown — the passing/landing report now shows every line item (salary, dividends, ETFs, bonuses, Recovery Bonus, margin) in one place | — |

## Original audit

The original **THE EXCHANGE Deep Audit (2D only)** is the source document for
this checklist. Keep it outside this list as a historical snapshot; this file
is the live plan for the current version of the game.
