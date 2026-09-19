// Tradable holdings across the two places a player keeps them: `shares`
// (regular stocks and IPOs) and `etfShares` (funds). Player-to-player trades
// treat all three alike; everything else keeps using the two maps directly.

import { ETF_PRICE, isEtfCode } from '../data';
import type { GameState, Player } from './types';
import { priceOf } from './rules';

/** How many units of a stock, IPO, or ETF the player holds. */
export function heldQty(p: Player, code: string): number {
  return (isEtfCode(code) ? p.etfShares[code] : p.shares[code]) ?? 0;
}

/** Set a holding, removing the entry at zero so empty holdings never linger. */
export function setHeld(p: Player, code: string, qty: number): void {
  const map = isEtfCode(code) ? p.etfShares : p.shares;
  if (qty > 0) map[code] = qty; else delete map[code];
}

/** Every code the player could offer in a trade, with the quantity held. */
export function tradableHoldings(p: Player): Array<{ code: string; qty: number }> {
  return [...Object.entries(p.shares), ...Object.entries(p.etfShares)]
    .filter(([, qty]) => qty > 0)
    .map(([code, qty]) => ({ code, qty }));
}

/** What one unit is worth for valuing the share side of a trade: the live
    market price for stocks and IPOs, the fixed $3,000 for a fund. */
export function unitValue(s: GameState, code: string): number {
  return isEtfCode(code) ? ETF_PRICE : priceOf(s, code);
}
