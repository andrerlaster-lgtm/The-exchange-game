# Eve Bot Player — Plan

**Status:** Researched, not started. Saved 2026-08-03 to come back to later.
**Goal:** An automated bot player for The Exchange, built on Vercel's [Eve](https://vercel.com/docs/eve) agent framework, that can play a round of the game on its own — the mechanism behind the original idea of having the morning scheduled task "play a round" of the game.

## Why Eve

[Eve](https://eve.dev/) is Vercel's open-source, filesystem-first framework for durable backend AI agents (currently in beta, launched ~June 2026). An agent is a folder: `agent/instructions.md` (what it knows), `agent/tools/*.ts` (what it can do — one file per tool, filename becomes the tool name), `agent/agent.ts` (model config).

What makes it a good fit here specifically:

- **Durable sessions** — each conversation is a checkpointed workflow that survives a crash, redeploy, or long pause and resumes where it left off. A multi-turn game round fits this shape naturally.
- **Sandboxed execution** — agent-generated code runs isolated by default.
- **Approval gates** — any action can be set to pause and wait for human approval before continuing, if that's ever wanted for a real-money or high-stakes mode.
- **Deploys on Vercel** — same platform the game is already deployed on.

Ruled out for comparison: browser-automating the live deployed site (clicking through the real UI) — rejected as fragile, since the earlier game audit already found a broken mobile layout and a few rule bugs, and unattended clicking risks getting stuck with no one watching.

## Why The Exchange's engine is a strong fit

The whole engine routes through one function: `reduce(state, action, rng)` — a pure, typed reducer (Redux + Immer pattern), already fully decoupled from the UI. `Action` is a clean discriminated union (`src/engine/types.ts`) with roughly 35 action types, each with its own typed payload:

```ts
export type Action =
  | { t: 'roll' }
  | { t: 'buy'; code: string }
  | { t: 'sell'; code: string; qty?: number }
  | { t: 'buyEtf'; code: string }
  | { t: 'takeMargin' }
  | { t: 'proposeP2POffer'; from: number; to: number; code: string; qty: number; direction: 'sell'|'buy'; price: number }
  | ... // ~35 total, see src/engine/types.ts
```

This maps almost one-to-one onto Eve's tool model: each action type becomes one `agent/tools/*.ts` file, and the tool's `execute()` just calls `reduce()` and returns the new state. No adapter layer needed — the engine is already the tool surface.

## What it would actually take

1. **A new Eve agent project** (`npx eve@latest init`) — separate from the game's Next.js app, but importing `src/engine/` directly as a dependency. It's pure TypeScript with no UI coupling, so this is a clean import, not a rewrite.
2. **~5–8 tools, not all 35 action types** — enough to cover a normal round:
   - `roll` — rolls dice, resolves move + landing
   - `buy` — buy out a regular-stock company
   - `sell` — sell shares back to the bank
   - `buyEtf` / `skipEtf`
   - Whatever IPO/landing-fee actions come up mid-turn (`pickKnownIpo`, `ipoBuyShare`, `payLandingFee`, `deferLandingFee`, etc.)
   - An end-turn equivalent
   Each tool's Zod input schema mirrors that action's existing TypeScript payload shape almost exactly.
3. **`agent/instructions.md`** — genuinely new writing, not reused from anywhere. Needs to describe actual strategy: when to buy vs. hold cash, risk tolerance, how to react to market events. Nothing in the codebase does this today — the test suite only scripts fixed move sequences (`Audit One`, `Audit Two`), it has no decision-making logic to draw from.
4. **State handling** — Eve's durable sessions checkpoint automatically, so `GameState` can live in the session between tool calls. No separate database needed for a single ongoing game.
5. **Deployment** — alongside the existing Vercel project, or as its own Eve deployment that a scheduled task calls via HTTP to kick off a session.

## What's reused vs. net-new

| Reused as-is | Net-new |
|---|---|
| `src/engine/*` (reducer, actions, rules, types) | The Eve agent project scaffold itself |
| The `reduce(state, action, rng)` entry point | Tool wrapper files (thin — mostly schema + one `reduce()` call each) |
| `initialState`, `freshDecks`, `freshIpos` for setup | `agent/instructions.md` — actual playing strategy |
| — | Wiring the scheduled morning task to trigger a session (if that's still wanted) |

## Open questions for when this gets picked back up

- Does the bot play against a real human player (Andre), or run a full solo/two-bot round unattended for a "smoke test + recap" each morning?
- What should the morning report actually contain — pass/fail only, or an actual play-by-play recap?
- Where does the Eve agent project live — inside `The-exchange-game/` as a sibling app, or a fully separate repo?
- Does this replace or sit alongside the existing `npm test` engine test suite?

## Related

- [[The-exchange-companies-concept]] and its sibling docs in this folder — the game's other design docs
- [[04 Systems/On My Way Mobile Labs/Dashboard|On My Way Mobile Labs Dashboard]] and the vault's `auto-prompt` scheduled task — the original context this idea came from (having the morning routine "play a round")
