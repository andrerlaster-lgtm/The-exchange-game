# Companies Mode — Emergency Loan Playtest

**Date:** August 5, 2026  
**Local prototype:** `/tmp/exchange-game-companies-mode`  
**Rule tested:** One randomized emergency bank loan up to 75% of starting company value, charged at 5% interest.

## What Was Added Locally

- Optional Companies Mode switch in game setup.
- 60 founder shares and 40 public shares per player company.
- Company market opens after the first lap.
- Player-company share buying and selling during the active player's turn.
- Immediate right of first refusal for the company owner.
- Hidden company holdings with press-and-hold reveal.
- Company information and controls are presented inside each player's Portfolio rather than as a separate Companies Mode board panel.
- Portfolio now shows public shares held by players, bank shares still available, the selected player's public-share count, and a Buy More control for the company owner.
- Market Heat trading halt after three doubles.
- Emergency company loan when Company Value reaches zero.
- One-loan limit and repayment requirement before buying another board space.

## Bankruptcy Simulation

The test used a $30,000 starting value and forced one company to $0:

| Test | Result |
|---|---:|
| Starting company value | $30,000 |
| Maximum emergency loan | $22,500 |
| Loan interest | 5% |
| Company price after loan | $25 floor price |
| Second emergency loan | Blocked |
| Board-company purchase while loan is unpaid | Blocked |

The loan correctly prevents elimination. The company remains in the game, but its share price stays at the $25 floor until the company rebuilds value.

## Balance Finding

With a $22,500 loan and no major investment income, 5% compounding interest grows faster than the current $500 Market Open salary:

| After | Loan balance | Cash from salary and original loan | Difference |
|---|---:|---:|---:|
| 1 lap | $23,625 | $23,000 | −$625 |
| 5 laps | $28,715 | $25,000 | −$3,715 |
| 10 laps | $36,649 | $27,500 | −$9,149 |

## Conclusion

The 75% ceiling is generous enough to prevent immediate elimination, but it is too large to be comfortably repayable under the current $500 salary if interest compounds every lap. A bankrupt company can survive, but it may become permanently trapped in debt unless it receives strong dividends, successful investments, or other major income.

## Recommended Next Test

Keep the 75% rule temporarily, but test one of these alternatives before release:

1. Reduce the ceiling to 50% of starting value.
2. Keep 75%, but charge 5% of the original principal rather than compounding the full balance.
3. Keep 75%, but allow the company to earn a recovery bonus or use a longer repayment window.

No change to the 75% rule was made after this test; this note records the finding for the next design decision.

## Majority-Share Sale Playtest

The player-to-player trade flow was tested with one player holding all 11 MEDI shares:

- Seller offered 6 shares to another player for $7,000.
- Seller retained 5 shares.
- Buyer received 6 shares and became the new majority owner.
- The sold-out board space's Payout Claim changed to the buyer.
- Seller still received the normal dividend on 5 shares at Market Open: $500 salary + $250 dividend = $750.
- Buyer received the controlling-share dividend: $500 salary + $600 dividend = $1,100.

This confirms that a player can sell control of a company at a negotiated premium while keeping a minority investment and continuing to receive dividends.

## Verification

- Companies Mode tests: 3 passed.
- Full test suite: 252 passed.
- Production build: passed.
- Live browser click-through was not completed because the local checkout does not have the `agent-browser` command available. The temporary prototype now includes the `three` dependency for the 3D preview.
- Majority-control transfer regression test: passed.

## Live App Verification

The deployed Vercel app responded successfully and its live JavaScript bundle includes:

- Companies Mode
- Company Portfolio
- Founder-share tracking
- Public shares held by players
- Bank shares available
- Buy More control
- Emergency loans
- Market Heat
- Bank Auction, including Bid and Pass controls

## Board Design Mocks

The new visual board concepts are stored beside this note:

- [[the-exchange-board-mock-light.png]] — parchment/light trading-terminal style
- [[the-exchange-board-mock-dark.png]] — charcoal/dark trading-terminal style

Both mocks keep the three-column dashboard, central board loop, Market Ticker, standings, Market Intelligence, and the integrated Company Portfolio.

## Dividend Payment Card

A new Market Event card was added locally:

> **Dividend Payment**  
> Your portfolio had a profitable quarter.  
> Receive the current stock and IPO dividends due on your holdings.

The card includes controlling-share dividend bonuses, but does not pay the $500 salary, ETF income, or diversification bonuses. It does not move stock prices.

Verification: Dividend Payment card test passed; full suite is now 254 tests passing and the production build passes.

## Cyberattack Card

A new Market Event card was added locally:

> **Cyberattack**  
> Your portfolio security system has been breached.  
> Choose one: one owned stock/IPO drops 1 price step, or pay 3% of net worth (minimum $500).

The active player must resolve the choice before continuing. If cash is insufficient, the unpaid remainder becomes Outstanding Fees debt. No shares are permanently removed.

Verification: Cyberattack choice and fee paths are covered by regression tests; full suite is now 256 tests passing and the production build passes.

## Opening Bell Card

When drawn from Market Events, Opening Bell randomly reveals one regular company that no player owns and lets the active player buy the entire 11-share company at its normal Starter, Growth, or Premium tier price. The player can pass. The purchase creates the normal Sold Out status and Payout Claim; it does not move the share price.

Verification: Opening Bell buy/pass paths are covered by regression tests; full suite is now 258 tests passing and the production build passes.

## Regulatory Investigation Card

Added as a Market Event card:

> **Regulatory Investigation**  
> Government regulators open an investigation into one company in your portfolio.  
> Choose: one holding drops 1 price step and its next dividend is reduced 50%, or pay $5,000.

The settlement fee is $5,000. If the player has no eligible holding, the fee is charged automatically; any unpaid amount becomes Outstanding Fees debt. The dividend reduction applies once at the next Market Open or Dividend Payment card, then clears.

Verification: settlement, price/drop, one-time dividend cut, and debt behavior are covered by regression tests; full suite is now 260 tests passing and the production build passes.

## Railroad-Style Fund Spaces

Fund spaces now have stronger landing value. If another player already holds the landed fund, the lander pays that player a fee based on the owner's distinct funds:

- 1 fund: $500
- 2 funds: $1,000
- 3 funds: $1,500
- 4 funds: $2,500

If no other player owns the fund, the lander gets the existing option to buy one share. Existing ETF Market Open payouts and full-diversification bonuses remain unchanged. If the lander cannot pay the fee in full, the remainder becomes Outstanding Fees debt.

Verification: ETF landing-fee and fee-ladder regression tests passed; full suite is now 269 tests passing and the production build passes.
