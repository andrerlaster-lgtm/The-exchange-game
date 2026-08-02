# THE EXCHANGE — 3D Board Design Brief (for Claude Design)

**Purpose of this file:** ground Claude Design in exactly what exists today in the working 3D board (`public/board-3d.html`), so it can propose a **better visual concept**, not a functional redesign. Nothing here should be read as "build this from scratch" — most of the mechanics below are already implemented and working. The ask is a **visual/art-direction upgrade**.

---

## 1. Short Description of The Exchange

**THE EXCHANGE** is a local (hot-seat / pass-and-play) multiplayer stock-market board game for 2–6 players on one device. Players roll dice, move around a 36-space board, buy and sell stocks/ETFs whose prices move on a shared 12-step price ladder, draw event cards that shake up the whole market, use margin, and try to build a diversified portfolio. The game ends at **Market Close**; the winner has the highest **cash + share value − margin owed**.

The game has a 2D "Trading Desk" UI (React) for actual play, and a separate **3D board view** (`public/board-3d.html`, vanilla Three.js) that mirrors the 2D game state in real time — it's a spectator/ambience view: dice, tokens, prices, card draws, and turn order all animate live as the 2D game is played. Source of truth is the 2D engine; the 3D board is a pure renderer driven by a state payload.

---

## 2. Current Board Structure

- **36 spaces** arranged as a square perimeter loop on a 10×10 grid (no spaces in the interior cells — those form the open center).
- Layout order: top row (spaces 1–10, left→right), right column (11–18, top→bottom), bottom row (19–28, right→left), left column (29–36, bottom→top).
- **Corners** at spaces 1, 10, 19, 28 are visually distinct (darker tile background).
- **Center panel**: a large flat square (roughly 8 tile-widths across) sitting inside the loop. Currently shows a baked canvas texture with the game logo ("THE / EXCHANGE / STOCK MARKET GAME / EST. 2025") and hosts the four card decks (see §8).
- There is **no separate physical "Trading Desk Mat"** in the 3D view — that concept exists only in early paper-prototype notes. In the live game, trading/portfolio/price-track UI lives in the 2D screen; the 3D view is board + decks + tokens only.
- Camera: fixed-ish perspective (45° FOV) looking down at the board from above/behind, with OrbitControls (user can rotate/zoom, clamped 5–35 units distance).
- Tile geometry: each space is a thin 3D box (`TILE=1.15` units square, `SPACE_H=0.12` tall) with a canvas-texture top face. A thin emissive sector-color strip sits on the outer edge of each tile. Special spaces get a small colored point light above them.

---

## 3. Full 36-Space Board Layout (current, authoritative)

This is the real, currently-implemented layout — not the older paper-prototype draft. **22 stocks** (not 24) + **4 ETFs** occupy most of the ring; the rest are special spaces.

| # | Space | Type | Notes |
|--:|---|---|---|
| 1 | MARKET OPEN | corner / open | Start space, collect salary on pass/land |
| 2 | CloudCore AI (CCAI) | stock — Technology | High risk, $1,000 base |
| 3 | SafeMart Stores (SAFE) | stock — Consumer | Low risk, $500 base |
| 4 | GROWTH FUND (GRW) | ETF | $5,000 fixed price |
| 5 | MediCore Health (MEDI) | stock — Healthcare | Med risk, $750 base |
| 6 | OilWorks Energy (OILW) | stock — Energy | Med risk, $1,000 base |
| 7 | THE FED | fed | Draw Fed Rate card |
| 8 | FirstTrust Bank (FTRB) | stock — Finance | Low risk, $1,250 base |
| 9 | MetroHomes REIT (MTRO) | stock — Real Estate | Low risk, $1,000 base |
| 10 | IPO | corner / ipo | New listing enters the market |
| 11 | IronRail Logistics (IRON) | stock — Industrials | Low risk, $750 base |
| 12 | StreamWave Media (STRM) | stock — Comms/Media | High risk, $1,000 base |
| 13 | INCOME FUND (INC) | ETF | $5,000 fixed price |
| 14 | CyberShield Systems (CYBS) | stock — Technology | High risk, $750 base |
| 15 | FreshBite Foods (FRSH) | stock — Consumer | Low risk, $250 base |
| 16 | THE FED | fed | Draw Fed Rate card |
| 17 | BioQuest Labs (BIOQ) | stock — Healthcare | High risk, $1,000 base |
| 18 | SolarGrid Power (SOLR) | stock — Energy | High risk, $750 base |
| 19 | MARKET EVENT | corner / event | Draw Market Event card |
| 20 | PayWave Credit (PAYW) | stock — Finance | Med risk, $750 base |
| 21 | TowerPoint Realty (TWPT) | stock — Real Estate | Med risk, $1,250 base |
| 22 | PROPERTY FUND (PROP) | ETF | $5,000 fixed price |
| 23 | BuildMax Materials (BLDM) | stock — Industrials | Med risk, $500 base |
| 24 | VitalSign Devices (VSGN) | stock — Healthcare | Low risk, $750 base |
| 25 | PORTFOLIO TAX | tax | Pay tax on cash |
| 26 | THE FED | fed | Draw Fed Rate card |
| 27 | SneakerStreet (SNKR) | stock — Consumer | Med risk, $750 base |
| 28 | IPO | corner / ipo | New listing enters the market |
| 29 | CarePlus Clinics (CARE) | stock — Healthcare | Low risk, $500 base |
| 30 | ENERGY FUND (ENE) | ETF | $5,000 fixed price |
| 31 | AFTER-HOURS | after | Draw After-Hours card |
| 32 | Apex Investments (APEX) | stock — Finance | High risk, $1,500 base |
| 33 | RentWell Properties (RENT) | stock — Real Estate | Low risk, $750 base |
| 34 | AUDIT NOTICE | audit | Special event space |
| 35 | AeroLift Manufacturing (AERO) | stock — Industrials | Med risk, $1,000 base |
| 36 | GameBox Studios (GMBX) | stock — Comms/Media | High risk, $500 base |

**Sector colors** (used for tile strips, tooltips, tokens):

| Sector | Color | Glyph |
|---|---|---|
| Technology | `#4DA3FF` (blue) | ◆ |
| Consumer | `#F0C53D` (yellow) | ● |
| Healthcare | `#2DD4BF` (teal) | ✚ |
| Energy | `#FF9442` (orange) | ▲ |
| Finance | `#3ED598` (green) | ■ |
| Real Estate | `#A78BFA` (purple) | ⌂ |
| Industrials | `#9AA5B1` (gray) | ▮ |
| Comms/Media | `#F87171` (red) | ▶ |

---

## 4. Space Types

The full type system (`SpaceType`) includes: `open`, `stock`, `event`, `fed`, `ipo`, `tax`, `free`, `short`, `after`, `placeholder`, `etf`, `audit`.

**Currently placed on the board:** `open` (Market Open), `stock` (22 spaces), `etf` (4 spaces), `fed` (3 spaces — 7, 16, 26), `ipo` (2 spaces — 10, 28), `event` (1 space — 19, "Market Event"), `tax` (1 space — 25, "Portfolio Tax"), `after` (1 space — 31, "After-Hours"), `audit` (1 space — 34, "Audit Notice").

**Not currently placed / inactive:** `free` ("Free Trading Day") and `short` ("Short Sell") exist as type values but have **no board space** — Short Sell was removed from the game and must **not** be reintroduced. `placeholder` is a reserved type for future use.

Each special space has: a display label, a glyph, and a hex accent color, defined in `src/data/boardSpaces.ts`.

---

## 5. Current Stock Tile Information Shown in 3D

**On the tile itself** (always visible, baked into a canvas texture on the tile's top face):
- Sector-color strip across the top ~7% of the tile
- Ticker code, large, in the sector color (e.g. "CCAI")
- Live price, formatted (e.g. "$1k", "$1,250") — **only when price data has synced**
- A small colored direction glyph next to price: ▲ green if up from base, ▼ red if down, nothing if flat

**On hover (tooltip, HTML overlay, follows cursor):**
- Stock spaces: `CODE · Company Name`, then `Space N · Sector Name`, then the live price line with direction glyph and color
- Special spaces: space name + `Space N`
- Deck stacks (see §8): deck name + glyph, its purpose line, and "`N cards left`"

**Not currently shown anywhere in 3D:** dividend amount, risk level (Low/Med/High), shares remaining in supply, sector icon/glyph on the tile itself. These exist in the data model and are used in the 2D UI, but are not surfaced visually on the 3D tiles — worth considering as an enhancement, not a requirement.

---

## 6. Current 3D Features Already Working

All of the following are implemented and functioning in `public/board-3d.html` today:

- **Live stock prices** — tile textures redraw whenever the price payload changes (`refreshStockTiles`), showing current price + up/down direction vs. the stock's starting price.
- **Hover tooltips** — raycasting against all tiles and deck meshes; tile lifts slightly on hover, cursor becomes a pointer, tooltip HTML follows the mouse.
- **Per-space hop movement** — when a player moves, their token doesn't teleport; it hops space-by-space along the path (`HOP_DURATION = 0.24s` per hop, `HOP_HEIGHT = 0.42` units arc height), so a move of 5 spaces plays as 5 little bounces along the route.
- **Landing pulse** — when a hop sequence ends, an expanding colored ring (`PULSE_LIFE = 0.8s`) spawns at the destination tile in the moving player's color, then fades out.
- **Turn spotlight** — a glowing ring sits under the current player's token, gently pulsing in size/brightness, and follows whichever token is "up" as turns change.
- **Player tokens** — each player is a colored circular token with an emoji piece (bull 🐂, bear 🐻, money bill 💵, laptop 💻, calculator 🧮, vault 🏦) billboarded to always face the camera; co-located tokens on the same space get small offset positions so they don't overlap; token pool rebuilds if player count changes.

The whole view is driven by a one-way state payload (`Board3DPayload`, written to `localStorage` + a `storage` event) from the 2D game — the 3D board never has its own game logic, only rendering + a small set of outbound commands (roll / draw / end turn / buy / sell) for optional interactivity.

---

## 7. Current Visual Problems / Improvement Goals

This is the part Claude Design should focus on:

- **Tiles are flat baked-canvas text**, not illustrated. No icon, no texture/material variation beyond a flat color strip — reads more like a spreadsheet cell than a collectible board tile.
- **Center panel is a single static canvas texture** (logo + subtitle + a faint radial vignette). It doesn't feel like part of a designed game board; it reads like a placeholder title screen.
- **Overall palette is functional but "prototype," not "premium"**: dark brown/black background (`#16120d`), gold accent (`#d4a535`), IBM Plex Mono everywhere. It communicates "trading terminal at night" but doesn't yet feel like a manufactured tabletop game.
- **No dividend/risk/supply info on tiles** — only visible in the 2D game or in a hover tooltip, so the board itself under-communicates stock identity at a glance.
- **Lighting/materials are basic Three.js standard materials** — functional PBR-ish setup (directional + ambient + fill + point lights per special space) but no baked-in "premium tabletop" material language (e.g. felt, lacquered wood, embossed metal, varnished card stock).
- **Deck area (see §8) already works functionally** but was added utilitarian-first — it would benefit from being integrated into an overall board art style rather than looking like a separate later addition.

---

## 8. Center Deck System — Already Implemented, Needs Visual Direction

**Important: this already exists and works.** Four physical card-stack decks sit inside the center panel, each independently:

| Deck | Label | Glyph | Color | Trigger | Deck size |
|---|---|---|---|---|---|
| Market Event | MARKET EVENT | ◈ | `#ef4444` (red) | Drawn on every Market Open pass/land | 18 cards |
| Fed | THE FED | % | `#d4a535` (gold) | Drawn when landing on a Fed space | 12 cards |
| After-Hours | AFTER-HOURS | ☾ | `#a78bfa` (purple) | Drawn when landing on After-Hours | 12 cards |
| IPO | IPO | ↑ | `#4ade80` (green) | New listing launches on IPO spaces | 8 (unrevealed listings) |

Current behavior:
- Each deck renders as a **stack of up to 8 thin card-layer meshes** plus a textured **top card** showing a canvas-drawn card back (dark base, colored frame, glyph medallion, "THE EXCHANGE / STOCK MARKET GAME" branding, colored label band at the bottom).
- **Stack height visually shrinks** as the deck depletes (`updateDeckCounts`), proportional to cards remaining out of the deck's starting total; an empty deck's top card goes translucent.
- **Hovering a deck** lifts the whole stack slightly and shows a tooltip with the deck's purpose and remaining count.
- **Drawing a card animates**: the top card lifts off the deck, glides to a reveal point in front of the camera, flips from back-texture to a face texture showing the drawn card's title, holds briefly while billboarded to the camera, then fades out. This is driven by a `drawEvent` field in the sync payload (`{ deck, title, seq }`) — a new `seq` value triggers a new draw animation.
- Decks sit at fixed positions inside the center panel (`ME` at back-left, `FED` center-left, `AH` center-right, `IPO` back-right, all offset from center) — positioned so they don't overlap the outer 36-space ring, and currently sit below/around the logo texture area.

**What Claude Design should actually do here:** propose a better *visual identity* for these four decks and the center panel as a cohesive whole — e.g. more game-like card-back art per deck (beyond a glyph + color), a center panel design that visually "hosts" the decks instead of decks sitting on top of an unrelated logo texture, and clearer stack materiality (paper/cardstock feel vs. flat color boxes). This is an art-direction pass on an existing, working system — not new functionality.

---

## 9. Visual Style Direction

Target feel:

- **Premium tabletop stock-market game** — should look like something a company would actually manufacture and box, not a wireframe or an app screen.
- **Modern trading desk energy** — sleek, confident, a little high-stakes, but still warm and tactile (this is a board game people play at a table, not software they operate).
- **Game-like, not childish** — sophisticated color and material choices, not primary-color cartoon shapes; think a well-designed strategy/economic board game (e.g. the production quality of modern Kickstarter-tier tabletop games), not a kids' edu-game.
- **Financial, but not just a Bloomberg terminal** — market/finance motifs (tickers, charts, exchange imagery, sector iconography) are welcome, but the whole board shouldn't look like a monitor full of green-on-black data. It should feel like an object, not a dashboard.

Current baseline to evolve from (not necessarily to keep): background `#16120d` (near-black warm brown), primary accent `#d4a535` (antique gold), monospace body font (IBM Plex Mono), display font import already present but unused for a title lockup (Anton). Sector colors (§3 table) are functional and can likely stay since they're used for game-legibility (diversification at a glance), but their *application* (flat strip vs. richer material) is open.

---

## 10. Constraints

Hard constraints Claude Design's concept must respect:

- **Preserve the 36-space board** exactly as laid out in §3 — do not add, remove, renumber, or resize spaces.
- **Preserve existing game rules** — this is a visual pass only; nothing about how the game plays should change.
- **Do not bring back Short Sell.** The `short` space type exists in the type system for historical reasons but has no active board space. Do not design a "Short Sell" tile or space.
- **Do not invent new space types or spaces.** Work within: Market Open, 22 stocks, 4 ETFs, The Fed (×3), IPO (×2), Market Event, Portfolio Tax, After-Hours, Audit Notice.
- **Center decks (§8) must not block or visually crowd the readable 36-space ring** — they live inside the center panel only.
- **The design must be realistic for Claude Code to implement inside the current 3D board.** The board is a single self-contained `public/board-3d.html` file using vanilla Three.js (no React, no external asset pipeline beyond Google Fonts + CDN Three.js/OrbitControls). Visual concepts should translate to: canvas-drawn textures, Three.js standard/basic materials, simple geometry (boxes, planes, rings), and CSS-based HUD overlays — not techniques requiring a build pipeline, external 3D model imports, or a framework migration, unless explicitly flagged as a bigger follow-up.
- The **state payload contract** (`Board3DPayload` in `src/utils/sync3dBoard.ts`) is the only bridge from the 2D game to the 3D view and should be treated as fixed — the visual redesign works with the data already available (positions, prices, dice, decks, current player, etc.), not new data.

---

## Prompt for Claude Design

Copy the text below into Claude Design with this file attached:

> I'm redesigning the visual look of "The Exchange," a tabletop-style stock-market board game that currently exists as a working 3D board (Three.js, single HTML file). The attached brief documents the current 36-space board layout, the space types, what's already implemented and working (live prices, hover tooltips, per-space token hop movement, landing pulses, turn spotlight, player tokens, and a fully functional center card-deck system with four decks, card backs, and draw animations), and the current visual problems.
>
> I want a **premium tabletop stock-market game** look — modern trading-desk energy, game-like but not childish, financial without being a literal Bloomberg terminal. Please propose a visual concept for: the board tiles (stocks, ETFs, and special spaces), the center panel and its four card decks, the overall color/material direction, and typography — while preserving the exact 36-space layout, space types, and game rules described in the brief. Do not reintroduce "Short Sell" and do not invent new spaces. The result needs to be realistic to implement in a single Three.js HTML file (canvas textures, basic materials, simple geometry, CSS overlays) so Claude Code can build it directly from your concept.
