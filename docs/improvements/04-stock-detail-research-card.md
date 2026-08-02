# 04 — Stock Detail / Research Card

**Phase:** 2 — Stock Simulator Feel
**Priority:** High
**Status:** Pending

---

## Goal

Give every stock more identity and help players make better decisions by showing a full research card for any stock they hover over or select.

---

## Why It Matters

Players currently only see a ticker and price on the board. Without knowing sector, risk, dividend, or volatility, the game feels like blind guessing. A research card teaches real investing concepts and makes stock selection feel meaningful.

---

## User-Facing Behavior

When a player focuses a stock (on the board or during a trade), a Research Card appears:

```
┌─────────────────────────────────────┐
│  CloudCore AI                  CCAI │
│  ◆ Technology          Risk: High ■ │
│─────────────────────────────────────│
│  Current Price:            $1,000   │
│  Shares Left:              6 / 10   │
│  Dividend:                 $0       │
│  Weak Demand:              1 / 3    │
│                                     │
│  Market Note:                       │
│  AI infrastructure company.         │
│  Strong upside, higher volatility.  │
└─────────────────────────────────────┘
```

---

## Files Likely Affected

- `src/components/cards/StockResearchCard.tsx` — new component
- `src/data/stocks.ts` — market notes may need to be added per stock
- `src/components/game/ActionPanel.tsx` or `BoardTrack.tsx` — trigger research card display
- No engine changes needed

---

## Rules That Must Not Be Broken

- Do not change engine logic.
- Market notes are static data in `src/data/` — not computed by the engine.
- All reads come from `useGameState()` and `STOCK_BY_CODE`.

---

## Implementation Notes

- Market notes: short 1–2 sentence strings per stock, added to `stocks.ts` or a separate `stockNotes.ts`.
- Risk display: Low = green, Med = yellow, High = red.
- Dividend shown from stock.div (already in data).
- Weak Demand count from `s.skips[code]`.
- Research card may appear as a side panel, modal, or tooltip depending on layout decision at implementation time.

---

## Data to Add (Market Notes — one per stock)

| Code | Note |
|------|------|
| CCAI | AI infrastructure company. Strong upside, higher volatility. |
| SAFE | Consumer staples anchor. Steady performer with low risk. |
| MEDI | Healthcare services. Moderate growth, recession-resistant. |
| OILW | Energy producer. Price sensitive to global supply. |
| FTRB | Regional bank. Reliable dividend, rate-sensitive. |
| MTRO | Urban REIT. Low risk, slow growth. |
| IRON | Logistics and rail. Defensive industrials play. |
| STRM | Streaming media. High growth potential, volatile. |
| CYBS | Cybersecurity firm. Tech sector, high demand in downturns. |
| FRSH | Food and grocery. Low price, very stable. |
| BIOQ | Biotech lab. Binary outcomes — high risk, high reward. |
| SOLR | Solar energy. High growth potential, capital-intensive. |
| PAYW | Digital payments. Moderate growth, broad market exposure. |
| TWPT | Commercial REIT. Mid-risk, income-generating. |
| BLDM | Construction materials. Cyclical, infrastructure-linked. |
| SGNL | Wireless communications. Defensive, moderate growth. |
| PHPK | Mobile technology. Large cap, moderate risk. |
| SNKR | Retail apparel. Consumer discretionary, trend-sensitive. |
| CARE | Primary care clinics. Low risk, defensive healthcare. |
| BATB | Battery technology. High growth, early stage. |
| APEX | Investment fund. High-risk finance play. |
| RENT | Residential REIT. Low risk, dividend-focused. |
| AERO | Aerospace manufacturing. Long-cycle industrial. |
| GMBX | Video game studio. High volatility, entertainment sector. |

---

## Tests to Run

```
npx tsc --noEmit
npm test
npm run build
```

No new engine tests needed. Consider a data integrity test: every stock in STOCKS has a market note.

---

## Completion Checklist

- [ ] Market notes added to data for all 24 stocks
- [ ] `StockResearchCard.tsx` component created
- [ ] Shows name, ticker, sector, risk, dividend, price, supply, weak demand, note
- [ ] Risk level color-coded
- [ ] Triggered from ActionPanel or BoardTrack on stock focus
- [ ] TypeScript check passes
- [ ] All tests pass
- [ ] Production build succeeds
