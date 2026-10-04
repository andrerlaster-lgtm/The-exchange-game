# THE EXCHANGE — "Companies as Players" Concept

## Overview

The core pivot: instead of players being generic traders on a static market, **each player owns and IS a company**. Other players can buy into your company and profit or lose based on your decisions and performance. This turns the game from "everyone trades on the market" into "everyone trades on each other."

This document also folds in two smaller rules discussed alongside the pivot: insider trading and a trading halt on repeated doubles.

---

## 1. Player-Owned Companies

- Each player is tied to one company (`companyCode` on the player).
- Remaining companies on the board (not owned by a player) stay as **neutral/NPC stocks**, still tradeable using the existing 12-step price ladder — unchanged.
- Player-owned companies use a **new pricing model** (below) instead of the ladder.

---

## 2. Share Pricing for Player-Owned Companies

- Each player-owned company has a fixed number of shares outstanding (e.g. 100 — clean percentage math, tune later).
- **Price per share = Owner's Net Value ÷ Shares Outstanding.**
- Any change to the owner's net value instantly revalues all outstanding shares of their company proportionally.
  - Example: Player 1 has $10,000 net value. Player 2 owns 50% of P1's shares. P1 makes a move that loses $1,000 (10% of net value). Every share P2 holds in P1's company drops 10% in value — not just P1's remaining shares.
- This is how profit is realized: buy into a player's company when they're doing poorly (undervalued), sell when they're doing well ("get bagged" on the way up, in reverse — buy low on someone struggling, sell once they recover).
- Buying into another player's company is also a natural diversification move, since their company likely represents a mixed portfolio itself.

### The circular dependency problem (needs a decision)

If "net value" includes shares you hold in *other players'* companies, and their price depends on *their* net value (which may include shares in yours), you get a circular pricing loop — risk of double-counted swings or infinite update chains.

**Proposed fix — split net value into two totals:**
- **Score / win-condition net value** (unchanged): cash + all holdings (including cross-holdings in other players' companies) + everything. This is what decides the winner at Market Close.
- **Pricing net value** (new, narrower): only cash + loans + your stake in NPC/neutral companies. Cross-holdings in other *player*-owned companies do NOT feed back into your own share price — even though they still count toward your final score.

This breaks the cycle: your price only reacts to things fully within your control, never to another player's swings bouncing back at you.

*(Still open: does this split feel right, or is there a different way you want to handle the circularity?)*

---

## 3. Ownership Floor

- An owner can never hold less than **50%** of their own company's shares.
- Caps the tradeable float at 50% — no player can be fully "acquired" by others.

---

## 4. Selling Shares (Right of First Refusal)

When a player wants to sell shares they hold in another player's company:

1. **Offer goes to the company's owner first**, at fair (current net-value-derived) price.
2. **If the owner passes**, the seller can sell to:
   - Another player, at fair price, or
   - **The bank**, which pays a **discount** below face value.
3. **If the owner later wants to buy back shares sitting with the bank**, the bank charges a **premium** above face value.

This creates a real spread the bank profits on, and pushes players toward trading with each other rather than dumping on the bank.

---

## 5. Note: "Reinvestment Drag" — superseded

Earlier idea: a company owner's own trades in *other* companies would nudge their own price up/down (buying dips you, selling bumps you), layered on top of ladder pricing.

Under the net-value pricing model, this is no longer needed — any trade that actually changes your net value already reprices your shares automatically and more honestly. **Drop this rule** in favor of the net-value model above, unless you want to revisit it as a flavor/signal mechanic separately.

---

## 6. Other New Rules Under Discussion

### Insider Trading
Still open — a few directions floated:
- **Simple:** landing on certain spaces or drawing a rare card reveals the next price move for one stock before it happens.
- **Risk/reward:** player can choose to act on insider info, with a chance of getting "caught" (fine or skipped turn).
- Could tie in specifically to **company owners** having literal inside knowledge of their own next move — thematically strong fit with the companies-as-players pivot.

### Trading Halt on Repeated Doubles
- Track consecutive doubles rolled (`consecutiveDoubles`).
- On the 3rd consecutive double, trigger a market-wide trading halt for a set number of turns.
- Open question: market-wide (any player's doubles streak) vs. just that player's own turn — market-wide fits the "panic in the market" theme better and matches how event cards already affect the whole market.

---

## 7. Open Questions to Resolve Before Implementation

1. Circular net-value split — confirm the two-total approach, or propose an alternative.
2. Number of shares outstanding per player-owned company (100? something else?).
3. Insider trading — which version (simple reveal vs. risk/reward vs. owner-specific)?
4. Trading halt scope — market-wide vs. single-player.
5. Does a player's own company's value count toward their score directly, or only through whatever shares they personally hold (including the mandatory 50%+)?
