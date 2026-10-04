# The Exchange — Companies Mode Approved Decisions

**Status:** Approved design baseline  
**Date:** August 5, 2026  
**Related concept:** [[the-exchange-companies-concept]]  
**Review:** [[the-exchange-companies-concept-review]]

## Confirmed Rules

### 1. Share Ownership

Each player company has 100 shares:

- The owner controls 60 founder shares.
- The bank holds 40 public shares.
- Founder shares cannot be sold.
- The owner always retains control of the company.

### 2. Dividends

Companies Mode will not use dividends in the first version. Investors profit through changes in share price and realized gain or loss when they sell.

Dividends may be reconsidered after the core mode has been playtested.

### 3. Trading Halt

Use a shared **Market Heat** meter:

- Each doubles roll adds one Heat.
- At three Heat, a market-wide trading halt begins.
- Players may still move and resolve spaces during the halt.
- Players may not buy or sell shares during the halt.
- The halt lasts until the beginning of the next round.
- Market Heat resets after the halt.

### 4. Trading Timing

Player-company shares may be bought or sold only during the active player's turn. This prevents constant interruptions and keeps the game moving.

The company owner receives first refusal when another player wants to sell shares in that company.

### 5. Game Mode

Companies Mode will be optional. The current game remains available as Classic Mode, with its existing rules and economy preserved.

## Recommended Implementation Defaults

These defaults should be used unless changed during playtesting:

- Company Value updates at the end of each turn.
- Company share price equals Company Value divided by 100 shares.
- Shares in other player companies do not affect Company Value.
- A player may hold no more than 20 shares in one rival company.
- A player may trade no more than five player-company shares per turn.
- The minimum share price is $25.
- The bank buys shares at 90% of market value and sells at 110%.
- Insider trading is postponed until the core mode is balanced.

## Additional Confirmed Decisions

### Company Value Reaches Zero

Players are not eliminated when their company reaches zero value. The company must take a loan from the bank to continue operating.

The loan becomes an outstanding obligation on the company and must be visible in the portfolio and final score. The exact interest rate, loan limit, and repayment timing remain implementation details to tune during testing.

Approved loan rules:

- Emergency loans carry 5% interest.
- The loan amount is randomly selected up to 75% of the company's starting value.
- A company may have only one emergency loan at a time; loans cannot stack.
- A company must repay its outstanding loan before it can buy additional board spaces.

### Right of First Refusal

The company owner gets one immediate opportunity to buy the shares being sold. If the owner refuses, the seller may offer the shares to another player or the bank.

### Market Opening

Player-company trading opens after the first lap. This gives players time to move around the board and allows companies to take over board spaces before the player-company market becomes active.

### Investment Privacy

Player-company investments are hidden from everyone by default. A share owner can press and hold a button to reveal their holdings and release the button to hide them again.

If a player forgets to protect or disclose information that the rules require them to track, that is their responsibility.

### Game Ending

Companies Mode supports either ending option:

- The Market Close space ends the game.
- A fixed-round limit may also end the game.

The host or game setup can choose which ending condition to use.

## Remaining Tuning Questions

No core emergency-loan decisions remain. Playtesting should determine whether the 75% ceiling provides enough recovery money without making company debt meaningless.

## First Prototype Goal

Test only the core loop:

1. Start Companies Mode.
2. Give every player a 60-share founder stake.
3. Make 40 public shares available through the bank.
4. Recalculate each company price from Company Value.
5. Allow buying and selling during the active player's turn.
6. Show each investment's cost basis, current value, and gain or loss.
7. Trigger Market Heat after doubles.
8. Compare final scores against Classic Mode.
