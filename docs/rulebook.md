# THE EXCHANGE — Updated Prototype Rulebook

**Post-Audit Revision — Bucket A / B / C Decisions Incorporated, plus the 2026-09-18 Rulebook Reconciliation Pass**
Consolidated Rules — Reconciled September 18, 2026

> **Purpose:** This rulebook incorporates every rule locked during the design audit — dividends, sector map, IPO reveal mechanics, margin system, price floor/ceiling, and all supporting decisions — before final code lock.
>
> **Status:** This rulebook is maintained alongside the playable prototype. The full-company landing rule and the $35,000 / $45,000 / $55,000 starting-cash choices are implemented. The 2026-09-18 reconciliation pass matched every rulebook-vs-code contradiction and undocumented mechanic found in the full-game audit (margin system, Weak/Strong Demand, Sold-Out payouts, Sector Control, player loans, the Market Meter, ETFs, and the sector map now all match the app exactly). A follow-up cash-flow pass the same day raised starting cash, salary, and dividend rates and added the Recovery Bonus (Section 8) after a live trace showed players being driven to $0 cash by Payout Claims. Items still explicitly marked TBD remain subject to balance testing.

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
10. Strong Demand
11. Sold-Out and Payout Claim
12. Sector Control
13. Player Loans (Payout Claim Financing)
14. Selling Shares and Outstanding Shares
15. Trading
16. Sector Portfolio
17. Diversified Portfolio
18. ETFs
19. IPOs
20. Margin System
21. Market Meter
22. Special Spaces
23. Price Movement
24. Endgame and Scoring
25. Standard Mode Settings
26. Code-Facing Rule Checklist
27. Open Balance Items

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
- Plus the current value of owned IPO holdings, plus owned ETF holdings valued at their fixed purchase/card price (see Section 18; ETFs have no live market price)
- Minus outstanding Margin balance (see Section 20, Margin System)
- Minus any unpaid Player Loan balance owed to another player (see Section 13)
- Minus Outstanding Fees principal and accumulated interest
- Plus any final bonuses specifically granted by cards or variant rules

## 2. Components

- 1 game board with 36 spaces
- 22 regular stock spaces/cards, organized into 8 sectors (see Section 16)
- 4 ETF spaces/cards
- 2 IPO spaces and 4 IPO cards (shared reveal queue — see Section 19)
- 1 The Fed space and Fed cards
- 1 Market Swing space (combined Bull Run / Bear Run — resolved by a d6 roll on landing)
- 2 Market Event spaces and the combined Market Event deck
- 1 Investor Day space
- 1 Portfolio Tax space
- 1 Audit Notice space
- 1 Market Open corner/space
- Player tokens: Bull, Bear, Money Bill, Laptop, Calculator, Vault
- Cash or digital bank balances
- Share supply trackers
- Market price tracker, including the $100 floor marker and the $5,000 Market Event mark
- A single shared Market Meter needle (see Section 21)
- Weak Demand markers and Strong Demand markers
- Payout Claim cards or markers
- Sector Portfolio badges (8 sectors) and Sector Control pair markers (11 pairs, see Section 12)
- Diversified Portfolio and Broad Market Portfolio badges
- Outstanding Shares tracker for sold-back shares
- Margin tracker (outstanding balance per player, $4,000 cap)
- Player Loan tracker (principal/interest per negotiated loan, see Section 13)

## 3. Setup

- Each player chooses a token and receives the starting cash selected at setup: $35,000, $45,000, or $55,000. The default is $35,000.
- Place all player tokens on Market Open.
- Set each regular stock to its starting market price from the app or its printed stock card. Every price is a multiple of $25 and never below the $100 floor.
- Place 11 market shares in supply for each regular stock.
- Shuffle the combined Market Event deck and The Fed deck separately. Shuffle the 4 IPO cards into their own shared reveal queue.
- Set all 4 IPO cards face down in a single shared reveal queue (see Section 19). None are available for purchase until revealed.
- Set up ETF spaces/cards according to current app data.
- Place Payout Claim cards/markers, Weak Demand markers, Strong Demand markers, Sector Portfolio badges, Sector Control pair markers, and Diversification badges near the bank.
- Set the Market Meter needle to 0 (Neutral).
- Determine the first player by the app, by highest dice roll, or by table agreement.

**Note:** Starting cash, salary amount, opening share prices, dividend per-share amount, and any fixed ETF purchase prices should use the current app defaults until playtesting locks the final values.

## 4. Board and Space Types

The board has 36 spaces. The current rule direction preserves the board count and does not bring back Short Sell.

| Space type | Count | Purpose |
|---|---|---|
| Regular stock | 22 | Buy shares, build ownership, sell out companies, create Payout Claims, earn dividends |
| ETF | 4 | Diversification-style investment route that pays at Market Open and can charge a landing fee |
| The Fed | 1 | Draw and resolve a Fed card; space 7 |
| Market Swing | 1 | Roll a d6 to decide Bull Run or Bear Run, then resolve it and every player's locked stance; space 19 |
| IPO | 2 | Reveal and access IPO opportunities (shared queue of 4) |
| Market Event | 2 | Draw and resolve a Market Event card; spaces 16 and 26 |
| Market Open | 1 | Payday, Market Condition roll, then Market Open Trading Window |
| Portfolio Tax | 1 | Penalty space based on net worth |
| Investor Day | 1 | Choose Company Growth (+1 step to an eligible owned company, or $500 if none) or Insider Information (preview the next Market Event without drawing it) |
| Audit Notice | 1 | Penalty space with extra cost if Margin balance is outstanding |

**Board rule locks**
- Market Open is payday plus a new Market Condition roll, and does not trigger a Market Event.
- Spaces 16 and 26 are Market Event spaces; space 19 is the combined Market Swing space.
- Short Sell is not part of the standard game flow.
- The 3D board is a renderer; the rules engine remains the source of truth.

## 5. Turn Flow

Each turn follows the same order unless a card or special rule changes it.

1. Roll dice. The Market Meter needle (Section 21) is nudged by the roll.
2. Move the active player token.
3. If the player passes or lands on Market Open, resolve Market Open before continuing the landing result as applicable.
4. Resolve the landed space completely.
5. Resolve any required payment, buy/skip choice, Weak/Strong Demand effect, outstanding-share offer, card, or special-space effect.
   - 5a. If the landed space is an IPO space, only the player who landed there may buy IPO shares. A new reveal offers that IPO to the landing player; after all 4 IPOs are revealed, the landing player may choose any revealed IPO with available shares.
6. Open the active player's Trade Step.
7. During the Trade Step, the active player (and any other player) may propose P2P trades, and the active player may sell up to half of each regular-stock holding back to the bank, rounded down (see Section 14).
8. Resolve accepted trades and bank sales immediately.
9. End the Trade Step. All unresolved offers expire.
10. If the player's first roll was doubles, that player takes exactly 1 bonus roll after the landing and all required actions are fully resolved.
    - Doubles rolled on the bonus roll do not earn another roll.
11. If the round just completed (every player has taken a turn), the Market Meter forces one guaranteed reprice (Section 21).
12. Pass play to the next player.

**First-lap grace:** Any Payout Claim (Section 11), Sector Rent (Section 12), or ETF landing fee (Section 18) that would otherwise be owed is skipped entirely for a player who has not yet completed one full lap of the board — no charge, no marker, no effect on the claim/fee holder. The purchase or other option that space offers is unaffected; only the payment to another player is waived. Once a player completes their first lap, every later landing is charged normally.

## 6. Market Open

Market Open is the payday space. It is not a Market Event trigger.

**Market Open payout order**
1. Pay salary: $2,000 per pass, doubled to $4,000 for landing exactly on Market Open instead of passing over it (Section 5).
2. Pay Dividends for all eligible regular stock and IPO holdings (see Section 8).
3. Apply Controller dividend multipliers where applicable (1.5×).
4. Pay ETF payouts and any ETF Full-Diversification bonus (see Section 18).
5. Pay Diversified Portfolio or Broad Market Portfolio bonus, if earned.
6. Pay the Recovery Bonus if the player's cash, before any of this Market Open's income, was under $3,000 (Section 8).
7. Resolve Margin repayment: any player with an outstanding Margin balance repays half of it (see Section 20).
8. If the player has no still-active Market Condition of their own, roll one, personal to them alone (see below).

**Market Conditions**

Each player has their own independent Market Condition slot — it is never shared. A condition belongs exclusively to the player who rolled it: only they get its effect, and it never touches or replaces another player's own still-active condition. More than one player can be running a different condition at the same time.

Reaching Market Open does not automatically reroll a still-active condition — it just continues. A fresh one is only rolled once a player has none (either they've never had one, or their last one expired). Duration is explicit, not "until someone else reaches Market Open":
- **Sector Spotlight, Weak Demand Bargains, Risk-Off, Toll Hike, Credit Tightening** last 5 of the owner's own turns, ticked down at the end of each one (a doubles bonus roll doesn't count as a separate turn).
- **Dividend Windfall, ETF Inflows** last 2 of the owner's own Market Open passes — they still pay out on the pass that expires them.

| Condition | Active effect (owner only) |
|---|---|
| Sector Spotlight | One random sector: the owner's own Payout Claims there pay them an extra $250. |
| Dividend Windfall | The owner's dividend-paying shares earn an extra $25 per share at their Market Open. |
| ETF Inflows | If the owner holds at least one ETF, they receive an extra $300 at their Market Open. |
| Credit Tightening | The owner personally cannot take new Margin. If they negotiate a Payout Claim loan as debtor, their rate is capped at 2% (Section 13). |
| Weak Demand Bargains | The owner gets 10% off buying any untouched company carrying a Weak Demand marker. |
| Risk-Off | The owner's own High-risk Payout Claims (when they're the holder) pay them $250 less, to a minimum of $50. |
| Toll Hike | Sector Control rent the owner collects, if they control a pair, is doubled ($400/$700/$1,100). |

The Sector Spotlight and Risk-Off adjustments apply directly to the Payout Claim amount owed to the holder, before Sector Rent (Section 12) is added on top.

**Market Open Trading Window**

After all Market Open payouts are complete, open a Market Open Trading Window for all players.

During the Market Open Trading Window, all players may:
- Make player-to-player trades involving cash and owned shares.
- Buy outstanding bank-held shares only when you land on that company.

During the Market Open Trading Window, players may not:
- Directly buy fresh shares from normal market supply.
- Sell shares back to the bank — bank sell-back is a Trade Step-only action (see Section 14).
- Make future promises, general loans, or conditional deals (Player Loans, Section 13, are the one exception, and only apply to a Payout Claim shortfall).
- Leave unresolved offers open after the active player closes the window.

Fresh shares can only be bought by landing on that stock space or resolving a card/effect that specifically allows it.

## 7. Regular Stocks

| Rule item | Current rule |
|---|---|
| Regular stock supply | 11 total market shares per regular stock |
| Market buy rule | Buy the entire untouched company for 11× its current per-share market price, or skip |
| Tier opening share prices | Starter $500; Growth $750; Premium $1,000 per share |
| Opening full-company cost | Starter $5,500; Growth $8,250; Premium $11,000 (11 × the tier's opening share price) — rises or falls from there if the price has moved before it's bought |
| Market sell cap | Sell up to half of each regular-stock holding per turn, rounded down |
| Control threshold | 6+ shares = Controller |
| Ownership tiers | 1-2 Stock Owner; 3-5 Shareholder; 6+ Controller |
| P2P pricing | Any agreed price; private trades do not move market price |
| Price floor | $100 hard floor — price cannot move below this |
| Price ceiling | $5,000 — reaching this price triggers a global Market Event card |

**Landing on an untouched regular company**
- The active player may buy the entire company or skip. Partial purchases from normal market supply are not allowed.
- A full-company purchase costs 11× the company's *current* per-share market price at the moment of purchase — not a one-time fixed tier price. At opening this is $5,500 (Starter), $8,250 (Growth), or $11,000 (Premium); it moves with the company's own live price from there.
- The buyer receives all 11 shares, normal market supply becomes 0, the company becomes permanently Sold Out, and the buyer receives its Payout Claim.
- The purchase does not move the live per-share market price — the buyer's cost basis for all 11 shares always equals their market value at the moment of purchase, by design: acquiring an asset must never, by itself, create a paper gain or loss.
- If the player can afford the purchase and explicitly skips anyway, add a Weak Demand marker (Section 9). A skip forced by insufficient cash never adds one.
- If the player is short on cash, they may sell other regular-stock holdings to the bank to raise it (normal sell-back rules, Section 14) before deciding — this does not use up the landing's buy/skip decision, so the Buy option stays available afterward if it raised enough. Only the eventual Buy or Skip ends the landing.
- Once another player owns the company, landing there does not open a normal buy step. Resolve the Sold-Out Payout Claim instead (Section 11).

**Sold-Out landing payout (base rate)**

Base payout is a multiple of the specific company's own opening per-share
price, not a flat amount — a Premium company's landing rent scales with its
higher price the same way a Starter company's does with its lower one (2026
balance pass: a flat table paid Starter-tier companies roughly 2x the rent
per dollar invested of Premium ones). This is the base rate before the
landing value multiplier, shareholder discount, Sector Portfolio boost, or
Sector Rent are applied — see Section 11 for how those combine.

| Ownership status | Shares owned | Base Sold-Out landing payout | Starter ($500/sh) | Growth ($750/sh) | Premium ($1,000/sh) |
|---|---|---|---|---|---|
| Stock Owner | 1-2 | 1× opening share price | $500 | $750 | $1,000 |
| Shareholder | 3-5 | 2× opening share price | $1,000 | $1,500 | $2,000 |
| Controller | 6+ | 4× opening share price | $2,000 | $3,000 | $4,000 |

## 8. Dividends

Dividends are a passive Market Open income stream, separate from and stacking with the Payout Claim system. Where Payout Claim rewards scarcity (only active after sellout), Dividends reward position size continuously, whether or not a stock has sold out.

**Regular stock dividends**
- Every regular stock pays a flat per-share dividend at every Market Open, to every player who holds shares of it — Always On, no Sold-Out requirement.
- Controllers (6+ shares of that stock) earn 1.5× the per-share dividend rate on that stock, same multiplier structure as IPO Controllers.
- Per-share dividend amount, by risk tier: Low $110, Medium $70, High $30 (2026-09-18 cash-flow pass — see the Recovery Bonus below for why).

**IPO dividends**
- IPO Controllers (3+ shares of that IPO) earn 1.5× dividend on that IPO, plus the Controller badge (already locked, see Section 19).
- Base IPO per-share dividend amount: TBD during balance testing.

**Note:** Dividends and Payout Claim are two separate, stacking income layers on the same stock: Dividends reward raw position size every Market Open; Payout Claim rewards being the top owner of a Sold-Out stock whenever anyone lands on it.

**Recovery Bonus**

A live 200-turn trace found average Payout Claim charges of $4,000-4,300 — roughly 8× a single salary payment — driving players to literal $0 cash in every run, worse in 5-6 player games where more sold-out companies exist to land on. Salary and dividend rates were raised at the same time (see above and Section 5), but neither responds to the specific moment a player has actually been wiped out. The Recovery Bonus does:

- Checked at every Market Open pass, right after salary (Section 6's payout order, step 6): if the player's cash, *before* any of this Market Open's income, was under $3,000, pay them a flat $2,000 on top of everything else.
- This is a one-time top-up per qualifying pass, not an ongoing rate — a player who stays above $3,000 never sees it.
- It stacks with every other Market Open payment (salary, dividends, ETF payouts, diversification bonus, Market Condition income).

## 9. Weak Demand

Weak Demand makes ignored, untouched companies lose value. Ownership never grants automatic price protection.

**Weak Demand rule**
- Each regular stock can hold up to 2 Weak Demand markers.
- When a player lands on an untouched regular stock, can afford its full-company price, and explicitly chooses to skip anyway, add 1 Weak Demand marker.
- A skip forced by insufficient cash is not disinterest and never adds a marker — the space still offers the normal skip, it simply doesn't count.
- When a stock reaches 2 Weak Demand markers, move its market price down 1 step immediately and clear the markers, unless the stock is already at the $100 floor.
- Buying the full company clears all Weak Demand markers on it.
- Markers persist on a company across lap rollovers — they do not reset just because a new lap begins.
- Share count, Controller status, Sector Portfolio, and Diversified Portfolio never protect a price automatically.
- Sold-Out spaces no longer offer a buy/skip choice, so they do not gain new Weak Demand markers; their prices can still fall through Market Events and qualifying bank sales.

## 10. Strong Demand

Strong Demand is the positive mirror of Weak Demand: it gives an already sold-out, popular company its own ongoing upward price pressure, driven by repeat landings rather than by cards or the Market Meter alone.

**Strong Demand rule**
- Applies only to a company that has already sold out. Weak Demand (Section 9) only ever applies *before* a company sells out; Strong Demand only ever applies *after* — the two never track the same company at the same time.
- Each Payout Claim landing on a sold-out company adds 1 Strong Demand marker to it, regardless of how the landing player ultimately settles the claim — cash, a forced stock sale, or a negotiated Player Loan (Section 13) all count equally.
- When a company reaches 2 Strong Demand markers, move its market price up 1 step immediately and clear the markers, unless the stock is already at the $5,000 ceiling.
- Markers persist across lap rollovers, same as Weak Demand.
- Landing on your own sold-out company, or on a Contested company (Section 11), adds no marker — no claim was actually owed on that landing.
- A landing during a player's first-lap grace period (Section 5) adds no marker either, for the same reason: no claim is owed yet.

## 11. Sold-Out and Payout Claim

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
- When another player lands on that Sold-Out stock, they pay the listed landing payout to the Payout Claim holder (see below for how the final amount is computed), and 1 Strong Demand marker is added to the stock (Section 10).
- If the landing player holds the Payout Claim, no payment is made and no Strong Demand marker is added.
- If there is a tie for most shares, the stock is Contested: no landing payment is made and no Strong Demand marker is added until one player becomes the clear top owner.
- A player still in their first lap owes nothing on landing (Section 5's first-lap grace) — again, no payment and no Strong Demand marker.

**Landing value multiplier**
- If a Sold-Out company's current market price has risen above its own opening price, the landing payout scales up: 1.5× once the price is above opening, 2× once it has reached at least double its opening price.
- At or below opening price, the payout uses its normal (1×) rate.

**Shareholder landing discount**
- If the landing player already owns shares of the company they're landing on, their Payout Claim is discounted 10% per share held, capped at 50% (5+ shares owned).
- This does not apply to Sector Rent (Section 12), which is never discounted.

**Putting it together**

Final Payout Claim = round( base rate (Section 7, or the boosted Sector Portfolio rate from Section 16 if the holder has completed that sector) × landing value multiplier × (1 − shareholder discount) / $50 ) × $50, minimum $50, then adjusted by any active Market Condition (Section 6). Sector Rent (Section 12), if it applies, is added afterward as a separate flat toll that is never multiplied or discounted. The final combined charge from one landing is capped at **$10,000** after all adjustments and Sector Rent.

**Payout Claim transfer timing**
- The Payout Claim transfers immediately whenever an ownership change — bank sell-back, outstanding-share purchase, or P2P trade — makes a different player the clear top owner.

**Board/card display**

| Display | Meaning |
|---|---|
| Sold Out | No normal market shares remain; stock has become a claimable space |
| Pay [Player]: $X | Landing payment goes to the current Payout Claim holder |
| Contested | Tied top ownership; no landing payment until resolved |
| Player-color ring/token | Visual marker showing who currently holds the Payout Claim |

## 12. Sector Control

Sector Control is a Monopoly-style "color-set" bonus layered on top of the broader 8-sector Sector Portfolio system (Section 16) — smaller in scope (2 companies instead of a whole sector) but it can fire on every qualifying landing, not just once per Market Open.

**Sector Control pairs**

The 22 regular stocks are grouped into 11 fixed pairs. Most pairs are drawn from the same Sector Portfolio sector, but a few deliberately cross sector lines:

| Pair | Tier | Rent | Companies |
|---|---|---:|---|
| Consumer Staples | Low | $200 | SafeMart Stores (SAFE) · FreshBite Foods (FRSH) |
| Health Essentials | Low | $200 | CarePlus Clinics (CARE) · VitalSign Devices (VSGN) |
| Real Estate Holdings | Low | $200 | MetroHomes REIT (MTRO) · RentWell Properties (RENT) |
| Blue Chip Alliance | Low | $200 | FirstTrust Bank (FTRB, Finance) · IronRail Logistics (IRON, Industrials) |
| Health Innovation | Medium | $350 | MediCore Health (MEDI) · BioQuest Labs (BIOQ) |
| Energy Complex | Medium | $350 | OilWorks Energy (OILW) · SolarGrid Power (SOLR) |
| Heavy Industry | Medium | $350 | BuildMax Materials (BLDM) · AeroLift Manufacturing (AERO) |
| Capital Growth | Medium | $350 | PayWave Credit (PAYW, Finance) · TowerPoint Realty (TWPT, Real Estate) |
| Speculative Plays | Medium | $350 | SneakerStreet (SNKR, Consumer) · Apex Investments (APEX, Finance) |
| Tech Sentinels | High | $550 | CloudCore AI (CCAI) · CyberShield Systems (CYBS) |
| Media & Games | High | $550 | StreamWave Media (STRM) · GameBox Studios (GMBX) |

**Sector Control rule**
- A player exclusively controls a pair when they hold at least 1 share of *both* companies in it and no other player holds any share of either.
- Because a full-company purchase is all-or-nothing (Section 7), the only landing where Sector Rent can actually apply is on an already Sold-Out company — in practice, Sector Control ownership requires both companies in the pair to already be sold out.
- When another player lands on either company in a pair its controller exclusively owns, the controller's Sector Rent (see table above) is added on top of the normal Payout Claim owed for that landing (Section 11). It is never charged on its own, and never on an untouched-company landing.
- If ownership of the pair is split, tied, or only partially held, no Sector Rent applies. This is entirely separate from, and does not affect, either company's own individual Payout Claim holder.

## 13. Player Loans (Payout Claim Financing)

When the active player owes a Payout Claim (optionally with Sector Rent added, Section 12) and cannot or does not want to pay it fully from cash, they may negotiate a loan from the creditor instead of an immediate forced stock sale.

**Negotiated loan rule**
- Only available for a Payout Claim shortfall — this is not a general-purpose player-to-player loan. Every other kind of future promise or side-agreement loan remains unsupported (Section 15).
- The creditor (the player owed the claim) rolls a single d6 to set the loan's per-turn interest rate: a roll of 1-5 maps directly to that percent; a rolled 6 is capped down to 5%.
- The debtor receives the shortfall as loan principal immediately. The creditor's cash is not paid out at this moment — they are now owed the balance instead.
- At the start of each of the debtor's own turns, the outstanding balance (principal + interest) accrues one turn of interest at the loan's own rate, rounded to the nearest $10 with a $20 minimum increase.
- The debtor may pay a $500 installment or the full remaining balance at any time from their Portfolio. Payments apply to interest first, then principal.
- An unpaid loan balance counts against the debtor's Net Worth and for the creditor's, exactly like Outstanding Fees (Section 24).

## 14. Selling Shares and Outstanding Shares

Selling back to the bank is allowed, but it does not reopen a Sold-Out company. Sold-back shares remain attached to that company as Outstanding Shares.

**Sell Back to Bank**
- Selling to the bank is available to the active player after rolling and resolving required actions. It is not available during the Market Open Trading Window.
- During one turn, a player may sell up to half of each regular-stock holding back to the bank, rounded down. Multiple sales of the same company share that cumulative limit.
- The seller receives the current market price less a 20% bank haircut for each share sold.
- The sell-back price is never below the $100 floor.
- Selling 3 or more shares in one bank-sale action moves that stock down 5%, unless it is already at the $100 floor. Selling 1 or 2 shares does not move its price.
- Every regular stock and IPO purchase records actual cost basis. A full-company purchase uses its actual 11×-live-price buyout cost (Section 7) as the total basis for all 11 shares. IPOs, outstanding-share purchases, and private trades use the actual amount paid — including the market value of any shares handed over as part of the trade, not just cash.
- **Unrealized stock gain/loss** = current market value of shares still held − their remaining cost basis.
- When shares are sold, their proportional average basis is removed from the holding. **Realized gain/loss** = sale proceeds − removed basis.
- Total Stock G/L = Realized Stock G/L + Unrealized Stock G/L. Dividends, Payout Claims, salary, taxes, and bonuses are not included in Stock G/L; they remain visible through Market Gain and the cash logs.
- Sold-back shares become Outstanding Shares for that company.
- Sold-back shares do not return to normal market supply.

**Outstanding Shares**
- Shares sold back to the bank are tracked on that company's board space.
- Only a player who lands on that company may buy its Outstanding Shares.
- The landing player may buy any number available and affordable, or skip them.
- Each share costs the current per-share market price shown on the board when the offer opens.
- Outstanding-share purchases do not move the market price.
- The stock's Sold-Out status remains active. Recalculate the Payout Claim immediately if the purchase changes who owns the most shares (see Section 11).

## 15. Trading

Trading is powerful, but it must happen in clean windows so the app can enforce the result and the turn stays readable.

**Binding Trade Window**
- Players may trade only during the active player's Trade Step, unless Market Open creates a Market Open Trading Window.
- The Trade Step begins only after the active player fully resolves the landing space and all related effects. The one exception: landing on an untouched regular company (Section 7) allows selling other holdings to the bank *before* the buy/skip decision, specifically to raise cash for that purchase — this doesn't count against the landing's own decision, only the eventual Buy or Skip does.
- During the Trade Step, any player may propose P2P trades involving cash and owned shares. Only the active player may sell shares to the bank, within the per-company half-holding limit.
- Trades can be for any agreed price: above market, below market, equal to market, or another accepted cash amount. A share-for-share swap values the shares handed over at current market price for cost-basis purposes on both legs.
- All transfers must happen immediately when accepted.
- Private trades do not move market price.
- Future promises, general player-to-player loans, conditional deals, and side agreements are not official trades and are not supported by the app. The one exception is Payout Claim financing (Section 13) — a specific, fully-tracked negotiated loan available only when a Payout Claim shortfall is owed.
- All unaccepted offers expire when the active player ends the Trade Step.
- If a trade changes Controller status, Sector Portfolio status, Sector Control status, Diversified Portfolio status, or Payout Claim ownership, update those states immediately.

**Trading blocked while...**

| Condition | Reason |
|---|---|
| Dice are rolling or token is moving | Movement must resolve first |
| A landing choice is unresolved | Buying, skipping, or payment must resolve first |
| An outstanding-share offer is active | Landing player must buy or skip before ending the turn |
| A card effect is unresolved | Card result may change ownership, cash, or price |
| Market Open payouts are still resolving | Payout order must complete before the Market Open Trading Window |
| A Payout Claim, forced-sale, or loan-rate prompt is unresolved | The debtor/creditor exchange must resolve first |

## 16. Sector Portfolio

Sector Portfolio is the Monopoly color-group equivalent. It rewards concentration in one sector, not diversification.

**Sector map**

The 22 regular stocks are divided into 8 sectors, unevenly sized:

| Sector | Companies | Count |
|---|---|---:|
| Technology | CloudCore AI (CCAI) · CyberShield Systems (CYBS) | 2 |
| Consumer | SafeMart Stores (SAFE) · FreshBite Foods (FRSH) · SneakerStreet (SNKR) | 3 |
| Healthcare | MediCore Health (MEDI) · BioQuest Labs (BIOQ) · VitalSign Devices (VSGN) · CarePlus Clinics (CARE) | 4 |
| Energy | OilWorks Energy (OILW) · SolarGrid Power (SOLR) | 2 |
| Finance | FirstTrust Bank (FTRB) · PayWave Credit (PAYW) · Apex Investments (APEX) | 3 |
| Real Estate | MetroHomes REIT (MTRO) · TowerPoint Realty (TWPT) · RentWell Properties (RENT) | 3 |
| Industrials | IronRail Logistics (IRON) · BuildMax Materials (BLDM) · AeroLift Manufacturing (AERO) | 3 |
| Comms/Media | StreamWave Media (STRM) · GameBox Studios (GMBX) | 2 |

**Sector Portfolio rule**
- A player completes a sector by owning at least 1 regular share in every regular company of that sector.
- When completed, that player receives a Sector Portfolio badge for that sector.
- IPO stocks and ETFs do not count toward Sector Portfolio unless a future card/rule says otherwise.
- If the player no longer owns at least 1 share in every regular company of that sector, the Sector Portfolio bonus ends immediately.

**Payout Claim boost**

Figures below are for a Starter company ($500/share); every amount scales with
the sold-out company's own opening share price — see Section 7's Sold-Out landing
payout table for the Growth/Premium figures.

| Ownership tier | Normal payout | Payout with Sector Portfolio |
|---|---|---|
| Stock Owner | 1× share price ($500) | 1.5× share price ($750) |
| Shareholder | 2× share price ($1,000) | 3× share price ($1,500) |
| Controller | 4× share price ($2,000) | 6× share price ($3,000) |

The Sector Portfolio bonus only affects Sold-Out Payout Claim earnings in that sector. It does not change share count, control threshold, market price, or dividend multiplier unless a card specifically says so. It is entirely separate from Sector Control (Section 12), which rewards owning a specific 2-company pair rather than an entire sector.

## 17. Diversified Portfolio

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

## 18. ETFs

ETFs are a diversification route and Market Open income source. They should not duplicate the regular stock Payout Claim system.

**ETF rules**
- There are 4 ETF spaces/cards in the current board structure.
- ETFs pay at Market Open according to the payout table below.
- ETFs do not have ownership tiers, Controllers, Sector Portfolio status, or Weak/Strong Demand. They do have their own landing fee, described below — a separate mechanic from the regular-stock Payout Claim system, not a duplicate of it.
- ETFs may be traded during legal trading windows unless a card or app setting says otherwise.
- ETF payouts should remain clear and simple so they act as a lower-conflict strategy path.
- ETFs have no live market price. For all net-worth calculations (Final Portfolio Value and Portfolio Tax), owned ETF holdings are valued at their fixed purchase/card price.

**ETF payout table**

Fixed purchase price $3,000/share. Payout at every Market Open, indexed by a player's *total* ETF shares owned across all 4 funds (capped at 4):

| Total ETF shares owned | 0 | 1 | 2 | 3 | 4+ |
|---|---:|---:|---:|---:|---:|
| Market Open payout | $0 | $300 | $700 | $1,200 | $1,800 |

**ETF landing fee**
- Landing on an ETF space already controlled by another player — that player is the sole holder with strictly more shares of that fund than anyone else — charges the landing player a landing fee, paid to that fund's controller.
- The fee scales with how many of the 4 distinct funds the controller holds at least 1 share of (not total shares of one fund): 0 distinct funds → $0, 1 → $750, 2 → $1,500, 3 → $2,500, 4 → $4,000.
- If ownership of a fund is tied between two or more players, it is Contested and no landing fee is charged.
- The fee can be paid immediately or carried as Outstanding Fees debt (Section 24), same as Portfolio Tax and Audit Notice.
- Buying a share of the fund is always offered on landing regardless of who else already owns it — only the landing fee, not the purchase itself, depends on ownership.
- A landing during the landing player's first-lap grace period (Section 5) owes no landing fee, but the purchase offer is unaffected.

**ETF Full-Diversification bonus**
- A player holding at least 1 share in every one of the 4 distinct funds receives an extra $600 at Market Open, on top of the payout table above.
- This mirrors Sector Portfolio's "complete the set" reward, applied to ETFs instead of regular stocks.

## 19. IPOs

IPOs are limited new-stock opportunities. They are more volatile and have smaller supply than regular stocks.

| IPO rule item | Current rule |
|---|---|
| Total IPO companies | 4, in a single shared face-down reveal queue |
| IPO board spaces | 2 — either space can trigger the next reveal |
| IPO supply | 5 total shares per IPO company |
| IPO control threshold | 3+ shares = Controller |
| Controller benefit | 1.5× dividend on that IPO plus Controller badge |
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
- IPO share prices do not move from buying or selling. IPO prices change only through Market Event cards, the Market Meter (Section 21), and other card effects.
- IPOs are more exposed to market volatility than regular stocks: their value is driven by Market Events and the Market Meter rather than by buy/sell price moves.
- The $100 floor and $5,000 ceiling still apply to IPO prices.
- IPO prices do not move before being revealed.

**Confirmed**
- IPO shares count toward final portfolio value.
- IPO shares do not count toward Diversified Portfolio bonus.

## 20. Margin System

Margin (renamed from Loans) is an advanced-mode borrowing system, distinct from the Payout Claim Player Loans in Section 13. It is off by default in standard mode (see Section 25).

**Margin rules**
- Maximum outstanding Margin balance: $4,000 per player.
- A player may draw Margin from the bank up to the $4,000 cap, subject to app/table rules for when Margin may be taken. No new Margin may be drawn while the Credit Tightening Market Condition (Section 6) is active.
- Repayment: each time a player passes or lands on Market Open, they must repay half of their current outstanding Margin balance.
- Default consequence: if a player cannot make a required Margin repayment and has no regular stock left to sell, the balance carries forward as Outstanding Fees debt (Section 24) instead of blocking the turn. If shares remain, the bank forces a sale of that player's shares to cover the amount owed, and the player pays an additional penalty fee.
- Penalty fee amount: TBD during balance testing.
- Outstanding Margin balance is subtracted from Final Portfolio Value at game end (see Section 1).

**Note:** Margin is fully specified but remains an advanced-mode toggle — off by default in the standard game (see Section 25, Standard Mode Settings).

**Outstanding Fees and Payout Claim Forced Sale (standard mode)**

Audit Notice, Portfolio Tax, and ETF landing fees are bank/player fees a player may carry. After landing, the player chooses **Pay Now** or **Carry as Debt**. If the player cannot afford the full fee, carrying it is required.

- Carried charges appear in the player's Portfolio as **Outstanding Fees**.
- At the beginning of each of that player's later turns, the current balance adds 5% interest, rounded to the nearest $10 with a $100 minimum increase.
- A player may pay $500 installments or pay the full balance from the Portfolio during their turn. Payments cover outstanding interest first, then principal.
- Outstanding Fees are subtracted from Net Worth and therefore reduce both Standard Mode and Gain/Loss Mode scoring. Any balance left at Market Close remains deducted from the final score.
- A Sold-Out Payout Claim is different because another player is owed immediately. If the landing player cannot cover it, they may negotiate a Player Loan (Section 13) instead of an immediate forced sale. If a forced sale is used instead, the bank forces sales of regular shares at the normal sell-back price until it is covered or regular shares are exhausted. IPOs and ETFs cannot be force-sold; any remaining Payout Claim shortfall is waived. Cash never goes negative, and no player is eliminated.

## 21. Market Meter

The Market Meter is the game's ambient, round-guaranteed source of market movement — on by default in standard mode, not an advanced toggle like Margin or Short Sell. It exists so prices can drift meaningfully even in a round with no qualifying Market Event or Fed card.

**The needle**
- The Market Meter is a single needle ranging from −3 (fully Bearish) to +3 (fully Bullish), shared by the whole game — not per-player, not per-stock.
- Every roll nudges the needle: a roll summing 8 or higher nudges it +1 (toward Bullish); a roll summing 6 or lower nudges it −1 (toward Bearish); a roll of exactly 7 holds it in place.
- A drawn Market Event or Fed card may also nudge the needle toward its own sentiment as part of resolving.
- Its current position is always visible to all players.

**Zone**

| Needle position | Zone |
|---|---|
| −3 to −2 | Bearish |
| −1 to +1 | Neutral |
| +2 to +3 | Bullish |

**Guaranteed round-boundary reprice**
- At the end of every non-final round, the Market Meter forces exactly one reprice, using its zone and magnitude at that moment:
  - Neutral zone (magnitude 1): 1 random eligible sector moves 1 step, direction chosen at random.
  - Bullish/Bearish zone, magnitude 2 (needle at ±2): the *same* sector moves, but 2 steps instead of 1 — direction is fixed by the zone (Bullish only moves sectors up, Bearish only down).
  - Pinned at the extreme, magnitude 3 (needle at ±3): 2 different random eligible sectors each move 1 step, in the zone's fixed direction.
- A sector already at the price floor or ceiling in the required direction is not eligible; if every sector is clamped, no reprice happens that round.
- This reprice is independent of, and does not replace or consume, a Market Event or Fed card draw.
- After each round-boundary reprice, the needle eases 1 step back toward Neutral instead of resetting to 0 — a strong trend can persist and compound across a few rounds instead of vanishing the moment it triggers a reprice.

**Card-triggered ripple**
- A Market Event or Fed card that affects only part of the market (a single sector, a single risk tier, or a single company — never a whole-market card) also stirs 1 additional random eligible sector by 1 step when it resolves, using the same zone-driven direction logic as the round-boundary reprice above.
- This ripple is its own trigger, independent of the round boundary — the market can move mid-round, between any two players' turns, whenever a qualifying card is drawn.
- A whole-market card does not also trigger a ripple, since it already moves everything.

**Interaction with other systems**
- The round-boundary reprice and card ripple both move real stock (and revealed IPO) prices using the normal price floor/ceiling and Weak/Strong Demand rules — they do not bypass them.
- They are unrelated to, and do not double up with, the Market Swing space's Bull Run / Bear Run resolution (Section 22) or the temporary Market Conditions (Section 6).

## 22. Special Spaces

| Space | Rule |
|---|---|
| Market Open | Payday, then a new Market Condition roll, then the Market Open Trading Window. Does not draw a Market Event. |
| Market Event — spaces 16 and 26 | Draw and resolve 1 Market Event card. Also triggered automatically if any stock reaches the $5,000 price ceiling. |
| The Fed | Draw and resolve 1 Fed card. |
| Market Swing — space 19 | Roll a d6: 1-3 resolves as a Bear Run, 4-6 resolves as a Bull Run. Then resolve that Run's stock movements and every player's current stance, and reset all players to Balanced. Circuit Breaker may protect one affected owned company from a Bear Run roll. |
| IPO | Resolve IPO reveal/purchase per Section 19. |
| Investor Day — space 31 | Choose Company Growth or Insider Information. Company Growth raises 1 owned regular company by 5%; crossing $5,000 triggers a Market Event. If you own no regular company, collect $500. Insider Information reveals the title and effect of the next Market Event without drawing, resolving, or removing that card from the top of the deck. |
| Portfolio Tax | Charge equals 10% of current net worth. Choose Pay Now or Carry as Debt under Outstanding Fees. |
| Audit Notice | Charge equals 5% of current net worth, rounded to the nearest $100, with a $500 minimum. Outstanding Margin raises the rate to 7.5% with a $750 minimum. Choose Pay Now or Carry as Debt. |

**Investor Day rollback note:** The previous rule is retained here in case playtesting favors it: choose 1 regular company you own and raise it 5%; if you own no regular company, automatically collect $500. This version had no Insider Information choice.

**Market Swing, Bull Run, Bear Run, and Market Stance**

Landing on Market Swing (space 19) does not resolve a Run directly — it opens a required roll first. The active player rolls 1 die: 1-3 resolves the landing as a Bear Run, 4-6 resolves it as a Bull Run. Once rolled, that Run resolves exactly as described below; there is no further choice.

Each player holds one visible Market Stance. The latest qualifying action replaces the previous stance:

- Buying a regular company or taking Margin sets **Bullish**.
- Selling 3 or more shares in one bank sale or private trade, or opening a Short, sets **Bearish**.
- Players begin **Balanced**. After either Run resolves, every player resets to Balanced.

| Player stance | Bull Run cash | Bear Run cash |
|---|---:|---:|
| Bullish | +$1,500 | −$1,500 |
| Balanced | +$500 | −$500 |
| Bearish | −$750 | +$1,500 |

Required cash losses stop at $0 cash; a Run does not open Insolvency. Resolve stock and cash effects once the Market Swing roll determines which Run applies:

| Investment | Bull Run | Bear Run |
|---|---:|---:|
| High-Risk regular stock | +20% | −20% |
| Medium-Risk regular stock | +10% | −10% |
| Low-Risk regular stock | No change | No change |
| Revealed IPO | +5% | −5% |
| ETF | No change | No change |

Low-Risk stocks are unaffected by either Run in both directions — this is deliberate: Low-Risk already carries the highest dividend yield in the game, so a one-sided Bear Run exemption would make it strictly dominant with zero downside anywhere.

Bull Run and Bear Run are resolved from the combined Market Swing space by a d6 roll, not drawn as cards from the Market Event deck. Dividends, share counts, and Payout Claim tiers do not change directly. Circuit Breaker may protect one owned company from a Bear Run drop. Run-driven moves stop at the $100 price floor and never trigger another Market Event, even when they carry a company past $5,000.

**Circuit Breaker — Market Event hold card**
- The former After-Hours cards are part of the combined Market Event deck; there is no separate After-Hours deck or board space.
- There is 1 Circuit Breaker card in the Market Event deck.
- When drawn, the player keeps it; it remains out of the deck until played.
- When any negative Market Event or Bear Run would lower the price of a company that player owns, pause before applying its price effect.
- The holder may play Circuit Breaker to protect 1 affected company they own from that effect's entire downward move, or pass and keep it for later.
- Playing it is optional and single-use. After play, discard it into the Market Event discard pile.
- It does not stop Weak Demand, bank-sale price movement, the Market Meter, or Fed cards.

## 23. Price Movement

Stock prices are **percentages, not fixed steps**. Every company has a live
market price that moves by a percentage of its *own* current price, so the same
market event is worth more dollars to an expensive company than a cheap one.

**Reading and rounding prices**
- Every price is a whole multiple of **$25**. The price shown is the price paid — there are no hidden cents.
- A price can never fall below the **$100 floor**.
- There is **no price ceiling**. $5,000 is a trigger, not a cap: the first time a company crosses $5,000 upward on a trade-driven move, a global Market Event is drawn. It re-arms only if that company later falls back below $5,000.
- Any non-zero move shifts the price at least one $25 increment, so a cheap company's price is never stuck.

**Standard percentage moves**

| Source | Move |
|---|---:|
| Weak Demand reaches 2 markers | −5% |
| Strong Demand reaches 2 markers | +5% |
| Market Meter, standard reprice | ±5% |
| Market Meter, amplified reprice | ±10% |
| Market Event / Fed card, single-step effect | ±5% |
| Market Event / Fed card, double-step effect | ±10% |
| Bull/Bear Run — High / Medium / Low risk | ±20% / ±10% / no change |
| Revealed IPO in a Run | ±5% |
| Selling 3+ shares to the bank in one action | −5% |
| Investor Day Company Growth | +5% |

**Event reference**

| Event | Market price effect |
|---|---|
| Buy an untouched company | No market-price movement; 11× the current per-share price is paid instead |
| Sell 3+ shares to bank in one action (Trade Step only) | Seller is paid market price less the 20% bank haircut per share; the price also drops 5% after the sell action |
| Sell 1-2 shares to bank (Trade Step only) | Seller is paid market price less the 20% bank haircut per share; the price does not move |
| Private player-to-player trade | No market price movement |
| Outstanding-share purchase | No market price movement unless a card says otherwise |
| Weak Demand reaches 2 markers | Price falls 5% and markers clear, unless already at the $100 floor |
| Strong Demand reaches 2 markers | Price rises 5% and markers clear |
| Stock becomes Sold Out | This happens as part of the full-company purchase; no price increase is applied |
| Stock crosses $5,000 upward on a trade | Triggers a global Market Event card; the price itself is not capped |
| Market Meter reprice or card ripple | Moves 1-2 random eligible sectors; see Section 21 |
| Card effect | Follow the card text; no portfolio or share-count protection applies automatically |

**Per-action price movement:** A full-company purchase does not move the share price. A qualifying bank sell-back is one market action regardless of the number of shares sold in that action.

## 24. Endgame and Scoring

The default game is a net-worth race, not a bankruptcy-elimination game.

**Game end**
- The game ends when the Market Close condition is reached.
- Market Close mode is set by an app toggle chosen before the game starts: Card mode (Market Close is triggered by drawing the Market Close card) or Rounds mode (the game ends after a fixed number of rounds set in the app).
- Extended Hours: if a player holds an Extended Hours card and legally plays it before Market Close triggers, the game is extended by 1 additional round — every player takes exactly 1 more turn — before Market Close finally ends the game. This rule is confirmed active.

**Final scoring**
- Add each player's cash.
- Add the current market value of all owned regular stocks and IPOs, plus owned ETF holdings valued at their fixed purchase/card price (ETFs have no live market price — see Section 18).
- Subtract outstanding Margin balance, if the advanced Margin mode is on.
- Subtract any unpaid Player Loan balance owed to another player (Section 13); add any unpaid Player Loan balance owed *to* the player by someone else.
- Subtract all Outstanding Fees principal and accumulated interest.
- Do not add separate value for Payout Claims, Sector Portfolio badges, Sector Control pairs, or Controller badges unless a specific card/rule grants an endgame bonus.
- In Net Worth Mode, the highest Final Portfolio Value wins.
- In Gain/Loss Mode, subtract Starting Cash and base Salary Collected from Final Portfolio Value. The highest resulting Market Gain wins. Other earned income and penalties remain in the result because they reflect game decisions and consequences.
- Each final result also displays realized, unrealized, and total Stock G/L from the cost-basis ledger.

## 25. Standard Mode Settings

| Setting | Standard mode |
|---|---|
| Starting cash | $35,000 default; setup choices are $35,000, $45,000, or $55,000 |
| Winning score | Net Worth by default; optional Gain/Loss Mode ranks salary-adjusted Market Gain |
| Margin trading | Off by default |
| Weak Demand | On; 2 affordable-but-declined skips drop an untouched company's price 1 step; a skip forced by insufficient cash doesn't count; no ownership protection; markers persist across laps |
| Strong Demand | On; 2 Payout Claim landings raise a sold-out company's price 1 step; markers persist across laps |
| Short Sell | Off / removed from standard game flow |
| Direct rent before sellout | Off; landing payments start only after Sold-Out status |
| Regular stock dividends | On — Always On, flat per-share, 1.5× Controller multiplier |
| Payout Claim | On for regular stocks after Sold Out |
| Sector Portfolio | On (8 sectors) |
| Sector Control | On (11 fixed pairs) |
| Player Loans | On, but only as Payout Claim financing (Section 13) — no other player-to-player loans are supported |
| Diversified Portfolio | On |
| Market Meter | On — ambient round-guaranteed reprice plus card-triggered ripples (Section 21) |
| Market Conditions | On — one random temporary condition active at a time, rerolled at each Market Open (Section 6) |
| Market Open Trading Window | On |
| Sell-to-bank window | Trade Step only (not Market Open) |
| Price floor / ceiling | On — $100 floor / $5,000 ceiling |
| Extended Hours | On — confirmed active |
| Investor Day | Space 31; choose Company Growth (+1 eligible owned company, or $500 if none) or Insider Information (preview next Market Event) |
| Market Close mode | App toggle: Card mode or Rounds mode, chosen pre-game |
| Last Trader Standing / bankruptcy elimination | Optional variant only, not default |

## 26. Code-Facing Rule Checklist

Use this checklist when sending the rules to code.

| Area | Implementation requirement |
|---|---|
| Constants | Regular stock supply = 11; a normal market purchase requires all 11 shares at 11× the current per-share price; regular control = 6; IPO supply = 5; IPO control = 3; a player may sell up to half their shares in one bank sale; price floor = $100; price ceiling = $5,000; Margin cap = $4,000; Salary = $750/pass ($1,500 landing exactly); starting cash = $35,000/$45,000/$55,000; regular dividend by risk = Low $110/Med $70/High $30; Recovery Bonus = $2,000 when cash is under $3,000 at Market Open |
| Derived state | Ownership tier, Controller, Sector Portfolio, Sector Control pair ownership, Diversified Portfolio, Payout Claim, Contested state, Sold-Out state, Strong/Weak Demand markers, Market Meter needle, active Market Condition, Margin balance, Player Loan balances, Outstanding Fees principal/interest, Circuit Breaker holder, remaining stock cost basis, realized/unrealized Stock G/L, salary-adjusted Market Gain |
| Stock landing | If untouched, offer a full 11-share company buyout at 11× the current per-share price, or skip; selling other holdings to the bank to finance the purchase is allowed before that decision and does not consume the landing's action (only Buy/Skip does). If already owned/Sold Out, do not open a normal buy step; resolve the Payout Claim payment (base rate × landing value multiplier × shareholder discount, plus Sector Rent if applicable), with no payment and no Strong Demand marker when the owner lands on their own company, a Contested stock is landed on, or the landing player is still in their first-lap grace |
| Sellout trigger | On the full-company buy: mark Sold Out, assign the buyer the Payout Claim, and leave the share price unchanged |
| Sell-back | Trade Step action only; pay seller 1 step below market (or floor); selling 3+ shares in one action also moves price down 1 step afterward (unless at floor) — selling 1-2 shares does not move price; mark shares Outstanding on that company, do not reopen normal supply |
| Outstanding Shares | Only the player landing on that company may buy; any available/affordable quantity at current per-share market price; purchase does not move price; recalculate Payout Claim immediately |
| Trading | Trade Step: P2P trades and bank sell-back both allowed. Market Open Trading Window: P2P trades only, no bank sell-back. Offers expire on window close. A share-for-share swap leg is booked at market value on both sides |
| Gain/Loss accounting | Purchases add actual cost basis (cash paid plus market value of any shares handed over); sales remove proportional average basis and record proceeds minus basis as realized G/L; current value minus remaining basis is unrealized G/L |
| Dividends | Pay flat per-share dividend on every regular stock and revealed IPO at every Market Open; apply 1.5× multiplier for Controllers; Always On, independent of Sold-Out status |
| IPO reveal | Single shared 4-IPO queue; landing on either IPO space reveals the next unrevealed IPO; only the landing player may buy, up to 2 shares |
| Margin | Off by default; when on, enforce $4,000 cap, half-balance repayment on Market Open pass or landing, forced sell + penalty fee on default, or carry to Outstanding Fees if nothing is left to sell |
| Player Loans | Payout Claim shortfall only; creditor rolls d6 for a 1-5% rate (6 capped to 5%); interest accrues each debtor turn, rounded to $10 with a $20 minimum; $500 installment or full payoff; unpaid balance counts against debtor's score and for creditor's |
| Sector Control | 11 fixed pairs of regular stocks, each with a flat rent ($200/$350/$550 by tier); rent is added on top of a Payout Claim only when the claim holder also exclusively owns both companies in the pair |
| Market Meter | Needle range −3..+3; nudged ±1 per roll (7 holds); guaranteed reprice at every non-final round boundary, scaled by zone and magnitude; decays 1 toward neutral after each reprice instead of resetting; narrow Market Event/Fed cards also trigger a 1-sector ripple on resolution |
| Market Conditions | One random condition active at a time, independent of both card decks; rerolled every time a player reaches Market Open; never stacks |
| Outstanding Fees | Audit Notice, Portfolio Tax, and ETF landing fees may be paid immediately or carried as debt; add 5% each debtor turn, rounded to $10 with a $100 minimum; allow $500/full payments; subtract all unpaid fees from scoring |
| Insolvency | Payout Claim only: if the landing player can't pay another player, offer a Player Loan, or force-sell regular stock (not IPO/ETF) until covered or exhausted; waive any remaining shortfall, cash floors at $0, no elimination |
| Market Open | Pay salary, dividends, ETF payouts and diversification bonus, Market Condition income, Recovery Bonus (if pre-payout cash was under $3,000), resolve Margin repayment, continue or roll a personal Market Condition, then open Market Open Trading Window |
| Circuit Breaker | One held Market Event card; on a later negative Market Event or Bear Run, holder may protect 1 affected owned company from that effect's entire downward move, then discard it |
| Investor Day | Space 31; choose Company Growth (+1 eligible owned regular company, or $500 if none) or Insider Information (preview the next Market Event; card stays on top) |
| UI | Show Sold Out, Payout Claim holder, landing payout, Contested status, Strong/Weak Demand marker counts, Sector Control pair ownership, sector progress, diversification badge, Market Meter needle, active Market Condition, held Circuit Breaker, Outstanding Share count, dividend income per Market Open, Margin balance, Player Loan balances, Outstanding Fees principal/interest/payment controls, per-holding basis and unrealized G/L, total realized/unrealized Stock G/L, Market Gain and salary excluded. Cardless financial spaces must show the total charge and Pay Now / Carry as Debt choices. |
| Logs | Separate bank payout, player-paid payout, private trade, full-company buy, bank sell-back, outstanding-share purchase, Weak/Strong Demand, Payout Claim transfer, Sector Rent, Player Loan issue/accrual/payment, dividend payout, Margin draw/repay, Market Meter reprice/ripple, Market Condition start |

## 27. Open Balance Items

- Opening share prices
- IPO per-share dividend amount
- Margin default penalty fee amount
- Exact Market Close trigger and deck placement (Card mode) and round count (Rounds mode)
- Confirm Extended Hours round count (currently locked at 1 additional round) during playtesting

*End of updated prototype rulebook.*
