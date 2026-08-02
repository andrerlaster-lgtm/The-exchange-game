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
9. Protected Weak Demand
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

The winner is the player with the highest Final Portfolio Value when the game ends.

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
- 3 The Fed spaces and Fed cards
- 1 Market Event space and Market Event deck
- 1 After-Hours space and After-Hours deck
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
- Shuffle the Market Event, The Fed, After-Hours, and IPO decks separately.
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
| The Fed | 3 | Draw and resolve a Fed card |
| IPO | 2 | Reveal and access IPO opportunities (shared queue of 4) |
| Market Event | 1 | Dedicated Market Event space; space 19 |
| Market Open | 1 | Payday only, then Market Open Trading Window |
| Portfolio Tax | 1 | Penalty space based on net worth |
| After-Hours | 1 | Draw and resolve an After-Hours card |
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
   - 5a. If the landed space is an IPO space and this landing triggers a new IPO reveal, resolve the IPO group-buy sequence per Section 16 — the revealer gets first buy option, then all other players may buy in clockwise order — before opening the Trade Step. If the IPO space landing does not trigger a reveal (all 4 IPOs already revealed), resolve it as a normal single-player buy/skip under step 5.
6. Open the active player's Trade Step.
7. During the Trade Step, the active player (and any other player) may propose P2P trades, and any player may sell up to 2 shares back to the bank (see Section 11).
8. Resolve accepted trades and bank sales immediately.
9. End the Trade Step. All unresolved offers expire.
10. Pass play to the next player.

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
| Market buy rule | Buy the entire untouched company (all 11 shares) or skip |
| Market sell cap | Sell up to 2 shares during the seller's Trade Step |
| Control threshold | 6+ shares = Controller |
| Ownership tiers | 1-2 Stock Owner; 3-5 Shareholder; 6+ Controller |
| P2P pricing | Any agreed price; private trades do not move market price |
| Price floor | $100 hard floor — price cannot move below this |
| Price ceiling | $5,000 — reaching this price triggers a global Market Event card |

**Landing on an untouched regular company**
- The active player may buy the entire company or skip. Partial purchases from normal market supply are not allowed.
- A full-company purchase costs the current per-share market price multiplied by all 11 shares.
- The buyer receives all 11 shares, normal market supply becomes 0, the company becomes permanently Sold Out, and the buyer receives its Payout Claim.
- The purchase moves the stock price up one step according to the price ladder rules, unless the stock is already at the $5,000 ceiling.
- If the player skips, apply Protected Weak Demand if the stock is eligible.
- Once another player owns the company, landing there does not open a normal buy step. Resolve the Sold-Out Payout Claim instead.

**Sold-Out landing payout**

| Ownership status | Shares owned | Base Sold-Out landing payout |
|---|---|---|
| Stock Owner | 1-2 | $100 |
| Shareholder | 3-5 | $300 |
| Controller | 6+ | $800 |

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

## 9. Protected Weak Demand

Weak Demand exists to make ignored stocks lose value, but it cannot be weaponized against stocks where a player has already built a serious position.

**Protected Weak Demand rule**
- Each regular stock can hold up to 2 Weak Demand markers.
- When a player lands on a regular stock and buys 0 shares, add 1 Weak Demand marker only if no player owns 3 or more shares of that stock.
- When a stock reaches 2 Weak Demand markers, move its market price down 1 step immediately and clear the markers, unless the stock is already at the $100 floor.
- If any player buys shares of a stock that currently holds Weak Demand markers, remove all Weak Demand markers from that stock immediately as part of resolving the purchase.
- If any player owns 3 or more shares of that stock, the stock is protected from Weak Demand.
- Protected stocks do not gain Weak Demand markers and cannot lose market value from skipped purchases.
- If a stock becomes protected, immediately clear all Weak Demand markers from it.

## 10. Sold-Out and Payout Claim

Sold-Out status is the mid-game claim system. It turns limited share supply into board-space pressure.

**Permanent Sold-Out rule**
- A regular stock becomes Sold Out when all 11 normal market shares have been bought for the first time.
- Once a regular stock becomes Sold Out, it stays Sold Out for the rest of the game.
- Sold-Out status does not disappear if a player later sells shares to the bank.
- Sold-back shares do not return to normal market supply.

**Sellout trigger**
- Buying an untouched company instantly makes it Sold Out and moves its market price up one step.
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
- Selling to the bank is a Trade Step-only action, available to any player during their own turn's Trade Step. It is not available during the Market Open Trading Window.
- A player may sell up to 2 shares back to the bank per Trade Step.
- The seller receives one price step below the current market price for each share sold.
- If the stock is already at the lowest price step ($100 floor), use the floor price.
- Selling back to the bank moves the stock price down one step according to the price ladder rules, unless a card says otherwise, and unless the stock is already at the $100 floor.
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
- During the Trade Step, any player may propose P2P trades involving cash and owned shares, and any player may sell up to 2 shares back to the bank.
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
| Stock Owner | $100 | $300 |
| Shareholder | $300 | $500 |
| Controller | $800 | $1,200 |

The Sector Portfolio bonus only affects Sold-Out Payout Claim earnings in that sector. It does not change share count, control threshold, market price, or dividend multiplier unless a card specifically says so.

## 14. Diversified Portfolio

Diversified Portfolio is a separate stock-market-style feature. It rewards spreading risk across different sectors.

| Badge | Requirement | Market Open bonus |
|---|---|---|
| Diversified Portfolio | Own at least 1 regular share in 4 different sectors | $300 |
| Broad Market Portfolio | Own at least 1 regular share in 6 different sectors | $600 instead of $300 |

**Diversification rules**
- Only regular stock shares count toward Diversified Portfolio and Broad Market Portfolio by default.
- IPOs and ETFs do not count unless a specific rule/card says otherwise.
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
- The player who triggers the reveal gets first option to buy from that IPO.
- After the revealer decides, other players may buy in clockwise order before the next turn begins.
- Each player may buy a maximum of 2 shares per IPO per turn it is revealed.
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

*(Note: this is a significant change from the current app, which has 8 IPOs with tiered starting prices and price movement on every buy — see status note above.)*

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
| IPO | Resolve IPO reveal/purchase per Section 16. |
| After-Hours | Draw and resolve 1 After-Hours card. |
| Portfolio Tax | Player pays 10% of current net worth. Net worth uses the same formula as Final Portfolio Value (see Section 1): cash + current value of regular stock shares + IPO holdings + ETF holdings - outstanding Margin balance. ETF holdings are valued at their fixed purchase/card price (see Section 15). |
| Audit Notice | Player pays $500. If they have any outstanding Margin balance, pay an extra $250. In standard mode, with Margin off by default, this extra fee is normally dormant. |

## 19. Price Movement

The price ladder is the source of truth for each stock's market value. Exact ladder values come from current app data. All price movement is bounded by a $100 hard floor and a $5,000 ceiling.

| Event | Market price effect |
|---|---|
| Buy an untouched company | Price moves up 1 step after the full-company purchase, unless already at the $5,000 ceiling |
| Sell shares to bank (Trade Step only) | Seller is paid 1 step below market; price moves down 1 step after the sell action, unless already at the $100 floor |
| Private player-to-player trade | No market price movement |
| Auction purchase | No market price movement unless a card says otherwise |
| Weak Demand reaches 2 markers | Price moves down 1 step and markers clear, unless already at the $100 floor |
| Stock becomes Sold Out | This happens as part of the full-company purchase; no separate second price increase is applied |
| Stock reaches $5,000 ceiling | Price movement stops; triggers a global Market Event card |
| Card effect | Follow the card text |

**Per-action price movement:** A full-company purchase is one market action. A qualifying bank sell-back is also one market action regardless of the number of shares sold in that action.

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
- The highest Final Portfolio Value wins.

## 21. Standard Mode Settings

| Setting | Standard mode |
|---|---|
| Starting cash | $30,000 default; setup choices are $30,000, $40,000, or $50,000 |
| Margin trading | Off by default |
| Weak Demand | On, in Protected Weak Demand form |
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
| Market Close mode | App toggle: Card mode or Rounds mode, chosen pre-game |
| Last Trader Standing / bankruptcy elimination | Optional variant only, not default |

## 22. Code-Facing Rule Checklist

Use this checklist when sending the rules to code.

| Area | Implementation requirement |
|---|---|
| Constants | Regular stock supply = 11; a normal market purchase requires all 11 shares; regular control = 6; IPO supply = 5; IPO control = 3; market sell cap = 2; price floor = $100; price ceiling = $5,000; Margin cap = $4,000 |
| Derived state | Ownership tier, Controller, Sector Portfolio, Diversified Portfolio, Payout Claim, Contested state, Sold-Out state, Margin balance |
| Stock landing | If untouched, offer a full 11-share company buyout or skip. If already owned/Sold Out, do not open a normal buy step; resolve the Payout Claim payment, with no payment when the owner lands on their own company |
| Sellout trigger | On the full-company buy: mark Sold Out, assign the buyer the Payout Claim, and apply one price step increase |
| Sell-back | Trade Step action only; pay seller 1 step below market (or floor), move price down 1 step (unless at floor), put shares into Bank Auction Pool, do not reopen normal supply |
| Auctions | Auction pool shares only, held during Market Open Trading Window; all players may bid; winner pays bank; auction purchase does not move price; Payout Claim frozen until auction closes, then recalculated once |
| Trading | Trade Step: P2P trades and bank sell-back both allowed. Market Open Trading Window: P2P trades and auction bidding only, no bank sell-back. Offers expire on window close |
| Dividends | Pay flat per-share dividend on every regular stock and revealed IPO at every Market Open; apply 2x multiplier for Controllers; Always On, independent of Sold-Out status |
| IPO reveal | Single shared 4-IPO queue; landing on either of the 2 IPO spaces reveals the next unrevealed IPO; revealer gets first buy option, then clockwise order |
| Margin | Off by default; when on, enforce $4,000 cap, half-balance repayment on Market Open pass or landing, forced sell + penalty fee on default |
| Insolvency | Standard mode: if a player can't cover a required payment, force-sell regular stock only (not IPO/ETF) at sell-back price until covered or shares exhausted; unpaid shortfall after that is waived, cash floors at $0, no elimination |
| Market Open | Pay salary, dividends, ETF payouts, diversification bonuses, resolve Margin repayment, then open Market Open Trading Window |
| UI | Show Sold Out, Payout Claim holder, landing payout, Contested status, sector progress, diversification badge, auction pool count, dividend income per Market Open, Margin balance |
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
