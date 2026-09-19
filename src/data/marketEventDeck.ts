// THE MARKET EVENT DECK — rebuilt 2026-08-21 to complement the approved
// Market Meter instead of duplicating its automatic round-by-round
// repricing. This is the single authoritative card-definition module — the
// former After-Hours deck (afterHoursDeck.ts) no longer exists as a second
// source; everything it held either merged in here or was removed as dead
// weight (see the Stage report for the removal rationale per card).
//
// Scope note: Dividend Payment, Cyberattack, Opening Bell, and Regulatory
// Investigation are pre-existing, already-tested mechanics that this
// rebuild's 24-card architecture (sections A-F below) never names for
// inclusion OR removal. Treated the same way as Market Close: preserved
// outside the "24 core" count, not touched by this rebuild.

import type { Card } from './types';

const mk = (title: string, story: string, effect: string, eff: Card['eff'], meterSentiment?: number): Card =>
  ({ deck: 'ME', title, story, effect, eff, ...(meterSentiment !== undefined ? { meterSentiment } : {}) });

// ── A. Eight balanced sector-rotation cards ─────────────────────────────────
// Each sector appears exactly once as a +1 leader and once as a -1 laggard
// across this group. Net meter sentiment: Neutral (no meterSentiment set) —
// capital rotation, not a market-wide mood.
const SECTOR_ROTATION_CARDS: Card[] = [
  mk('Tech Breakthrough',       'A surprise product launch reshapes the tech landscape.',   'Technology +1; Real Estate -1.',       { k: 'multi', m: [{ sec: 'tech', bp: 500 }, { sec: 'realestate', bp: -500 }] }),
  mk('Property Rebound',        'Commercial real estate demand snaps back.',                'Real Estate +1; Technology -1.',       { k: 'multi', m: [{ sec: 'realestate', bp: 500 }, { sec: 'tech', bp: -500 }] }),
  mk('Bank Earnings Surge',     'Lenders report stronger-than-expected income.',            'Finance +1; Consumer -1.',             { k: 'multi', m: [{ sec: 'finance', bp: 500 }, { sec: 'consumer', bp: -500 }] }),
  mk('Consumer Spending Boom',  'Households open their wallets for the season.',            'Consumer +1; Finance -1.',             { k: 'multi', m: [{ sec: 'consumer', bp: 500 }, { sec: 'finance', bp: -500 }] }),
  mk('Medical Breakthrough',    'A clinical trial reports unexpectedly strong results.',    'Healthcare +1; Energy -1.',            { k: 'multi', m: [{ sec: 'health', bp: 500 }, { sec: 'energy', bp: -500 }] }),
  mk('Energy Supply Shock',     'A supply disruption tightens the energy market.',          'Energy +1; Healthcare -1.',            { k: 'multi', m: [{ sec: 'energy', bp: 500 }, { sec: 'health', bp: -500 }] }),
  mk('Infrastructure Boom',     'A wave of public works spending breaks ground.',           'Industrials +1; Comms/Media -1.',      { k: 'multi', m: [{ sec: 'industrials', bp: 500 }, { sec: 'comm', bp: -500 }] }),
  mk('Media Breakout',          'A streaming or platform launch dominates headlines.',      'Comms/Media +1; Industrials -1.',      { k: 'multi', m: [{ sec: 'comm', bp: 500 }, { sec: 'industrials', bp: -500 }] }),
];

// ── B. Four balanced risk cards ──────────────────────────────────────────────
const RISK_CARDS: Card[] = [
  mk('Flight to Quality', 'Investors seek shelter in dependable names.',        'Low Risk +1; High Risk -1.', { k: 'multi', m: [{ risk: 'Low', bp: 500 }, { risk: 'High', bp: -500 }] }),
  mk('Risk-On Rally',     'Traders chase upside in the market’s riskiest names.', 'High Risk +1; Low Risk -1.', { k: 'multi', m: [{ risk: 'High', bp: 500 }, { risk: 'Low', bp: -500 }] }),
  mk('Steady Earnings',   'Mid-tier companies post reliable, unremarkable results.', 'Medium Risk +1.',       { k: 'risk', risk: 'Med', bp: 500 }, 1),
  mk('Growth Warning',    'Mid-tier guidance comes in soft for the quarter.',   'Medium Risk -1.',            { k: 'risk', risk: 'Med', bp: -500 }, -1),
];

// ── C. Four company-specific cards ───────────────────────────────────────────
// "Eligible company" for Earnings Beat/Miss/Short Squeeze/Bad Press: any
// regular company or revealed IPO whose price can actually move in the
// required direction (not already at the ladder floor/ceiling) — enforced in
// eventCardResolver.ts, not by this data module.
const COMPANY_SPECIFIC_CARDS: Card[] = [
  mk('Earnings Beat',   'One company crushes its sales and profit targets.', 'Choose an eligible company — it rises 2 steps.', { k: 'pick', bp: 1000, label: 'Choose a company to move UP 2 steps' }),
  mk('Earnings Miss',   'One company badly misses expectations.',            'Choose an eligible company — it falls 2 steps.', { k: 'pick', bp: -1000, label: 'Choose a company to move DOWN 2 steps' }),
  mk('Short Squeeze',   'Traders betting against the cheapest stock scramble to cover.', 'The lowest-priced eligible company rises 2 steps.', { k: 'lowest', bp: 1000 }),
  mk('Bad Press',       'Negative headlines hit the market leader.',         'The highest-priced eligible company falls 2 steps.', { k: 'highest', bp: -1000 }),
];

// ── D. Two broad-market headline cards ───────────────────────────────────────
// The previous automatic +/-2 across the entire market is NOT restored here —
// reduced to +/-1 now that the meter guarantees additional ambient movement
// every round; going back to +/-2 on top of that was not validated as safe
// (see the balance simulation in the Stage report).
const BROAD_MARKET_CARDS: Card[] = [
  mk('Melt-Up Rally', 'Momentum buyers chase the whole market higher.', 'Every eligible company rises 1 step.', { k: 'all', bp: 500 }, 2),
  mk('Flash Crash',   'Selling hits fast, before buyers respond.',      'Every eligible company falls 1 step.', { k: 'all', bp: -500, crash: true }, -2),
];

// ── E. Three sentiment/information cards ─────────────────────────────────────
const SENTIMENT_CARDS: Card[] = [
  mk('Bullish Momentum',    'Confidence builds heading into the next session.', 'Moves the Market Meter 2 points bullish. No immediate company movement.', { k: 'meterDelta', delta: 2 }),
  mk('Bearish Momentum',    'Caution spreads heading into the next session.',   'Moves the Market Meter 2 points bearish. No immediate company movement.', { k: 'meterDelta', delta: -2 }),
  mk('Insider Information', 'A contact gives you an early look at the next headline.', 'Reveals the next Market Event’s title and effect without drawing, discarding, or resolving it.', { k: 'insiderPreview' }),
];

// ── F. Three strategic system cards ─────────────────────────────────────────
const STRATEGIC_CARDS: Card[] = [
  { deck: 'ME', title: 'Circuit Breaker', story: 'A defensive order is ready before the next selloff.',
    effect: 'Keep this card. When a Market Event would lower a company you own, play it to protect that company from that card’s entire drop.',
    eff: { k: 'circuitBreaker' } },
  { deck: 'ME', title: 'Extended Hours', story: 'Trading stays open past the bell.',
    effect: 'Banks a global 1-round Market Close extension — everyone gets one more round once it triggers.',
    eff: { k: 'extend' } },
  mk('Volatility Cools', 'The market takes a breath after a stretch of sharp moves.', 'Moves the Market Meter 2 points toward Neutral. No immediate company movement.', { k: 'meterTowardNeutral', amount: 2 }),
];

/** The 24 rebuilt core cards — sections A through F, in spec order. */
export const CORE_ME_CARDS: Card[] = [
  ...SECTOR_ROTATION_CARDS,
  ...RISK_CARDS,
  ...COMPANY_SPECIFIC_CARDS,
  ...BROAD_MARKET_CARDS,
  ...SENTIMENT_CARDS,
  ...STRATEGIC_CARDS,
];

/**
 * Market Close is deliberately NOT one of the 24 core cards — it is handled
 * as a separate, always-present 25th deck entry (see gameState.ts's
 * buildMarketEventDeck), matching the Endgame Rules in the rebuild spec. No
 * bounded "Card Close" redesign was approved in the Market Overhaul, so its
 * insertion behavior (random position in the bottom quarter of the deck) is
 * intentionally unchanged from before this rebuild.
 */
export const MARKET_CLOSE_CARD: Card =
  mk('Market Close', 'The closing bell rings across the exchange.', 'The game ends now — unless a player holds Extended Hours.', { k: 'close' });

// Preserved, pre-existing mechanics this rebuild's 24-card architecture never
// named for inclusion or removal (see the module doc comment above).
const PRESERVED_CARDS: Card[] = [
  mk('Dividend Payment',         'Your portfolio had a profitable quarter.',                    'Receive the stock and IPO dividends currently due on your holdings.',      { k: 'dividend' }),
  mk('Cyberattack',              'Your portfolio security system has been breached.',           'Choose: one holding drops 1 step, or pay 3% of net worth (minimum $500).', { k: 'cyberattack' }),
  mk('Opening Bell',             'A new trading session begins with a rare first-mover opportunity.', 'Randomly reveal an untouched company. Buy the entire 11-share company at its current market price, or pass.', { k: 'openingBell' }),
  mk('Regulatory Investigation', 'Government regulators open an investigation into one company in your portfolio.', 'Choose: one holding drops 1 step and its next dividend is reduced 50%, or pay $5,000.', { k: 'regulatoryInvestigation' }),
];

export const ME_CARDS: Card[] = [...CORE_ME_CARDS, ...PRESERVED_CARDS, MARKET_CLOSE_CARD];
export const CIRCUIT_BREAKER_INDEX = ME_CARDS.findIndex((card) => card.eff.k === 'circuitBreaker');
export const MARKET_CLOSE_INDEX = ME_CARDS.findIndex((card) => card.eff.k === 'close');
