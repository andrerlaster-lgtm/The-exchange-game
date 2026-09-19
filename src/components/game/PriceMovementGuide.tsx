// A short, always-available in-game explainer for "why did that price just
// move" — the six mechanisms that change a regular stock's price, in one
// compact place instead of scattered across contextual panels. Real current
// numbers, not vague text, matching every other player-facing description
// in the app (see rulebook.md for the full, precise version of each of these).

import { useState } from 'react';
import { WEAK_DEMAND_THRESHOLD, STRONG_DEMAND_THRESHOLD } from '../../data';

const ENTRIES: { title: string; icon: string; color: string; body: string }[] = [
  {
    title: 'Market Meter',
    icon: '◆', color: '#60a5fa',
    body: 'A shared needle from −3 to +3. Every dice roll nudges it (8+ pushes it up, 6 or less pushes it down, 7 holds it). At the end of every round it forces one real reprice: 1 sector moves 1 step in the neutral zone, 1 sector moves 2 steps at ±2, or 2 sectors each move 1 step when pinned at ±3. A narrow Market Event or Fed card also stirs one extra sector when it resolves.',
  },
  {
    title: 'Market Event & Fed cards',
    icon: '◈', color: '#c9a24f',
    body: 'Drawn from landing on the Market Event or Fed space, or automatically when any stock hits the $5,000 ceiling. Effects vary by card — one sector, one risk tier, the whole market, or a single company. A held Circuit Breaker card can block one negative card\'s entire price drop on one owned company.',
  },
  {
    title: 'Bull Run & Bear Run',
    icon: '🐂', color: '#3ed598',
    body: 'Dedicated board spaces. High-risk stocks move 2 steps, Medium-risk 1 step, Low-risk companies don\'t move at all in either direction — Low risk trades that price stability for the lowest upside in a Bull Run too. Revealed IPOs move 1 step. Also pays every player cash based on their current Bullish/Balanced/Bearish stance.',
  },
  {
    title: 'Weak Demand',
    icon: '⌄', color: '#fbbf24',
    body: `An untouched company drops 1 price step once it collects ${WEAK_DEMAND_THRESHOLD} markers — 1 per landing where the player could afford to buy the whole company and chose to skip anyway. A skip forced by not having enough cash never counts. Markers persist across laps until they hit the threshold or someone buys the company.`,
  },
  {
    title: 'Strong Demand',
    icon: '✦', color: '#4ade80',
    body: `The mirror of Weak Demand, for the other half of a company's life: a company that's already sold out rises 1 price step once it collects ${STRONG_DEMAND_THRESHOLD} markers — 1 per Payout Claim landing on it, regardless of how the landing player settles the claim. Markers persist across laps the same way.`,
  },
  {
    title: 'Payout Claim (price affects the rent, not the other way)',
    icon: '$', color: '#f87171',
    body: 'Payout Claims don\'t move price themselves, but price moves what they cost: a Sold-Out company\'s current price above its opening price scales the claim 1.5×, and at least double opening scales it 2×. This is why the same company\'s claim can grow steeply as it climbs — worth watching if you\'re about to land on someone\'s controlled company.',
  },
];

export default function PriceMovementGuide() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Why did that price just move?"
        style={{
          fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
          padding: '3px 8px', borderRadius: 999,
          background: 'rgba(96,165,250,0.12)', color: '#60a5fa',
          border: '1px solid rgba(96,165,250,0.35)', cursor: 'pointer',
          flexShrink: 0, textTransform: 'uppercase',
        }}>
        ? Price Guide
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(10,8,5,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border-hi)',
              borderRadius: 12, padding: 22, maxWidth: 480, width: '100%',
              maxHeight: '82vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 14,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="slabel" style={{ marginBottom: 0 }}>What Moves Stock Prices</span>
              <button
                onClick={() => setOpen(false)}
                style={{ fontSize: 16, padding: '2px 8px', color: 'var(--muted)', border: 'none', background: 'none', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {ENTRIES.map((entry) => (
                <div key={entry.title} style={{
                  padding: '9px 11px', borderRadius: 8,
                  background: `${entry.color}12`, border: `1px solid ${entry.color}40`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, color: entry.color }}>{entry.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{entry.title}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5 }}>{entry.body}</div>
                </div>
              ))}
            </div>

            <button className="primary" style={{ padding: '8px 0' }} onClick={() => setOpen(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
