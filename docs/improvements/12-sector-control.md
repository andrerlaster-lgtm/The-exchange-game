# 12 — Sector Control (Rent)

**Phase:** Built
**Priority:** Shipped
**Status:** Implemented (2026-09-15) — see Implementation Notes below for
how the actual mechanics ended up differing from the design below.

---

## Implementation Notes (read this first)

The design below assumed sector ownership could be checked the moment a
player lands on an *untouched* stock, charging rent independently of the
existing Payout Claim. That's not possible in this codebase: a whole
company can only ever be acquired via the all-or-nothing 11-share buyout,
which immediately marks it sold out. So by the time a player could own
**both** companies in a pair (satisfying "owns ≥1 share of both"), both
stocks are necessarily already sold out — but landing on a sold-out stock
was always meant to skip sector rent (the doc's own rule #5). Put
together, rent as originally scoped could never actually fire.

**What shipped instead:** Sector Rent now stacks on top of the normal
Payout Claim, rather than replacing the "no payment today" case on an
untouched landing. When the claim holder on a sold-out landing also
exclusively controls both companies in that stock's pair, the flat Sector
Rent is added to the usual per-share Payout Claim as one combined charge
(one `landingNotice`/`payoutShortfallChoice`, e.g. "$2,000 Payout Claim +
$200 Sector Rent = $2,200"). Also, since regular-stock sectors were kept
at their existing 8 broad categories (unchanged — they drive Market
Event/Fed card targeting and the Diversified/Broad Market bonuses),
Sector Control pairs are a **separate, additive `SectorPairId` id space**
layered on top, not a restructuring of `SectorId`. See
`src/data/types.ts` (`SectorPairId`, `SectorPair`), `SECTOR_PAIRS` /
`SECTOR_PAIR_BY_CODE` in `src/data/stocks.ts`, and
`src/engine/sectorControl.ts`.

The rest of this document is the original pre-implementation design and
is kept for history; treat the "Confirmed Decisions" and "Proposed Sector
Restructuring" sections below as superseded by the notes above.

---

## Goal

Let a player who owns every company in a 2-company sector collect rent whenever
another player lands on either company's space — a Monopoly-style color-set
bonus layered onto the existing stock spaces. Rewards concentrated ownership
within a sector, as a counterweight to the existing Diversified/Broad Market
bonuses that reward spreading out.

Mock of how this would read in the actual UI (board tiles, landing banner,
portfolio panel): https://claude.ai/code/artifact/cc081a4e-9cfc-4560-8b52-4a8a8d24b1af

---

## Confirmed Decisions

From discussion so far:

1. **Rent fires on every landing**, not just when the stock is sold out. This
   is new — today, landing on a stock that still has bank supply just opens a
   Trade Step with no payment to other shareholders. Sector rent is a
   brand-new payment layered on top of that.
2. **Sectors restructure to exactly 2 companies each.** Today's 8 sectors are
   uneven (2-4 companies). Splitting the 22 regular stocks into 11 sectors of
   2 makes "owning a sector" a consistent, achievable goal everywhere.
3. **Sector tier (Low/Med/High) is set by the two companies' combined risk**,
   not their price/buyout tier:
   - Both Low risk → Low sector
   - Both High risk → High sector
   - Anything mixed (or both Med) → Med sector
4. **"Owning the sector"** = holding ≥1 regular share of both companies, and
   no other player holds either. Same bar as today's `hasSectorPortfolio`,
   and same "Contested" fallback as sold-out claims if ownership is split
   between two different players (no rent either way).
5. **Interaction with sold-out Payout Claims:** if the landed-on stock is
   sold out, the existing Payout Claim system fires instead — sector rent and
   Payout Claim never stack on the same landing.

---

## Open / Not Yet Decided

- **Exact rent amounts.** Proposed starting point: Low $200 / Med $350 /
  High $550, paid straight to the owner (no forced-sale/loan complexity like
  Payout Claims have). Flagged as likely to need tuning after a playtest —
  this fires far more often than sold-out claims, so it needs to stay modest
  or it'll dominate the economy.
- **Three sectors need cross-category pairing.** Finance (3 companies),
  Real Estate (3), Industrials (3), and Consumer (3) each leave one company
  over once split into pairs within their own sector. Proposed fix pairs the
  6 leftovers into 3 new cross-category sectors:
  - **Blue Chip Alliance** — FTRB (finance) + IRON (industrials) — Low
  - **Capital Growth** — PAYW (finance) + TWPT (real estate) — Med
  - **Speculative Plays** — SNKR (consumer) + APEX (finance) — Med

  Alternative if mixing categories feels wrong: leave those sectors uneven
  (e.g. one 3-company sector) instead of forcing every sector to exactly 2.
- **Sector names/colors for the 3 merged sectors** are placeholders and the
  most negotiable part of this proposal.
- Whether Sector Control should show up anywhere in scoring/ranking beyond
  the direct rent payments (e.g. a leaderboard note), or stay purely a
  gameplay mechanic.

---

## Proposed Sector Restructuring (22 stocks → 11 sectors of 2)

| Sector | Members | Tier | Rent |
|---|---|---|---|
| Tech Sentinels | CCAI · CYBS | High | $550 |
| Consumer Staples | SAFE · FRSH | Low | $200 |
| Health Essentials | CARE · VSGN | Low | $200 |
| Health Innovation | MEDI · BIOQ | Med | $350 |
| Energy Complex | OILW · SOLR | Med | $350 |
| Real Estate Holdings | MTRO · RENT | Low | $200 |
| Heavy Industry | BLDM · AERO | Med | $350 |
| Media & Games | STRM · GMBX | High | $550 |
| Blue Chip Alliance* | FTRB · IRON | Low | $200 |
| Capital Growth* | PAYW · TWPT | Med | $350 |
| Speculative Plays* | SNKR · APEX | Med | $350 |

\* Cross-category pairing (see Open Questions above).

---

## Files Likely Affected (rough guess, not scoped)

- `src/data/stocks.ts` — replace `SECTORS`/`SECTOR_CODES`/sector assignment
  on `RAW_STOCKS` with the new 11 two-company sectors; add per-sector tier
  and rent constants
- `src/engine/sector.ts` — `hasSectorPortfolio`/`completedSectors` already
  do most of the ownership-check work; likely needs a new
  `sectorOwner(s, sector)` helper (single owner vs. contested vs. unowned)
- `src/engine/actionResolver.ts` — `resolveLanding`'s `'stock'` case needs a
  new branch: if not sold out and the sector has a single owner ≠ landing
  player, charge Sector Rent (new `landingNotice` kind, likely `'sectorRent'`)
- `src/engine/types.ts` — new `LandingNotice` kind, or a distinct
  `sectorRentNotice` field if it shouldn't share the existing `canDefer`
  Pay/Carry-as-debt shape (this is a flat toll, not deferrable debt)
- `src/components/game/ActionPanel.tsx` — new banner (mocked as
  `rent-banner` in the design mock, brass instead of red)
- `src/components/game/Portfolio.tsx` — new "Sectors Owned" panel section
- `src/components/game/BoardTrack.tsx` — tile treatment for a
  sector-controlled space (owner ring + band, replacing the risk chip)
- `src/utils/buildBoard3DActionCenter.ts` / `sync3dBoard.ts` — 3D board
  parity, same pattern as the recent player-loan and P2P-barter additions
- Existing Diversified/Broad Market bonus math (`DIVERSIFIED_SECTORS = 3`,
  `BROAD_MARKET_SECTORS = 6`) counts *distinct sectors held*, not completed
  ones — going from 8 to 11 sectors makes both thresholds easier to hit
  incidentally. Worth deciding whether those constants should move up
  (e.g. 4 / 7) to keep the difficulty roughly where it is today.

---

## Rules That Must Not Be Broken

- Never stack with the sold-out Payout Claim on the same landing.
- Never charge rent to the sector owner for landing on their own space.
- A sector split between two different owners is Contested — no rent, same
  as the existing sold-out-claim Contested state.
- IPO and ETF shares never count toward sector ownership (matches
  `hasSectorPortfolio`/`distinctSectors` today).

---

## Tests to Run (once implemented)

```
npx tsc -b
npx vitest run
```

Needs new coverage for: rent firing on a normal (non-sold-out) landing,
Contested sectors never charging rent, sold-out taking priority over sector
rent, and self-landing never charging rent.

---

## Completion Checklist

- [ ] Rent amounts finalized (currently placeholder $200/$350/$550)
- [ ] Cross-category sector pairings finalized or reworked
- [ ] 22 stocks reassigned to 11 two-company sectors in `stocks.ts`
- [ ] Sector ownership/rent resolution added to `resolveLanding`
- [ ] New landing banner UI
- [ ] "Sectors Owned" Portfolio panel section
- [ ] Board tile treatment for sector-controlled spaces
- [ ] 3D board parity (`buildBoard3DActionCenter.ts`, `sync3dBoard.ts`)
- [ ] Diversified/Broad Market thresholds reviewed against the new sector count
- [ ] TypeScript check passes
- [ ] All tests pass
