# THE EXCHANGE — Updated Prototype Rulebook

**Post-Audit Revision — Bucket A / B / C Decisions Incorporated**
Consolidated Rules — July 2, 2026

> **Purpose:** This rulebook incorporates every rule locked during the design audit — dividends, sector map, IPO reveal mechanics, margin system, price floor/ceiling, and all supporting decisions — before final code lock.
>
> **Status:** This rulebook is maintained alongside the playable prototype. The full-company landing rule and the $30,000 / $40,000 / $50,000 starting-cash choices are implemented. Items explicitly marked TBD remain subject to balance testing.

## Contents

1. Game Overview
2. Components
3. Setup
4. Board and Space Types
5. Turn Flow
6. Market Open
7. Regular Stocks
8. Dividends
9. Weak Demand
10. Sold-Out and Payout Claim
11. Selling Shares and Bank Auctions
12. Trading
13. Sector Portfolio
14. Diversified Portfolio
15. ETFs
16. IPOs
17. Margin System
18. Special Spaces
19. Price Movement
20. Endgame and Scoring
21. Standard Mode Settings
22. Code-Facing Rule Checklist
23. Open Balance Items

---

## 1. Game Overview

The Exchange is a 2-6 player stock-market board game where players move around a 36-space board, buy shares, build portfolios, trade with each other, react to market events, and compete to finish with the highest final portfolio value.

The game should feel like a board-game version of investing: players are trying to buy into companies, control valuable spaces, complete sectors, diversify across the market, and profit when other players land on spaces they have claimed.

**Core promise**
- Every landing should matter.
- Stocks should feel limited and worth racing for.
- Payout Claims create rent-like pressure only after a stock has sold out.
- Sector Portfolio rewards concentration; Diversified Portfolio rewards spreading across sectors.
- Trading is powerful but must remain controlled and app-enforceable.

**Winning**

The setup screen offers two winning-score modes:

- **Standard / Net Worth Mode:** the player with the highest Final Portfolio Value wins.
- **Gain/Loss Mode:** the player with the highest Market Gain wins. Market Gain = Final Portfolio Value − Starting Cash − base Salary Collected. Removing salary keeps automatic lap income from inflating investment performance.

**Final Portfolio Value**
- Cash on hand
- Plus the current market value of all owned regular stock shares
- Plus the current value of owned IPO holdings, plus owned ETF holdings valued at their fixed purchase/card price (see Section 15; ETFs have no price ladder)
- Minus outstanding Margin balance (see Section 17, Margin System)
- Plus any final bonuses specifically granted by cards or variant rules

## 2. Components

- 1 game board with 36 spaces
- 22 regular stock spaces/cards, organized into 6 sectors (see Section 13)
- 4 ETF spaces/cards
- 2 IPO spaces and 4 IPO cards (shared reveal queue — see Section 16)
- 1 The Fed space and Fed cards
- 1 Bull Run space and 1 Bear Run space
- 1 Market Event space and the combined Market Event deck
- 1 Investor Day space
- 1 Portfolio Tax space
- 1 Audit Notice space
- 1 Market Open corner/space
- Player tokens: Bull, Bear, Money Bill, Laptop, Calculator, Vault
- Cash or digital bank balances
- Share supply trackers
- Price ladder / market price tracker, including floor and ceiling markers
- Weak Demand markers
- Payout Claim cards or markers
- Sector Portfolio badges (6 sectors)
- Diversified Portfolio and Broad Market Portfolio badges
- Bank Auction Pool tracker for sold-back shares
- Margin tracker (outstanding balance per player, $4,000 cap)

## 3. Setup

- Each player chooses a token and receives the starting cash selected at setup: $30,000, $40,000, or $50,000. The default is $30,000.
- Place all player tokens on Market Open.
- Set each regular stock to its starting market price using the app price ladder or printed stock card. No stock may start above the $5,000 ceiling or below the $100 floor.
- Place 11 market shares in supply for each regular stock.
- Shuffle the combined Market Event deck and The Fed deck separately. Shuffle the 4 IPO cards into their own shared reveal queue.
- Set all 4 IPO cards face down in a single shared reveal queue (see Section 16). None are available for purchase until revealed.
- Set up ETF spaces/cards according to current app data.
- Place Payout Claim cards/markers, Weak Demand markers, Sector Portfolio badges, and Diversification badges near the bank.
- Determine the first player by the app, by highest dice roll, or by table agreement.

**Note:** Starting cash, salary amount, exact price ladder values, dividend per-share amount, and any fixed ETF purchase prices should use the current app defaults until playtesting locks the final values.

## 4. Board and Space Types

The board has 36 spaces. The current rule direction preserves the board count and does not bring back Short Sell.

| Space type | Count | Purpose |
|---|---|---|
| Regular stock | 22 | Buy shares, build ownership, sell out companies, create Payout Claims, earn dividends |
| ETF | 4 | Diversification-style investment route that pays at Market Open |
| The Fed | 1 | Draw and resolve a Fed card; space 7 |
| Bull Run | 1 | Resolve the global Bull Run and every player's locked stance; space 16 |
| Bear Run | 1 | Resolve the global Bear Run and every player's locked stance; space 26 |
| IPO | 2 | Reveal and access IPO opportunities (shared queue of 4) |
| Market Event | 1 | Dedicated Market Event space; space 19 |
| Market Open | 1 | Payday only, then Market Open Trading Window |
| Portfolio Tax | 1 | Penalty space based on net worth |
| Investor Day | 1 | Choose Company Growth (+1 step to an eligible owned company, or $500 if none) or Insider Information (preview the next Market Event without drawing it) |
| Audit Notice | 1 | Penalty space with extra cost if Margin balance is outstanding |

**Board rule locks**
- Market Open is payday only and does not trigger a Market Event.
- Space 19 is the dedicated Market Event space.
- Short Sell is not part of the standard game flow.
- The 3D board is a renderer; the rules engine remains the source of truth.

## 5. Turn Flow

Each turn follows the same order unless a card or special rule changes it.

1. Roll dice.
2. Move the active player token.
3. If the player passes or lands on Market Open, resolve Market Open before continuing the landing result as applicable.
4. Resolve the landed space completely.
5. Resolve any required payment, buy/skip choice, Weak Demand effect, auction, card, or special-space effect.
   - 5a. If the landed space is an IPO space, only the player who landed there may buy IPO shares. A new reveal offers that IPO to the landing player; after all 4 IPOs are revealed, the landing player may choose any revealed IPO with available shares.
6. Open the active player's Trade Step.
7. During the Trade Step, the active player (and any other player) may propose P2P trades, and the active player may sell up to half of each regular-stock holding back to the bank, rounded down (see Section 11).
8. Resolve accepted trades and bank sales immediately.
9. End the Trade Step. All unresolved offers expire.
10. If the player's first roll was doubles, that player takes exactly 1 bonus roll after the landing and all required actions are fully resolved.
    - Doubles rolled on the bonus roll do not earn another roll.
11. Pass play to the next player.

## 6. Market Open

Market Open is the payday space. It is not a Market Event trigger.

**Market Open payout order**
1. Pay salary / Market Open income using the current app default amount.
2. Pay Dividends for all eligible regular stock and IPO holdings (see Section 8).
3. Apply Controller dividend multipliers where applicable (2x).
4. Pay ETF payouts.
5. Pay Diversified Portfolio or Broad Market Portfolio bonus, if earned.
6. Resolve Margin repayment: any player with an outstanding Margin balance repays half of it (see Section 17).

**Market Open Trading Window**

After all Market Open payouts are complete, open a Market Open Trading Window for all players.

During the Market Open Trading Window, all players may:
- Make player-to-player trades involving cash and owned shares.
- Bid on any bank-held shares that are available for auction.

During the Market Open Trading Window, players may not:
- Directly buy fresh shares from normal market supply.
- Sell shares back to the bank — bank sell-back is a Trade Step-only action (see Section 11).
- Make future promises, loans, or conditional deals.
- Leave unresolved offers open after the active player closes the window.

Fresh shares can only be bought by landing on that stock space, winning an approved auction, or resolving a card/effect that specifically allows it.

## 7. Regular Stocks

| Rule item | Current rule |
|---|---|
| Regular stock supply | 11 total market shares per regular stock |
| Market buy rule | Buy the entire untouched company at its fixed tier price or skip |
| Company acquisition tiers | Starter $5,000; Growth $7,500; Premium $10,000 |
| Tier opening share prices | Starter $500; Growth $750; Premium $1,000 per share |
| Market sell cap | Sell up to half of each regular-stock holding per turn, rounded down |
| Control threshold | 6+ shares = Controller |
| Ownership tiers | 1-2 Stock Owner; 3-5 Shareholder; 6+ Controller |
| P2P pricing | Any agreed price; private trades do not move market price |
| Price floor | $100 hard floor — price cannot move below this |
| Price ceiling | $5,000 — reaching this price triggers a global Market Event card |

**Landing on an untouched regular company**
- The active player may buy the entire company or skip. Partial purchases from normal market supply are not allowed.
- A full-company purchase uses the company's printed acquisition tier: Starter $5,000, Growth $7,500, or Premium $10,000. Their tier-aligned opening share prices are $500, $750, and $1,000 respectively, keeping the acquired portfolio value close to the cash paid.
- The buyer receives all 11 shares, normal market supply becomes 0, the company becomes permanently Sold Out, and the buyer receives its Payout Claim.
- The purchase does not move the live per-share market price.
- If the player explicitly skips, add a Weak Demand marker.
- Once another player owns the company, landing there does not open a normal buy step. Resolve the Sold-Out Payout Claim instead.

**Sold-Out landing payout**

| Ownership status | Shares owned | Base Sold-Out landing payout |
|---|---|---|
| Stock Owner | 1-2 | $500 |
| Shareholder | 3-5 | $1,000 |
| Controller | 6+ | $2,000 |

## 8. Dividends

Dividends are a passive Market Open income stream, separate from and stacking with the Payout Claim system. Where Payout Claim rewards scarcity (only active after sellout), Dividends reward position size continuously, whether or not a stock has sold out.

**Regular stock dividends**
- Every regular stock pays a flat per-share dividend at every Market Open, to every player who holds shares of it — Always On, no Sold-Out requirement.
- Controllers (6+ shares of that stock) earn 2x the per-share dividend rate on that stock, same multiplier structure as IPO Controllers.
- Exact per-share dividend amount: TBD during balance testing (see Section 22, Open Balance Items).

**IPO dividends**
- IPO Controllers (3+ shares of that IPO) earn 2x dividend on that IPO, plus the Controller badge (already locked, see Section 16).
- Base IPO per-share dividend amount: TBD during balance testing.

**Note:** Dividends and Payout Claim are two separate, stacking income layers on the same stock: Dividends reward raw position size every Market Open; Payout Claim rewards being the top owner of a Sold-Out stock whenever anyone lands on it.

## 9. Weak Demand

Weak Demand makes ignored, untouched companies lose value. Ownership never grants automatic price protection.

**Weak Demand rule**
- Each regular stock can hold up to 2 Weak Demand markers.
- When a player lands on an untouched regular stock and explicitly skips the purchase, add 1 Weak Demand marker.
- When a stock reaches 2 Weak Demand markers, move its market price down 1 step immediately and clear the markers, unless the stock is already at the $100 floor.
- Buying the full company clears all Weak Demand markers on it.
- Share count, Controller status, Sector Portfolio, and Diversified Portfolio never protect a price automatically.
- Sold-Out spaces no longer offer a buy/skip choice, so they do not gain new Weak Demand markers; their prices can still fall through Market Events and qualifying bank sales.

## 10. Sold-Out and Payout Claim

Sold-Out status is the mid-game claim system. It turns limited share supply into board-space pressure.

**Permanent Sold-Out rule**
- A regular stock becomes Sold Out when all 11 normal market shares have been bought for the first time.
- Once a regular stock becomes Sold Out, it stays Sold Out for the rest of the game.
- Sold-Out status does not disappear if a player later sells shares to the bank.
- Sold-back shares do not return to normal market supply.

**Sellout trigger**
- Buying an untouched company instantly makes it Sold Out without moving its market price.
- The buyer initially holds all 11 shares and therefore receives the Payout Claim.

**Payout Claim rule**
- When a regular stock becomes Sold Out, the player with the most shares receives the Payout Claim for that stock.
- Place that player's Payout Claim marker on the board space and show that player's name on the stock card.
- When another player lands on that Sold-Out stock, they pay the listed landing payout to the Payout Claim holder.
- If the landing player holds the Payout Claim, no payment is made.
- If there is a tie for most shares, the stock is Contested and no landing payment is made until one player becomes the clear top owner.

**Payout Claim transfer timing**
- Outside of an active auction, the Payout Claim transfers immediately whenever an ownership change (bank sell-back or P2P trade) makes a different player the top owner.
- During an active Bank Auction Pool auction for that stock, the Payout Claim holder is frozen — it does not change bid-by-bid.
- Once the auction closes, ownership is recalculated once and the Payout Claim transfers if the winning bidder is now the top owner.

**Board/card display**

| Display | Meaning |
|---|---|
| Sold Out | No normal market shares remain; stock has become a claimable space |
| Pay [Player]: $X | Landing payment goes to the current Payout Claim holder |
| Contested | Tied top ownership; no landing payment until resolved |
| Player-color ring/token | Visual marker showing who currently holds the Payout Claim |

## 11. Selling Shares and Bank Auctions

Selling back to the bank is allowed, but it must not reopen Sold-Out stocks or let one player quietly buy sold-back shares before everyone else has a chance.

**Sell Back to Bank**
- Selling to the bank is available to the active player after rolling and resolving required actions. It is not available during the Market Open Trading Window.
- During one turn, a player may sell up to half of each regular-stock holding back to the bank, rounded down. Multiple sales of the same company share that cumulative limit.
- The seller receives one price step below the current market price for each share sold.
- If the stock is already at the lowest price step ($100 floor), use the floor price.
- Selling 3 or more shares in one bank-sale action moves that stock down one price step, unless it is already at the $100 floor. Selling 1 or 2 shares does not move its price.
- Every regular stock and IPO purchase records actual cost basis. A full-company purchase uses its fixed $5,000 / $7,500 / $10,000 buyout price as the total basis for all 11 shares. IPOs, auctions, and private trades use the actual amount paid.
- **Unrealized stock gain/loss** = current market value of shares still held − their remaining cost basis.
- When shares are sold, their proportional average basis is removed from the holding. **Realized gain/loss** = sale proceeds − removed basis.
- Total Stock G/L = Realized Stock G/L + Unrealized Stock G/L. Dividends, Payout Claims, salary, taxes, and bonuses are not included in Stock G/L; they remain visible through Market Gain and the cash logs.
- Sold-back shares go to the Bank Auction Pool for that company.
- Sold-back shares do not return to normal market supply and cannot be bought directly from the board.

**Bank Auction Pool**
- Shares sold back to the bank are tracked in that company's Bank Auction Pool.
- A bank-held share may only re-enter the game through an auction open to all players, held during the Market Open Trading Window.
- Bidding starts at one price step below the current market price unless a card/effect says otherwise.
- Any player may bid, including the player who sold the share.
- The winning bidder pays the bank and receives the share.
- Auction purchases do not move the market price.
- The stock's Sold-Out status remains active. Payout Claim only changes if the auction changes who owns the most shares (see Section 10).

## 12. Trading

Trading is powerful, but it must happen in clean windows so the app can enforce the result and the turn stays readable.

**Binding Trade Window**
- Players may trade only during the active player's Trade Step, unless Market Open creates a Market Open Trading Window.
- The Trade Step begins only after the active player fully resolves the landing space and all related effects.
- During the Trade Step, any player may propose P2P trades involving cash and owned shares. Only the active player may sell shares to the bank, within the per-company half-holding limit.
- Trades can be for any agreed price: above market, below market, equal to market, or another accepted cash amount.
- All transfers must happen immediately when accepted.
- Private trades do not move market price.
- Future promises, player loans, conditional deals, and side agreements are not official trades and are not supported by the app.
- All unaccepted offers expire when the active player ends the Trade Step.
- If a trade changes Controller status, Sector Portfolio status, Diversified Portfolio status, or Payout Claim ownership, update those states immediately.

**Trading blocked while...**

| Condition | Reason |
|---|---|
| Dice are rolling or token is moving | Movement must resolve first |
| A landing choice is unresolved | Buying, skipping, or payment must resolve first |
| An auction is active | Auction must close before trades resume |
| A card effect is unresolved | Card result may change ownership, cash, or price |
| Market Open payouts are still resolving | Payout order must complete before the Market Open Trading Window |

## 13. Sector Portfolio

Sector Portfolio is the Monopoly color-group equivalent. It rewards concentration in one sector, not diversification.

**Sector map**

The 22 regular stocks are divided into 6 sectors across 3 value tiers. Low-Value sectors hold the most companies, Medium-Value sectors hold fewer, and High-Value sectors hold only 2 each.

| Sector | Tier | Spots | Color |
|---|---|---|---|
| Retail | Low | 5 | Yellow |
| Industrial | Low | 5 | Brown |
| Healthcare | Medium | 4 | Green |
| Energy | Medium | 4 | Orange |
| Tech | High | 2 | Purple |
| Finance | High | 2 | Blue |

**Sector stock names (draft)**

| Sector | Stocks |
|---|---|
| Retail | Cartwell & Co. · Fernwood Home · Loop Apparel · Kettleworth Grocers · Dashline Direct |
| Industrial | Ironclad Manufacturing · Blackridge Steel · Vantage Freight · Coreworks Machinery · Summit Construction |
| Healthcare | Meridian Health · Pulseline Pharma · Northstar Biotech · Careform Medical |
| Energy | Solvane Energy · Drexler Oil & Gas · Gridpoint Utilities · Ashcombe Resources |
| Tech | Nexora Systems · Vireon Technologies |
| Finance | Sterling Capital · Parkway Financial Group |

**Note:** Stock names are a fresh draft pending confirmation against any existing app/board names. *(These do not match the current app's 22 stocks/8 sectors — see the status note at the top of this document.)*

**Sector Portfolio rule**
- A player completes a sector by owning at least 1 regular share in every regular company of that sector.
- When completed, that player receives a Sector Portfolio badge for that sector.
- IPO stocks and ETFs do not count toward Sector Portfolio unless a future card/rule says otherwise.
- If the player no longer owns at least 1 share in every regular company of that sector, the Sector Portfolio bonus ends immediately.

**Payout Claim status**

| Ownership tier | Normal payout | Payout with Sector Portfolio |
|---|---|---|
| Stock Owner | $500 | $750 |
| Shareholder | $1,000 | $1,500 |
| Controller | $2,000 | $3,000 |

The Sector Portfolio bonus only affects Sold-Out Payout Claim earnings in that sector. It does not change share count, control threshold, market price, or dividend multiplier unless a card specifically says so.

## 14. Diversified Portfolio

Diversified Portfolio is a separate stock-market-style feature. It rewards spreading risk across different sectors.

| Badge | Requirement | Market Open bonus |
|---|---|---|
| Diversified Portfolio | Own at least 1 regular share in 3 different sectors | $300 |
| Broad Market Portfolio | Own at least 1 regular share in 6 different sectors | $600 instead of $300 |

**Diversification rules**
- Only regular stock shares count toward Diversified Portfolio and Broad Market Portfolio by default.
- IPOs and ETFs do not count unless a specific rule/card says otherwise.
- Diversification pays only the listed Market Open cash bonus. It does not automatically protect any company from price movement.
- Only the number of distinct regular-stock sectors matters. Share quantity and Margin balance do not change Diversified status.
- A player receives only the highest diversification bonus they qualify for at Market Open.
- Sector Portfolio and Diversified Portfolio are separate because they reward different strategies.

## 15. ETFs

ETFs are a diversification route and Market Open income source. They should not duplicate the regular stock Payout Claim system.

**ETF rules**
- There are 4 ETF spaces/cards in the current board structure.
- ETFs pay at Market Open according to the current app payout table.
- ETFs do not have ownership tiers, Controllers, Sector Portfolio status, Weak Demand, or Payout Claims by default.
- ETFs may be traded during legal trading windows unless a card or app setting says otherwise.
- ETF payouts should remain clear and simple so they act as a lower-conflict strategy path.
- ETFs have no price ladder. For all net-worth calculations (Final Portfolio Value and Portfolio Tax), owned ETF holdings are valued at their fixed purchase/card price.

**ETF payout table**

Use the current app/default ETF payout table. *(Current app data: fixed purchase price $3,000/share; payout 0/$200/$500/$900/$1,200 for 0–4 total ETF shares owned at Market Open — rebalanced to hold roughly the same yield curve as the game's original $5,000/$300–$2,000 tuning.)*

## 16. IPOs

IPOs are limited new-stock opportunities. They are more volatile and have smaller supply than regular stocks.

| IPO rule item | Current rule |
|---|---|
| Total IPO companies | 4, in a single shared face-down reveal queue |
| IPO board spaces | 2 — either space can trigger the next reveal |
| IPO supply | 5 total shares per IPO company |
| IPO control threshold | 3+ shares = Controller |
| Controller benefit | 2x dividend on that IPO plus Controller badge |
| Sector/Diversification counting | Does not count by default unless a card/rule says otherwise |
| Payout Claim | Regular stocks only by default; IPO Payout Claim can be tested later if desired |

**IPO reveal mechanic**
- All 4 IPOs start face down in a single shared queue at setup — not tied to either specific board space.
- When a player lands on either IPO space, the next unrevealed IPO in the queue flips face up and becomes active.
- Once revealed, that IPO stays available for purchase at both IPO spaces for the rest of the game.
- Only the player who landed on the IPO space may buy during that landing. No other player receives a buy-in turn.
- The landing player may buy a maximum of 2 IPO shares during that landing.
- After the reveal turn, any player landing on either IPO space may buy available shares of any already-revealed IPO normally.
- Once all 4 IPOs are revealed, landing on either IPO space simply allows buying from whichever IPOs are already out — no further reveals occur.

**IPO Pricing**

All 4 IPOs start at a fixed price of $3,000 per share. There is no tiered starting-price structure; every IPO enters the game at the same price point and differentiates only through reveal order and Market Event effects.

**IPO Price Movement**
- IPO share prices do not move from buying or selling. IPO prices change only through Market Event cards and other card effects.
- IPOs are more exposed to market volatility than regular stocks: their value is driven by Market Events rather than by buy/sell price steps.
- The $100 floor and $5,000 ceiling still apply to IPO prices.
- IPO prices do not move before being revealed.

**Confirmed**
- IPO shares count toward final portfolio value.
- IPO shares do not count toward Diversified Portfolio bonus.

## 17. Margin System

Margin (renamed from Loans) is an advanced-mode borrowing system. It is off by default in standard mode (see Section 21).

**Margin rules**
- Maximum outstanding Margin balance: $4,000 per player.
- A player may draw Margin from the bank up to the $4,000 cap, subject to app/table rules for when Margin may be taken.
- Repayment: each time a player passes or lands on Market Open, they must repay half of their current outstanding Margin balance.
- Default consequence: if a player cannot make a required Margin repayment, the bank forces a sale of that player's shares to cover the amount owed, and the player pays an additional penalty fee.
- Penalty fee amount: TBD during balance testing.
- Outstanding Margin balance is subtracted from Final Portfolio Value at game end (see Section 1).

**Note:** Margin is fully specified but remains an advanced-mode toggle — off by default in the standard game (see Section 21, Standard Mode Settings).

**Insolvency and Forced Sale (standard mode)**

The Exchange is a net-worth race, not a bankruptcy-elimination game (see Section 20). This rule covers what happens when a player owes a required cash payment — Portfolio Tax, Audit Notice fee, a Sold-Out landing payout to a Payout Claim holder, or a card-mandated payment — and does not have enough cash on hand, whether or not Margin is in use.

- If a player cannot cover a required cash payment, the bank forces the sale of that player's regular stock shares, at the normal sell-back price (Section 11: one price step below current market, or the $100 floor price), until the payment is covered.
- The player chooses which shares to sell and in what order, continuing until either the payment is fully covered or the player has no regular stock shares left to sell.
- Forced sales follow all normal sell-back mechanics: they move market price down one step per sale (unless at the floor), and go into that stock's Bank Auction Pool. A forced sale can change Payout Claim ownership exactly as a voluntary sell-back would (see Section 10).
- IPO and ETF holdings cannot be force-sold under this rule, since they have no defined sell-back mechanic.
- If forced-selling all available regular stock shares still does not cover the full payment, the player pays cash down to $0 and the remaining shortfall is waived. Cash never goes negative, and the player is not eliminated.
- Bankruptcy/elimination remains an optional variant only (see Section 21) and is unaffected by this rule.

## 18. Special Spaces

| Space | Rule |
|---|---|
| Market Open | Payday only, then Market Open Trading Window. Does not draw Market Event. |
| Market Event — space 19 | Draw and resolve 1 Market Event card. Also triggered automatically if any stock reaches the $5,000 price ceiling. |
| The Fed | Draw and resolve 1 Fed card. |
| Bull Run — space 16 | Resolve the Bull Run stock movements and every player's current stance, then reset all players to Balanced. |
| Bear Run — space 26 | Resolve the Bear Run stock movements and every player's current stance, then reset all players to Balanced. Circuit Breaker may protect one affected owned company. |
| IPO | Resolve IPO reveal/purchase per Section 16. |
| Investor Day — space 31 | Choose Company Growth or Insider Information. Company Growth moves 1 owned regular company below the $5,000 ceiling up 1 price step; reaching $5,000 triggers a Market Event. If none qualifies, collect $500. Insider Information reveals the title and effect of the next Market Event without drawing, resolving, or removing that card from the top of the deck. |
| Portfolio Tax | Player pays 10% of current net worth. Net worth uses the same formula as Final Portfolio Value (see Section 1): cash + current value of regular stock shares + IPO holdings + ETF holdings - outstanding Margin balance. ETF holdings are valued at their fixed purchase/card price (see Section 15). |
| Audit Notice | Player pays $500. If they have any outstanding Margin balance, pay an extra $250. In standard mode, with Margin off by default, this extra fee is normally dormant. |

**Investor Day rollback note:** The previous rule is retained here in case playtesting favors it: choose 1 regular company you own below the $5,000 ceiling and move it up 1 price step; if no owned company can rise, automatically collect $500. This version had no Insider Information choice.

**Bull Run, Bear Run, and Market Stance**

Each player holds one visible Market Stance. The latest qualifying action replaces the previous stance:

- Buying a regular company or taking Margin sets **Bullish**.
- Selling 3 or more shares in one bank sale or private trade, or opening a Short, sets **Bearish**.
- Players begin **Balanced**. After either Run resolves, every player resets to Balanced.

| Player stance | Bull Run cash | Bear Run cash |
|---|---:|---:|
| Bullish | +$1,500 | −$1,500 |
| Balanced | +$500 | −$500 |
| Bearish | −$750 | +$1,500 |

Required cash losses stop at $0 cash; a Run does not open Insolvency. Resolve stock and cash effects when a player lands on the corresponding Run space:

| Investment | Bull Run | Bear Run |
|---|---:|---:|
| High-Risk regular stock | +2 price steps | −2 price steps |
| Medium-Risk regular stock | +1 price step | −1 price step |
| Low-Risk regular stock | No change | +1 price step |
| Revealed IPO | +1 price step | −1 price step |
| ETF | No change | No change |

Bull Run and Bear Run are dedicated board spaces, not cards in the Market Event deck. Dividends, share counts, and Payout Claim tiers do not change directly. Circuit Breaker may protect one owned company from a Bear Run drop. Run-driven moves stop at the price-track floor or ceiling and do not trigger another Market Event.

**Circuit Breaker — Market Event hold card**
- The former After-Hours cards are part of the combined Market Event deck; there is no separate After-Hours deck or board space.
- There is 1 Circuit Breaker card in the Market Event deck.
- When drawn, the player keeps it; it remains out of the deck until played.
- When any negative Market Event or Bear Run would lower the price of a company that player owns, pause before applying its price effect.
- The holder may play Circuit Breaker to protect 1 affected company they own from that effect's entire downward move, or pass and keep it for later.
- Playing it is optional and single-use. After play, discard it into the Market Event discard pile.
- It does not stop Weak Demand, bank-sale price movement, or Fed cards.

## 19. Price Movement

The price ladder is the source of truth for each stock's market value. Exact ladder values come from current app data. All price movement is bounded by a $100 hard floor and a $5,000 ceiling.

| Event | Market price effect |
|---|---|
| Buy an untouched company | No market-price movement; the fixed tier price is paid instead |
| Sell shares to bank (Trade Step only) | Seller is paid 1 step below market; price moves down 1 step after the sell action, unless already at the $100 floor |
| Private player-to-player trade | No market price movement |
| Auction purchase | No market price movement unless a card says otherwise |
| Weak Demand reaches 2 markers | Price moves down 1 step and markers clear, unless already at the $100 floor |
| Stock becomes Sold Out | This happens as part of the full-company purchase; no price increase is applied |
| Stock reaches $5,000 ceiling | Price movement stops; triggers a global Market Event card |
| Card effect | Follow the card text; no portfolio or share-count protection applies automatically |

**Per-action price movement:** A full-company purchase does not move the share price. A qualifying bank sell-back is one market action regardless of the number of shares sold in that action.

## 20. Endgame and Scoring

The default game is a net-worth race, not a bankruptcy-elimination game.

**Game end**
- The game ends when the Market Close condition is reached.
- Market Close mode is set by an app toggle chosen before the game starts: Card mode (Market Close is triggered by drawing the Market Close card) or Rounds mode (the game ends after a fixed number of rounds set in the app).
- Extended Hours: if a player holds an Extended Hours card and legally plays it before Market Close triggers, the game is extended by 1 additional round — every player takes exactly 1 more turn — before Market Close finally ends the game. This rule is confirmed active.

**Final scoring**
- Add each player's cash.
- Add the current market value of all owned regular stocks and IPOs, plus owned ETF holdings valued at their fixed purchase/card price (ETFs have no price ladder — see Section 15).
- Subtract outstanding Margin balance, if the advanced Margin mode is on.
- Do not add separate value for Payout Claims, Sector Portfolio badges, or Controller badges unless a specific card/rule grants an endgame bonus.
- In Net Worth Mode, the highest Final Portfolio Value wins.
- In Gain/Loss Mode, subtract Starting Cash and base Salary Collected from Final Portfolio Value. The highest resulting Market Gain wins. Other earned income and penalties remain in the result because they reflect game decisions and consequences.
- Each final result also displays realized, unrealized, and total Stock G/L from the cost-basis ledger.

## 21. Standard Mode Settings

| Setting | Standard mode |
|---|---|
| Starting cash | $30,000 default; setup choices are $30,000, $40,000, or $50,000 |
| Winning score | Net Worth by default; optional Gain/Loss Mode ranks salary-adjusted Market Gain |
| Margin trading | Off by default |
| Weak Demand | On; 2 explicit skips drop an untouched company's price 1 step; no ownership protection |
| Short Sell | Off / removed from standard game flow |
| Direct rent before sellout | Off; landing payments start only after Sold-Out status |
| Regular stock dividends | On — Always On, flat per-share, 2x Controller multiplier |
| Payout Claim | On for regular stocks after Sold Out |
| Sector Portfolio | On |
| Diversified Portfolio | On |
| Market Open Trading Window | On |
| Sell-to-bank window | Trade Step only (not Market Open) |
| Price floor / ceiling | On — $100 floor / $5,000 ceiling |
| Extended Hours | On — confirmed active |
| Investor Day | Space 31; choose Company Growth (+1 eligible owned company, or $500 if none) or Insider Information (preview next Market Event) |
| Market Close mode | App toggle: Card mode or Rounds mode, chosen pre-game |
| Last Trader Standing / bankruptcy elimination | Optional variant only, not default |

## 22. Code-Facing Rule Checklist

Use this checklist when sending the rules to code.

| Area | Implementation requirement |
|---|---|
| Constants | Regular stock supply = 11; a normal market purchase requires all 11 shares; fixed acquisition tiers = $5,000 / $7,500 / $10,000; regular control = 6; IPO supply = 5; IPO control = 3; a player may sell up to half their shares in one bank sale; price floor = $100; price ceiling = $5,000; Margin cap = $4,000 |
| Derived state | Ownership tier, Controller, Sector Portfolio, Diversified Portfolio, Payout Claim, Contested state, Sold-Out state, Margin balance, Circuit Breaker holder, remaining stock cost basis, realized/unrealized Stock G/L, salary-adjusted Market Gain |
| Stock landing | If untouched, offer a full 11-share company buyout at its fixed tier price or skip. If already owned/Sold Out, do not open a normal buy step; resolve the Payout Claim payment, with no payment when the owner lands on their own company |
| Sellout trigger | On the full-company buy: mark Sold Out, assign the buyer the Payout Claim, and leave the share price unchanged |
| Sell-back | Trade Step action only; pay seller 1 step below market (or floor), move price down 1 step (unless at floor), put shares into Bank Auction Pool, do not reopen normal supply |
| Auctions | Auction pool shares only, held during Market Open Trading Window; all players may bid; winner pays bank; auction purchase does not move price; Payout Claim frozen until auction closes, then recalculated once |
| Trading | Trade Step: P2P trades and bank sell-back both allowed. Market Open Trading Window: P2P trades and auction bidding only, no bank sell-back. Offers expire on window close |
| Gain/Loss accounting | Purchases add actual cost basis; sales remove proportional average basis and record proceeds minus basis as realized G/L; current value minus remaining basis is unrealized G/L |
| Dividends | Pay flat per-share dividend on every regular stock and revealed IPO at every Market Open; apply 2x multiplier for Controllers; Always On, independent of Sold-Out status |
| IPO reveal | Single shared 4-IPO queue; landing on either IPO space reveals the next unrevealed IPO; only the landing player may buy, up to 2 shares |
| Margin | Off by default; when on, enforce $4,000 cap, half-balance repayment on Market Open pass or landing, forced sell + penalty fee on default |
| Insolvency | Standard mode: if a player can't cover a required payment, force-sell regular stock only (not IPO/ETF) at sell-back price until covered or shares exhausted; unpaid shortfall after that is waived, cash floors at $0, no elimination |
| Market Open | Pay salary, dividends, ETF payouts, diversification bonuses, resolve Margin repayment, then open Market Open Trading Window |
| Circuit Breaker | One held Market Event card; on a later negative Market Event or Bear Run, holder may protect 1 affected owned company from that effect's entire downward move, then discard it |
| Investor Day | Space 31; choose Company Growth (+1 eligible owned regular company, or $500 if none) or Insider Information (preview the next Market Event; card stays on top) |
| UI | Show Sold Out, Payout Claim holder, landing payout, Contested status, sector progress, diversification badge, held Circuit Breaker, auction pool count, dividend income per Market Open, Margin balance, per-holding basis and unrealized G/L, total realized/unrealized Stock G/L, Market Gain and salary excluded |
| Logs | Separate bank payout, player-paid payout, private trade, full-company buy, bank sell-back, Weak Demand, auction sale, Payout Claim transfer, dividend payout, Margin draw/repay |

## 23. Open Balance Items

- Salary / base Market Open income amount
- Exact price ladder values
- Regular stock per-share dividend amount
- IPO per-share dividend amount
- Final ETF payout table
- Margin default penalty fee amount
- Whether declined-purchase auctions should be activated or kept out of the standard rule set
- Exact Market Close trigger and deck placement (Card mode) and round count (Rounds mode)
- Final confirmation of stock names against existing app/board data, if any exist
- Confirm Extended Hours round count (currently locked at 1 additional round) during playtesting

*End of updated prototype rulebook.*
