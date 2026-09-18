# 10 — Strategy Mode Features

**Phase:** 5 — Strategy Mode Features
**Priority:** Later
**Status:** Rescoped (2026-09-18) — the original spec is unbuildable as written; see
Implementation Notes below before picking any sub-feature to build.

---

## Implementation Notes (read this first)

The original design below (kept for history further down) gated every one of
these eight features behind a single `opts.mode: 'fast' | 'strategy'` toggle.
That toggle was never actually added — improvement 09 (Game Setup Options),
which was supposed to lay the groundwork for it, shipped a different,
already-working pattern instead: **each optional rule is its own independent
`GameOptions` boolean** (`margin`, `shorts`, `ipos`, `marketMeter`,
`companiesMode`, `bankAuction`), each togglable independently from the setup
screen, none of them bundled into a single "mode." There is no `opts.mode`
anywhere in the current codebase, and reviving it would mean building a
second, parallel options system that fights the one already in place.

More importantly, a lot of what this file was reaching for in mid-2026 has
since been built by other means — the game's whole economy has moved twice
since this spec was written (the 2026-09-15 payout rebalance and the
2026-09-18 cash-flow pass). Below is each of the original eight items,
individually re-checked against the current code:

| Original idea | Current status |
|---|---|
| Extended Hours | **Already shipped** — as a card-granted effect that delays Market Close by 1 round, not a second trade action. No toggle needed; it just happens when the card is drawn. See `s.extendedHoursAvailable`/`s.extendedRoundsLeft`. |
| Market Event Pre-Trade | **Still genuinely open.** Zero matches for this anywhere in the engine. |
| Advanced Weak Demand ("6+ players at a step") | **Drop this one.** It doesn't fit a 2-6 player game as written, and Weak Demand has been substantially redesigned and tuned since (2-marker threshold, persists across laps, forced skips no longer count — see rulebook §9). Reviving the original idea would fight that tuning, not extend it. |
| Same-Sector Rebalance (free trade during Extended Hours) | **Still open**, but needs a new home — Extended Hours currently grants no trade action at all (see above), so there's no existing window to attach this to. |
| IPO Volatility Categories | **Data exists, logic doesn't.** `IpoDef.vol: 'mod' \| 'high' \| 'spec'` is a real field on every IPO in `ipoStocks.ts`, but nothing in the engine reads it — `grep` for `.vol` outside its own type/data declaration returns nothing. Also note the spec's own baseline description is stale: IPOs don't move on buys/sells anymore at all (see rulebook §19, "IPO Price Movement") — they only move via Market Event/Fed cards and the Market Meter. Any amplification would need to hook into `moveEventPrice`/`marketMeter.ts`'s IPO handling instead of "on buy." |
| Known IPO Discount | **Still open**, and NOT the same as the existing `pickKnownIpo` action — that's just "buy this already-revealed IPO from the Free Trading Day list," a plain-price purchase with no discount logic. The actual discount-on-repeat-visit idea has never been built. |
| Full Diversified Portfolio Benefit (+$200 salary/lap) | **Still open**, but re-price against current numbers before building: salary is now $750/pass (was $500 when this was written) and Diversified/Broad Market already pay a flat $300/$600 at Market Open (rulebook §17) — a $200/lap *addition* on top of both of those raises should be sized deliberately, not carried over as a leftover number from an older economy. |
| Trading Fees/Commissions | **Still open.** Zero matches anywhere in the engine — no per-trade cost of any kind exists today. |

**What to actually do with this file:** the five still-open ideas (Market
Event Pre-Trade, Same-Sector Rebalance, IPO Volatility, Known IPO Discount,
Diversified salary bonus, Trading Fees) don't need to ship together or behind
a shared toggle. Each is a self-contained addition to a different part of the
engine and can be built, tested, and shipped independently — pick one, scope
it on its own (real numbers, real trigger conditions, a stop-and-confirm
step for anything balance-affecting, matching how every other mechanic this
session was built), and treat this file as a menu, not a single ticket.

The rest of this document is the original pre-rescope design, kept for
history; treat its "Strategy Mode Rule Pack," `opts.mode` references, and
Completion Checklist as superseded by the table above.

---

## Goal

Re-activate the deeper rules that were stripped for Fast Prototype Mode once the core game feels smooth and setup options (improvement 09) are in place.

---

## Why It Matters

Fast Prototype Mode simplified many rules to speed up playtesting. Strategy Mode brings back realistic complexity: extended trading windows, advanced IPO mechanics, true diversification benefits, and commission costs.

---

## Strategy Mode Rule Pack

These rules are inactive in Fast Prototype Mode. All of them require `opts.mode === 'strategy'`.

### Extended Hours
- After-Hours cards with `strategyOnly: true` are included in the draw deck.
- Extended Hours card triggers a second trade action for the active player.
- Currently: no-op in Fast Prototype.

### Market Event Pre-Trade
- When a player lands on a Market Event space, they may make one trade action BEFORE the card is drawn.
- Currently: card draws immediately, no pre-trade.

### Advanced Weak Demand
- Six or more players at a price step triggers Weak Demand marker, not a simple skip counter.
- Weak Demand removed when a player buys from that space.
- Currently: simple 3-skip counter.

### Same-Sector Rebalance
- During Extended Hours, player may sell one stock and buy another in the same sector without triggering a price move.
- Currently: removed.

### IPO Volatility Categories
- IPOs with `vol: 'spec'` get 2× price movement on buys.
- IPOs with `vol: 'high'` get 1.5× price movement.
- Currently: all IPOs move +1 step per buy.

### Known IPO Discount
- When a player has previously seen a revealed IPO, they buy at 1 step below current price.
- Currently: always buy at current price.

### Full Diversified Portfolio Benefit
- Diversified Portfolio protection triggers a pick on any all-negative market event (already in place).
- Additional benefit: +$200 salary bonus per lap.
- Currently: salary bonus not implemented.

### Trading Fees / Commissions
- Each buy or sell costs a flat $50 commission.
- Currently: no fees.

---

## Files Likely Affected

- `src/engine/actionResolver.ts` — all strategy mode branches
- `src/engine/eventCardResolver.ts` — pre-trade, extended hours
- `src/engine/stockState.ts` — IPO volatility, vol amplification
- `src/engine/turnState.ts` — salary bonus
- `src/data/afterHoursDeck.ts` — strategy-only cards re-enter deck
- `src/data/stocks.ts` — vol field on IPOs already present
- `src/engine/types.ts` — may need `GameOptions.mode` branching

---

## Rules That Must Not Be Broken

- Fast Prototype Mode must remain completely unaffected by Strategy Mode code.
- All Strategy Mode rules must be gated by `s.opts.mode === 'strategy'` checks.
- Do not activate partial Strategy Mode rules.
- All existing Fast Prototype tests must continue to pass when mode is 'fast'.
- Add separate Strategy Mode tests — do not modify existing ones.

---

## Implementation Notes

Add a helper:
```ts
export function isStrategy(s: GameState): boolean {
  return s.opts.mode === 'strategy';
}
```

Use this guard before every strategy-mode branch in the engine.

---

## Tests to Run

```
npx tsc -b
npx vitest run
npm run build
```

Add new test files as appropriate to whichever single sub-feature is picked
next — see the Implementation Notes above. Do not build a shared
`strategyMode.test.ts` gated by a mode toggle; each sub-feature is
independent and should get its own focused test file, same pattern as
`recoveryBonus.test.ts`, `strongDemand.test.ts`, etc.

---

## Completion Checklist

Superseded by the Implementation Notes table above — there is no longer a
single "Strategy Mode" to complete. Track each sub-feature's own completion
independently once it's picked up:

- [ ] Market Event Pre-Trade
- [ ] Same-Sector Rebalance (needs its own trigger — see notes above)
- [ ] IPO Volatility Categories (hook into `marketMeter.ts`/`moveEventPrice`, not "on buy")
- [ ] Known IPO Discount
- [ ] Diversified Portfolio salary bonus (re-price against current $750 salary first)
- [ ] Trading Fees/Commissions
- ~~Extended Hours~~ — already shipped, different implementation
- ~~Advanced Weak Demand~~ — dropped, conflicts with the current tuned mechanic
