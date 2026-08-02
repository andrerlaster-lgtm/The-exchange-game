# 09 — Game Setup Options

**Phase:** 4 — Game Setup Options
**Priority:** Later
**Status:** Pending

---

## Goal

Let players customize the game before starting instead of always using hardcoded defaults.

---

## Why It Matters

Different groups have different play styles and time constraints. Setup options make THE EXCHANGE accessible to casual and competitive players without changing the core rules.

---

## User-Facing Behavior

The setup screen (before "Start Game") includes:

```
NUMBER OF PLAYERS:   [ 2 ] [ 3 ] [ 4 ] [ 5 ] [ 6 ]

PLAYER NAMES:        Morgan / Riley / Avery / Quinn

STARTING CASH:       [ $10,000 ] [ $15,000 ] [ $20,000 ]

GAME MODE:           [ Fast Prototype ] [ Strategy Mode ]

OPTIONAL RULES:
  Short Sell:        [ On ] [ Off ]
  Market Loans:      [ On ] [ Off ]
  IPOs:              [ On ] [ Off ]

MARKET CLOSE:        [ Market Close card ] [ Fixed rounds: 5 / 7 / 10 ]
```

---

## Files Likely Affected

- `src/app/SetupScreen.tsx` — extend with new options
- `src/engine/types.ts` — add `GameOptions` interface
- `src/store/gameStore.ts` — pass options into `initGame()`
- `src/engine/actionResolver.ts` — respect options (e.g. `opts.loans`, `opts.shorts`, `opts.ipos`)
- `src/data/stocks.ts` — `START_CASH` constant may need to become dynamic

---

## Rules That Must Not Be Broken

- Fast Prototype Mode must remain default.
- Strategy Mode must not be partially activated — all or nothing.
- Options that disable features (loans off, shorts off) must fully gate the relevant actions in the engine, not just hide buttons.
- Do not add online multiplayer.
- `GameOptions` must be serializable (plain object, no functions).

---

## Implementation Notes

```ts
// src/engine/types.ts
export interface GameOptions {
  mode: 'fast' | 'strategy';
  startCash: number;
  loans: boolean;
  shorts: boolean;
  ipos: boolean;
  closeMode: 'card' | 'rounds';
  closeRounds?: number;
}
```

Pass `opts` into `initGame(players, opts)`. Store on `GameState.opts`.

In `actionResolver.ts`, check `s.opts.loans` before allowing `takeLoan`, etc.

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

Add tests:
- Game with `loans: false` — `takeLoan` action has no effect or is blocked.
- Game with `shorts: false` — `shortSell` action is blocked.
- Game with `startCash: 15000` — players start with $15,000.

---

## Completion Checklist

- [ ] `GameOptions` type added
- [ ] Setup screen extended with all options
- [ ] `initGame()` accepts and stores `GameOptions`
- [ ] `takeLoan` gated by `opts.loans`
- [ ] `shortSell` gated by `opts.shorts`
- [ ] IPO spaces skipped or inert when `opts.ipos` is false
- [ ] Starting cash uses `opts.startCash`
- [ ] Close mode respects `opts.closeMode`
- [ ] Strategy Mode option exists but does not activate Strategy rules yet (that is improvement 10)
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
