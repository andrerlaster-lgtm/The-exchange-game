// Bank Auctions (Phase 3): pooled shares of sold-out stocks are auctioned at
// Market Open. Ascending, turn-order bidding starting one step below market —
// each active player may raise or pass; the last remaining bidder wins one
// share. Runs on Immer drafts. Payout Claim is frozen until a stock's auction
// fully closes, then recomputed once (rulebook §10/§11).

import { LADDER } from '../data';
import { money } from '../utils/formatMoney';
import type { GameState } from './types';
import { clampStep } from './rules';
import { recomputeClaim } from './soldOut';

function addLog(s: GameState, text: string, kind: 'g' | 'r' | 'y' | 'b' | 'n' = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

const allPlayers = (s: GameState): number[] => s.players.map((_, i) => i);

/** Minimum acceptable next bid for the active auction. */
export function minNextBid(s: GameState): number {
  const a = s.auction!;
  return a.highBidder === null ? a.startPrice : a.highBid + 1;
}

/** First active player strictly clockwise after `fromIdx` (wraps); null if none. */
function nextActive(s: GameState, fromIdx: number): number | null {
  const n = s.players.length;
  const a = s.auction!;
  for (let k = 1; k <= n; k++) {
    const idx = (fromIdx + k) % n;
    if (a.active.includes(idx)) return idx;
  }
  return null;
}

/** Collect codes with pooled shares and open the first stock's auction. */
export function queueMarketOpenAuctions(s: GameState): void {
  const codes = Object.keys(s.bankPool).filter((c) => (s.bankPool[c] || 0) > 0);
  if (codes.length === 0) return;
  s.auctionQueue = codes;
  openNextAuction(s);
}

/** Open the next queued stock's auction, or clear the auction state if none remain. */
function openNextAuction(s: GameState): void {
  const n = s.players.length;
  while (s.auctionQueue.length > 0) {
    const code = s.auctionQueue.shift()!;
    if ((s.bankPool[code] || 0) <= 0) continue;
    const startPrice = LADDER[clampStep(s.prices[code] - 1)];
    s.auction = {
      code,
      poolLeft: s.bankPool[code],
      startPrice,
      highBid: 0,
      highBidder: null,
      actor: (s.cur - 1 + n) % n, // virtual "previous" so the current player bids first
      active: allPlayers(s),
    };
    addLog(s, `Bank Auction — ${code}: ${s.auction.poolLeft} share(s) from $${startPrice.toLocaleString()}.`, 'y');
    promptNext(s);
    return;
  }
  s.auction = null;
}

/** Advance to the next player who can act, auto-passing anyone who can't meet the
    minimum bid, and closing the lot when only the high bidder remains. */
function promptNext(s: GameState): void {
  const a = s.auction;
  if (!a) return;
  while (true) {
    if (a.active.length === 0) {
      if (a.highBidder !== null) closeLot(s, a.highBidder);
      else finishStock(s, false);
      return;
    }
    if (a.highBidder !== null && a.active.length === 1 && a.active[0] === a.highBidder) {
      closeLot(s, a.highBidder);
      return;
    }
    const cand = nextActive(s, a.actor);
    if (cand === null) { finishStock(s, a.highBidder !== null); return; }
    if (a.highBidder !== null && cand === a.highBidder) { closeLot(s, a.highBidder); return; }
    const min = a.highBidder === null ? a.startPrice : a.highBid + 1;
    if (s.players[cand].cash < min) {
      a.active = a.active.filter((i) => i !== cand);
      a.actor = cand;
      addLog(s, `${s.players[cand].name} can't meet ${money(min)} — auto-passes on ${a.code}.`);
      continue;
    }
    a.actor = cand;
    return; // waiting on this player's bid/pass
  }
}

/** Award one share to the winner, then open the next lot or close the stock. */
function closeLot(s: GameState, winner: number): void {
  const a = s.auction!;
  const price = a.highBid;
  const p = s.players[winner];
  p.cash -= price;
  p.shares[a.code] = (p.shares[a.code] || 0) + 1;
  a.poolLeft -= 1;
  s.bankPool[a.code] = Math.max(0, (s.bankPool[a.code] || 0) - 1);
  addLog(s, `${p.name} wins 1 ${a.code} at auction for ${money(price)}.`, 'g');
  s.tradeLog.unshift({ kind: 'buy', text: `1× ${a.code} (auction) @ ${money(price)}`, amount: -price, player: p.name, t: s.lap });
  if (s.tradeLog.length > 60) s.tradeLog.pop();

  if (a.poolLeft > 0) {
    // Open a fresh lot for the same stock.
    const n = s.players.length;
    a.highBid = 0;
    a.highBidder = null;
    a.active = allPlayers(s);
    a.actor = (s.cur - 1 + n) % n;
    promptNext(s);
  } else {
    finishStock(s, true);
  }
}

/** Close the current stock's auction: recompute its claim once, then move on. */
function finishStock(s: GameState, sold: boolean): void {
  const a = s.auction!;
  if (!sold) addLog(s, `Bank Auction — ${a.code}: no bids, ${a.poolLeft} share(s) stay in the pool.`);
  recomputeClaim(s, a.code);
  s.auction = null;
  openNextAuction(s);
}

/** A player raises the bid to `amount`. */
export function handleBid(s: GameState, amount: number): void {
  const a = s.auction;
  if (!a) return;
  const actor = a.actor;
  const min = a.highBidder === null ? a.startPrice : a.highBid + 1;
  if (amount < min) return;                      // must beat the minimum
  if (s.players[actor].cash < amount) return;    // must be affordable
  a.highBid = amount;
  a.highBidder = actor;
  addLog(s, `${s.players[actor].name} bids ${money(amount)} on ${a.code}.`, 'b');
  promptNext(s);
}

/** The active player passes on the current lot. */
export function handlePass(s: GameState): void {
  const a = s.auction;
  if (!a) return;
  a.active = a.active.filter((i) => i !== a.actor);
  addLog(s, `${s.players[a.actor].name} passes on ${a.code}.`);
  promptNext(s);
}
