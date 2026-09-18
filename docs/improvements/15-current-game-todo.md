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

## Next priorities

### 1. Make the rules match the game

- [ ] **Update the rulebook.** It is still behind the code in several important places:
  - Market Meter and its round-end sector movement
  - Market Conditions
  - Sector Control rent, Payout Claim price multipliers, and shareholder discounts
  - ETF landing fees, ETF income, and all-four-funds bonus
  - Player-to-player Payout Claim loans
  - First-lap grace on landing payments
  - Current dividend multiplier, live company buyout cost, ETF payout table, and eight sectors

### 2. Improve player understanding

- [ ] **Add a short in-game explanation of stock-price movement.** Cover Market Meter, Market Events/Fed cards, Bull/Bear Runs, Weak Demand, Strong Demand, and Payout Claims.
- [ ] **Make the Market Meter result even easier to spot on the board** if playtesting shows players still miss it.
- [ ] **Explain Market Open income in one compact place:** salary, dividends, ETFs, bonuses, recovery bonus, then possible margin payment.

### 3. Decisions needed before changing balance

- [ ] **Payout Claim amounts:** decide whether stacked Sector Control, price multipliers, and sector rent should remain as they are or have a cap.
- [ ] **Stock risk and dividends:** decide whether low-risk companies should have lower dividends, or high-risk companies should receive stronger upside.
- [ ] **Player-loan interest:** decide whether the d6 rate should matter at small loan sizes; if yes, revise the minimum/rounding rule.
- [ ] **Sold-Out ownership tiers and Bull/Bear Run payouts:** decide whether partial-owner Payout Claim tiers should be more common and whether Runs should create less automatic bank money.

### 4. Remove or finish incomplete features

- [ ] **Short Selling:** either make the setup option fully playable or remove the toggle and unused code/UI.
- [ ] **Portfolio screen on laptops:** make the right column easier to use at 1366×768, likely with collapsible sections or a different layout.
- [ ] **Clean up old code and tests:**
  - Remove or replace unused fixed company-buyout constants.
  - Use one shared tax-rate constant instead of repeated `10%` values.
  - Remove unreachable card-effect cases if they will not be used.
  - Make `operatingNetWorth` take a player index instead of searching for the player object.
- [ ] **Add a direct automated test for share-for-share trade cost basis.**

## Completed work log

| Date | Change | Commit |
|---|---|---|
| 2026-09-18 | Rotating Market Conditions | `b8fc44c` |
| 2026-09-18 | Market Meter sector-move explanation | `5f77a51` |
| 2026-09-18 | Market Open salary increased to $2,000 / $4,000 | `b5d45f0` |

## Original audit

The original **THE EXCHANGE Deep Audit (2D only)** is the source document for
this checklist. Keep it outside this list as a historical snapshot; this file
is the live plan for the current version of the game.
