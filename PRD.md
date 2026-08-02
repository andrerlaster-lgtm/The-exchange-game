# THE EXCHANGE — Product Requirements Document

*Draft for review · 2026-06-13 · prototype-first scope*

---

## 1. App Overview

**THE EXCHANGE** is a local (hot-seat / pass-and-play) multiplayer stock-market board
game for **2–6 players** on a single device. Players roll dice to move around a
36-space board, trade stocks whose prices live on a shared 12-step price ladder, draw
event cards that move the whole market, take loans, short-sell, and chase a
diversified portfolio. The game ends at **Market Close**; the winner has the highest
**cash + share value − loans**.

A complete, working prototype already exists as a single self-contained
`index.html` (vanilla JS, ~1,350 lines ported from the Claude Design mockup). All
core rules are implemented and verified end-to-end. **This PRD is about turning that
proven prototype into a clean, maintainable, extensible codebase** — not building from
zero.

---

## 2. First-Version Goal

Ship a **quick, clean, playable web prototype** that any group can open in a browser
and play start-to-finish on one screen — no backend, no login, no install. Reuse the
already-working game logic; the v1 effort is mostly *restructuring* it into a testable
core plus a component-based UI, not re-deriving the rules.

Success = "5 people sit around a laptop and finish a game without confusion or bugs."

---

## 3. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Build/dev | **Vite** | Instant dev server, zero-config, fast HMR; outputs a static bundle that drops anywhere. |
| Language | **TypeScript** | The game state has many interacting fields (prices, supply, shorts, skips, decks). Types catch the class of bugs that hurt most here. |
| UI | **React 18** | Component reuse for the 6 repeated board cells / trade rows / standings; large ecosystem. |
| Game state | **Zustand + Immer** | The logic is one big reducer over a single state object — exactly Zustand's sweet spot. Immer lets us keep the prototype's "mutate a draft" style (it already uses `JSON.parse(JSON.stringify())` + mutate). |
| Styling | **Plain CSS / CSS Modules** (inline styles already exist) | The mockup is fully styled with inline styles; port as-is first, extract tokens later. No Tailwind needed for v1. |
| Randomness | **Built-in `Math.random` for v1**, with a thin `rng` wrapper | Wrapper lets us swap in a seeded RNG later for replay/testing without touching game logic. |
| Tests | **Vitest** | Same toolchain as Vite; unit-test the pure game-logic functions (the high-value target). |

**Why not a heavier framework:** see §4 on boardgame.io. Short version — it's the most
*conceptually* aligned tool, but adopting it means rewriting our logic into its
move/phase API. For a fast prototype that already works, that's premature. Keep it on
the table for the online-multiplayer phase.

---

## 4. Useful Libraries / Tools Found (research)

### Board-game engines

- **[boardgame.io](https://boardgame.io/)** ([GitHub](https://github.com/boardgameio/boardgame.io), [npm](https://www.npmjs.com/package/boardgame.io)) — State management + multiplayer networking for turn-based games. You write game logic as pure functions (`moves`, `turn`/`phases`); it handles state sync, turn order, storage, hot-seat *and* online, optional bots, and has a React client. **Strong conceptual fit** — our turn/phase/move structure maps almost 1:1. **Trade-off:** requires restructuring the existing logic into its API and adopting its conventions. **Recommendation: defer to Phase 2/3** when we want online multiplayer or AI opponents; not worth the rewrite for a local prototype that already runs.

### State management (for the React port)

- **[Zustand](https://www.npmjs.com/package/zustand)** — minimal hook-based store, little boilerplate, scales well. **Recommended primary.**
- **[Immer](https://immerjs.github.io/immer/)** — write "mutating" updates against an immutable draft; matches our current mutate-style reducer.
- **[XState](https://stately.ai/docs)** — state machines. Our turn flow (preRoll → rolled → resolve card/pick/short/IPO → end) is genuinely a state machine; XState would make illegal states unrepresentable. **Optional** — nice for taming the `blocked()`/phase logic, but adds a learning curve. Consider if turn-flow bugs become a pain point.
- Avoid **Recoil** (archived by Meta, early 2025).

### Dice / randomization

- **[@3d-dice/dice-box](https://www.npmjs.com/package/@3d-dice/dice-box)** — polished 3D physics dice, framework-agnostic, <1 MB. Best if we want a "wow" dice roll.
- **[react-dice-complete](https://github.com/AdamTyler/react-dice-complete)** — simple 2D animated dice React component, low effort.
- **[davidbau/seedrandom](https://github.com/davidbau/seedrandom)** / **[prando](https://github.com/zeh/prando)** — seedable PRNG for deterministic games (reproducible decks, replay, testing). **Recommended for the `rng` wrapper** even in v1 — costs nothing and pays off in tests.
- Our current 2D CSS dice are fine for v1; treat 3D as a polish item.

### Card / deck logic

- No heavyweight "deck engine" is warranted — our decks are just shuffled index arrays with a discard pile, already implemented. A **Fisher-Yates shuffle** (≈5 lines, or via the seeded-RNG lib) covers it. Don't pull in a dependency for this.

### Local multiplayer reference

- boardgame.io's hot-seat/pass-and-play examples and its "notable projects" (Forbidden Desert, Azul clones) are the best reference implementations for single-device turn passing.

---

## 5. Features for Phase 1 (the playable prototype)

Everything already working in the prototype — port it faithfully:

- 2–6 player setup (names, colors, $10,000 start)
- 36-space board with live prices, supply counts, special spaces, player tokens
- Two-dice roll + counter-clockwise movement; Market Open income + dividends on passing
- Trading Desk / action panel with **conditional buy/sell** (no trade before rolling; stock-space trades restricted to that stock; Market Event = one trade then draw; Free Trading Day = one trade)
- 12-step shared price ladder; buy ▲1 step / sell ▼1 step; 10-share supply per stock
- Player portfolios + live standings
- Three card decks with a working effect engine: **Market Event, Fed Rate, After-Hours**
- **IPO** space + IPO market (launch / buy known)
- **Short Sell** tracker (settles next turn, fixed payout table)
- Loans, **Diversified Portfolio** badge + bonuses, weak-demand skip tokens
- **Market Close / Extended Hours** end condition → **Final Bell** scoring screen
- Market log

**New in the port (not in mockup but cheap and high-value):**

- Unit tests on the game-logic core
- A "rules / how to play" panel or modal (currently rules are implicit)

---

## 6. Features to Delay Until Later

- **Online multiplayer** (→ boardgame.io or a small WS server)
- **AI / bot opponents**
- **Save / resume** (localStorage snapshot is a small later add)
- **Animated token movement** and price-tick transitions; 3D dice
- **Full 84-card decks** (prototype ships curated subsets — 18 ME / 12 FED / 12 AH)
- **Configurable rules** (starting cash, salary, loan interest, win condition)
- **True simultaneous Free Trading Day** (all players act, not just current)
- **Crash Shield** mechanic (conflicts with a single shared price track — needs design)
- Real per-company **printed dividend values** (currently derived from risk tier)
- Mobile/responsive layout (v1 targets a wide desktop screen, 1520px)
- Sound, theming, accessibility pass, i18n

---

## 7. Core Screens

1. **Setup** — player count selector, editable name rows, start button.
2. **Game** (the main screen) — composed of:
   - Top bar (current player, phase hint, Market-open/close status, Test toggle, New Game)
   - Board (36 cells + center dashboard with dice and the 3 deck piles)
   - Control column (current-player card with roll/end/loan buttons → context-aware action panel → portfolio)
   - Price Track (24 company tiles)
   - IPO Market (8 listings)
   - Short Sell Tracker + Market Log
   - Standings
3. **Game Over / Final Bell** — ranked standings with cash/shares/loans breakdown, New Game.

---

## 8. Core Game Logic

Organize as a **pure core** (no DOM) so it's testable and engine-agnostic:

- **Setup:** build players, reset prices/supply/decks/IPOs.
- **Turn loop:** `preRoll → roll → applyMove → (payMarketOpen if passed) → resolveLanding → [resolve card / pick / short / IPO / trade] → endTurn → settleShorts → next player`.
- **Movement:** 2d6, wrap at 36, detect passing Market Open.
- **Landing resolution** by space type: stock / event(ME) / fed / after / ipo / free / short / tax / open.
- **Trading rules:** `canTradeNow` gate; buy/sell move price ±1 and adjust supply; scope enforcement (stock vs one-free-trade).
- **Price engine:** clamp to ladder steps 0–11; event effects (sector / all / risk / multi / lowest / highest / pick); IPO volatility amplifies moves.
- **Decks:** shuffled index arrays + discard, reshuffle on empty.
- **Shorts:** one per player, fixed payout by step delta, settle at owner's next turn.
- **Diversified portfolio:** 5 sectors × ≥2 shares, no loan → dividend bonus + rebalance protection.
- **Skip / weak-demand tokens:** distinct skippers, threshold drop (3, or 4 if a heavy holder), once per lap.
- **Market Close:** immediate end unless an Extended-Hours holder exists → final round.
- **Scoring:** `net = cash + shareValue − loans`.

(All of the above already exists and is verified — the work is *extracting* it into a typed module with tests.)

---

## 9. Data Structures Needed

```ts
type SpaceType = 'stock'|'event'|'fed'|'after'|'ipo'|'free'|'short'|'tax'|'open';

interface Stock { code; name; sector; base; risk:'Low'|'Med'|'High'; space; step; color; div }
interface Ipo   { code; startStep; step; supply; revealed }
interface Card  { deck:'ME'|'FED'|'AH'; title; story; effect; eff: Effect }
type Effect = { k:'sector'|'all'|'risk'|'multi'|'lowest'|'highest'|'pick'|'cash'|'margin'|'extend'|'close'|'none'; ... }

interface Player { name; color; cash; pos; shares: Record<code, qty>; loans; eh; rebalanceUsed }

interface GameState {
  phase: 'setup'|'play'|'over';
  players: Player[]; cur: number;
  turnPhase: 'preRoll'|'acted'; dice:[n,n]; rolling;
  prices: Record<code, step>; supply: Record<code, n>;
  skips: Record<code, playerIdx[]>; skipDropped: Record<code,bool>; lap;
  decks: { ME:n[]; FED:n[]; AH:n[] }; discard: {...};
  ipos: Ipo[]; trade; pendingDraw; card; pick; shortPick;
  ipoChoice; ipoListPick; ipoBuy;
  shorts: Short[]; closing; closeDrawer; testMode; log: LogEntry[];
}
```

Static data (board layout, stock table, IPO table, card decks, palettes) lives in a
separate `data.ts` — it's constant and already fully specified.

---

## 10. Risks / Hard Parts

- **Turn-flow state explosion** — many mutually-exclusive sub-states (pendingDraw, pick, shortPick, ipoChoice/list/buy, trade scope). The `blocked()` gate works but is fragile. *Mitigation: cover with tests; consider XState if it keeps biting.*
- **Shared price track vs per-player effects** — Crash Shield can't work cleanly on one global ladder; flagged as a design question, deliberately deferred.
- **Open rules questions** (carried over from the design chat): base income amount, dividend-bonus interpretation, real printed dividends, skip-token reset semantics. *These need your sign-off before "finalizing" rules — fine to ship prototype with current defaults.*
- **Determinism for testing** — `Math.random` everywhere makes tests flaky. *Mitigation: route all randomness through one injectable `rng`.*
- **Scope creep** — boardgame.io / online multiplayer / AI are tempting but would stall the prototype. Keep them in Phase 2+.
- **Layout is fixed-width (1520px)** — fine for a desktop prototype; responsive is real work, deferred.

---

## 11. Suggested Build Order

1. **Scaffold** Vite + React + TS; drop in fonts and global styles.
2. **Extract the core** — move the existing `Component` logic into a pure, typed
   `engine/` module (`data.ts`, `state.ts`, `reducer.ts`, `rng.ts`). No UI yet.
3. **Write tests** for the engine (turn loop, trading rules, price effects, scoring,
   market close). Lock in the behavior the prototype already proves.
4. **Wire Zustand store** around the reducer (one action dispatcher).
5. **Build UI components** mirroring the current screens: `Setup`, `Board`,
   `ControlColumn` (PlayerCard / ActionPanel / Portfolio), `PriceTrack`, `IpoMarket`,
   `ShortTracker`, `Log`, `Standings`, `GameOver`. Port inline styles as-is.
6. **Playtest a full game** on one screen; fix flow bugs.
7. **Add the cheap wins** — rules/help panel, seeded RNG toggle, localStorage save.
8. **Polish later** — animations, 3D dice, full decks, responsive, then evaluate
   boardgame.io for online multiplayer.

---

### Sources
- [boardgame.io](https://boardgame.io/) · [GitHub](https://github.com/boardgameio/boardgame.io) · [npm](https://www.npmjs.com/package/boardgame.io)
- [Zustand (npm)](https://www.npmjs.com/package/zustand) · [Immer](https://immerjs.github.io/immer/) · [XState](https://stately.ai/docs)
- [React state management comparison, 2026](https://www.brilworks.com/blog/react-state-management-libraries/)
- [@3d-dice/dice-box](https://www.npmjs.com/package/@3d-dice/dice-box) · [react-dice-complete](https://github.com/AdamTyler/react-dice-complete)
- [seedrandom](https://github.com/davidbau/seedrandom) · [prando](https://github.com/zeh/prando) · [random-seedable](https://github.com/ChrisAkroyd/random-seedable)
