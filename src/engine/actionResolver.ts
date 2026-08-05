// Main action dispatch — receives an Immer draft and mutates it.
// Called inside produce() in reducer.ts.

import {
  CARDS, DECK_META, ETF_BY_SPACE, ETF_BY_CODE, ETF_PRICE, IPO_BY_CODE, IPO_DEFS, LADDER,
  MARGIN_INCREMENT, MARGIN_MAX, MARGIN_DEFAULT_PENALTY, MAX_TRADE_QTY, WEAK_DEMAND_THRESHOLD,
  REGULAR_SUPPLY, SPACES, STOCK_BY_CODE, IPO_INDEX, isIpoCode,
} from '../data';
import type { Effect } from '../data/types';
import { money } from '../utils/formatMoney';
import type { Rng } from '../utils/rng';
import type { Action, GameState, InsolvencyReason, LogKind, TradeKind } from './types';
import { bankSellRemaining, canTradeNow, canMarketSell, blocked, ipoOf, priceOf, sellBackPrice } from './rules';
import { freshDecks, freshIpos, resetPlayers } from './gameState';
import { payMarketOpen } from './playerState';
import { moveTradePrice, moveEventPrice, settleShorts } from './stockState';
import { startLap, clearTurnState } from './turnState';
import { applyEffect, beginMarketEventEffect, resolveCircuitBreaker, triggerClose } from './eventCardResolver';
import { netWorth } from './scoringEngine';
import { pushFeeEvent } from './feeLog';
import { topOwner, recomputeClaim, claimPayout } from './soldOut';
import { handleBid, handlePass } from './auction';
import { hasSectorPortfolio } from './sector';
import { effectImpacts, recordCardSignal, recordClaimTakeover, recordMarketSignal } from './marketSignals';
import { setMarketStance } from './marketRegime';
import { addStockCostBasis, rankingScore, recordStockSale } from './gainLoss';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

function addTradeLog(s: GameState, kind: TradeKind, text: string, amount: number, player: string): void {
  s.tradeLog.unshift({ kind, text, amount, player, t: s.lap });
  if (s.tradeLog.length > 60) s.tradeLog.pop();
}

/**
 * Executes a validated player-to-player offer: transfers shares and cash
 * directly between the two named players. Never touches the market ladder
 * or the bank's supply pool — a pure private transfer. Returns false (no-op)
 * if either side can no longer cover their end (shares/cash moved since the
 * offer was proposed).
 */
function resolveP2POffer(s: GameState, offer: GameState['p2pOffers'][number]): boolean {
  const seller = offer.direction === 'sell' ? s.players[offer.from] : s.players[offer.to];
  const buyer = offer.direction === 'sell' ? s.players[offer.to] : s.players[offer.from];
  const owned = seller.shares[offer.code] || 0;
  if (owned < offer.qty || buyer.cash < offer.price) return false;

  const realized = recordStockSale(seller, offer.code, offer.qty, offer.price, owned);
  seller.shares[offer.code] = owned - offer.qty;
  if (seller.shares[offer.code] === 0) delete seller.shares[offer.code];
  buyer.shares[offer.code] = (buyer.shares[offer.code] || 0) + offer.qty;
  addStockCostBasis(buyer, offer.code, offer.price);
  buyer.cash -= offer.price;
  seller.cash += offer.price;
  if (offer.qty >= 3) setMarketStance(seller, 'bearish');

  addLog(s, `${seller.name} sells ${offer.qty}× ${offer.code} to ${buyer.name} for ${money(offer.price)} (private trade · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)})`, 'b');
  addTradeLog(s, 'p2p', `${offer.qty}× ${offer.code} ↔ ${buyer.name} · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)}`, offer.price, seller.name);
  addTradeLog(s, 'p2p', `${offer.qty}× ${offer.code} from ${seller.name} · basis ${money(offer.price)}`, -offer.price, buyer.name);
  recomputeAndLogClaim(s, offer.code);
  return true;
}

/** Log a Payout Claim handover after ownership shifts (fires only on real changes). */
function recomputeAndLogClaim(s: GameState, code: string): void {
  const previousHolder = s.soldOut[code]?.claimHolder ?? null;
  if (!recomputeClaim(s, code)) return;
  const holder = s.soldOut[code]?.claimHolder;
  addLog(s, holder == null
    ? `${code} Payout Claim is now Contested.`
    : `${code} Payout Claim passes to ${s.players[holder].name}.`, 'y');
  recordClaimTakeover(s, code, previousHolder);
}

/** Open a forced-sale Insolvency for a payment shortfall (Portfolio Tax,
    Audit Notice, or a Payout Claim landing payment) — or, if the player has
    no regular stock left to sell, waive it immediately (rulebook §17). */
function openInsolvency(
  s: GameState, player: number, owed: number,
  reason: InsolvencyReason, payTo: number | null, label: string,
): void {
  const p = s.players[player];
  const hasSellable = Object.keys(p.shares).some((c) => !isIpoCode(c) && (p.shares[c] ?? 0) > 0);
  if (!hasSellable) {
    addLog(s, `${p.name} has no regular stock left to sell — ${money(owed)} of ${label} is waived.`, 'y');
    return;
  }
  s.insolvency = { player, owed, reason, payTo, label };
  addLog(s, `${p.name} can't fully cover ${label} — sell regular stock to raise ${money(owed)}.`, 'r');
}

function resolveLanding(s: GameState, pi: number): void {
  const p = s.players[pi];
  const sp = SPACES[p.pos - 1];
  switch (sp.type) {
    case 'stock': {
      const code = sp.code!;
      const rec = s.soldOut[code];
      if (rec) {
        // Already owned — pay rent to the claim holder (rulebook §10). No buy
        // option here: the company's shares are fully allocated and only
        // circulate again via the owner's sell-backs (→ Bank Auction pool).
        if (rec.claimHolder !== null && rec.claimHolder !== pi) {
          const holder = s.players[rec.claimHolder];
          const sectorComplete = hasSectorPortfolio(holder, STOCK_BY_CODE[code].sector);
          const owed = claimPayout(holder.shares[code] || 0, sectorComplete);
          const paid = Math.min(owed, Math.max(0, p.cash)); // pay what cash covers now
          p.cash -= paid;
          holder.cash += paid;
          const short = owed - paid;
          addLog(s, `${p.name} pays ${holder.name} ${money(paid)} Payout Claim on ${code}` +
            (sectorComplete ? ' (Sector Portfolio boost)' : ''), 'r');
          addTradeLog(s, 'payout', `Payout Claim ${code} → ${holder.name}`, -paid, p.name);
          addTradeLog(s, 'payout', `Payout Claim ${code} from ${p.name}`, paid, holder.name);
          if (short > 0) openInsolvency(s, pi, short, 'payout', rec.claimHolder, `Payout Claim on ${code} to ${holder.name}`);
        } else if (rec.claimHolder === pi) {
          addLog(s, `${p.name} lands on their own ${STOCK_BY_CODE[code].name} — no rent owed.`);
        } else {
          addLog(s, `${STOCK_BY_CODE[code].name} is Contested — no Payout Claim to pay.`);
        }
        break;
      }
      // Untouched company — offer to buy it outright, or skip.
      s.trade = { scope: 'stock', code, actionsLeft: 1 };
      addLog(s, `Landed on ${STOCK_BY_CODE[code].name} — buy the company or skip.`);
      break;
    }
    case 'fed':
      s.pendingDraws.push('FED');
      addLog(s, 'The Fed — draw a Fed Rate card.', 'y');
      break;
    case 'investor': {
      const eligible = Object.keys(p.shares).filter((code) =>
        !isIpoCode(code) && (p.shares[code] ?? 0) > 0 && s.prices[code] < LADDER.length - 1,
      );
      s.investorDay = { eligibleCodes: eligible };
      addLog(s, `${p.name} lands on Investor Day — choose Company Growth or Insider Information.`, 'g');
      break;
    }
    case 'ipo': {
      if (!s.opts.ipos) { addLog(s, 'IPO space — IPOs disabled in this game.'); break; }
      const hiddenIdx = s.ipos.map((_, i) => i).filter((i) => !s.ipos[i].revealed);
      if (hiddenIdx.length > 0) {
        // A fresh reveal belongs only to the player who landed here. Other
        // players must land on an IPO space on a later turn to buy IPO shares.
        const i = hiddenIdx[0];
        const ip = s.ipos[i];
        ip.revealed = true; ip.step = ip.startStep;
        s.lastDraw = { deck: 'IPO', title: IPO_DEFS[i].name, seq: (s.lastDraw?.seq ?? 0) + 1 };
        addLog(s, `Launched IPO: ${IPO_DEFS[i].name} @ ${money(LADDER[ip.startStep])}`, 'g');
        recordMarketSignal(s, {
          kind: 'ipo',
          title: `IPO Launch · ${ip.code}`,
          summary: `${IPO_DEFS[i].name} entered the market at ${money(LADDER[ip.startStep])} per share.`,
          impacts: [],
        });
        s.ipoBuy = { code: ip.code, max: 2, bought: 0, price: LADDER[ip.step], actor: pi };
        addLog(s, `${p.name} may buy ${ip.code} (up to 2 shares).`, 'g');
        break;
      }
      const anyRevealed = s.ipos.some((ip) => ip.revealed && ip.supply > 0);
      if (anyRevealed) {
        s.ipoListPick = true;
        addLog(s, 'IPO space — choose an IPO to buy (up to 2 shares).', 'g');
      } else {
        addLog(s, 'IPO space — no shares available.');
      }
      break;
    }
    case 'free':
      s.trade = { scope: 'free', actionsLeft: 2 };
      addLog(s, 'Free Trading Day — make up to 2 trade actions.', 'g');
      break;
    case 'tax': {
      // Portfolio Tax: 10% of net worth (cash + stocks + ETFs − margin)
      const nw = netWorth(s, p);
      const tax = Math.max(0, Math.round(nw * 0.10 / 100) * 100);
      const fromCash = Math.min(Math.max(p.cash, 0), tax);
      p.cash -= fromCash;
      addLog(s, `${p.name} pays Portfolio Tax: −${money(fromCash)} (10% of net worth ${money(nw)})`, 'r');
      pushFeeEvent(s, 'tax', p, -fromCash);
      const shortTax = tax - fromCash;
      if (shortTax > 0) openInsolvency(s, pi, shortTax, 'tax', null, 'Portfolio Tax');
      break;
    }
    case 'audit': {
      // Audit Notice: $500 flat, +$250 extra if player carries outstanding margin
      const penalty = 500 + (p.margin > 0 ? 250 : 0);
      const fromCash = Math.min(Math.max(p.cash, 0), penalty);
      p.cash -= fromCash;
      const note = p.margin > 0 ? ' (+$250 margin penalty)' : '';
      addLog(s, `${p.name} pays Audit Notice: −${money(fromCash)}${note}`, 'r');
      pushFeeEvent(s, 'audit', p, -fromCash);
      const shortAudit = penalty - fromCash;
      if (shortAudit > 0) openInsolvency(s, pi, shortAudit, 'audit', null, 'Audit Notice');
      break;
    }
    case 'etf': {
      const etf = ETF_BY_SPACE[p.pos];
      if (etf) {
        s.etfPick = etf.code;
        addLog(s, `${etf.name} — buy 1 share @ ${money(ETF_PRICE)} or skip.`, 'b');
      }
      break;
    }
    case 'open':
      // Market Open is payday only (dividends/ETF payout/salary/margin call),
      // already handled by payMarketOpen in applyMove. No card draw here.
      break;
    case 'event':
      s.pendingDraws.push('ME');
      addLog(s, `${p.name} landed on Market Event — draw a card.`, 'r');
      break;
    case 'bull':
    case 'bear': {
      const regime = sp.type;
      const effect: Effect = { k: 'regime', regime };
      const title = regime === 'bull' ? 'Bull Run' : 'Bear Run';
      const summary = regime === 'bull'
        ? 'High Risk +2, Medium Risk +1, Low Risk unchanged, and revealed IPOs +1. Stance cash resolves for every player.'
        : 'High Risk −2, Medium Risk −1, Low Risk +1, and revealed IPOs −1. Stance cash resolves for every player.';
      addLog(s, `${p.name} lands on ${title} — the entire market reacts.`, regime === 'bull' ? 'g' : 'r');
      recordMarketSignal(s, { kind: 'market', title, summary, impacts: effectImpacts(s, effect) });
      beginMarketEventEffect(s, effect);
      break;
    }
    case 'placeholder':
    case 'short':
      break;
  }
}

function applyMove(s: GameState, steps: number): void {
  s.rolling = false;
  const p = s.players[s.cur];
  const from = p.pos;
  const passed = Math.floor((from - 1 + steps) / 36) >= 1;
  p.pos = ((from - 1 + steps) % 36) + 1;
  addLog(s, `${p.name} rolls ${steps} → space ${p.pos}`);
  if (passed || p.pos === 1) {
    payMarketOpen(s, s.cur);
    s.marketOpenWindow = true;
    addLog(s, 'Market Open Trading Window is open — trade freely, then close it to continue.', 'b');
  }
  s.turnPhase = 'acted';
  resolveLanding(s, s.cur);
}

export function resolveAction(s: GameState, action: Action, rng: Rng): void {
  switch (action.t) {

    // ---- setup ----
    case 'setNum':
      s.numPlayers = Math.max(2, Math.min(6, action.n));
      break;
    case 'setName':
      s.names[action.i] = action.name;
      break;
    case 'setPiece':
      s.pieces[action.i] = action.piece;
      break;
    case 'setOpt':
      Object.assign(s.opts, action.opt);
      break;
    case 'startGame': {
      resetPlayers(s);
      for (const st of Object.values(STOCK_BY_CODE)) {
        s.prices[st.code] = st.step;
        s.supply[st.code] = REGULAR_SUPPLY;
      }
      s.skips = {}; s.soldOut = {}; s.bankPool = {}; s.lap = 1; s.log = []; s.tradeLog = []; s.feeLog = [];
      s.marketSignals = []; s.marketSignalSeq = 0;
      s.decks = freshDecks(rng); s.discard = { ME: [], FED: [] };
      s.ipos = freshIpos();
      s.shorts = []; s.closing = false; s.closeDrawer = null; s.etfPick = null;
      s.extendedHoursAvailable = false; s.extendedRoundsLeft = 0;
      s.circuitBreakerHolder = null; s.circuitBreakerPrompt = null;
      s.lastDraw = null; s.cardPreviewMode = null; s.investorDay = null;
      s.p2pOffers = []; s.p2pSeq = 0;
      s.auction = null; s.auctionQueue = []; s.marketOpenWindow = false;
      clearTurnState(s);
      s.dice = [null, null]; s.rolling = false;
      s.bonusRollPending = false; s.bonusRollUsed = false;
      s.phase = 'play'; s.cur = 0; s.turnPhase = 'preRoll';
      addLog(s, `Market open. ${s.players[0].name} starts.`, 'g');
      if (s.opts.closeMode === 'rounds' && s.opts.closeRounds <= 1) triggerClose(s);
      break;
    }
    case 'newGame':
      s.phase = 'setup';
      break;
    case 'toggleTest':
      s.testMode = !s.testMode;
      break;

    // ---- roll ----
    case 'roll': {
      if (s.turnPhase !== 'preRoll' || s.rolling) break;
      const a = rng.int(1, 6);
      const b = rng.int(1, 6);
      s.dice = [a, b];
      s.bonusRollPending = a === b && !s.bonusRollUsed;
      if (s.bonusRollPending) {
        s.bonusRollUsed = true;
        addLog(s, `${s.players[s.cur].name} rolled doubles (${a}/${b}) — one bonus roll earned.`, 'y');
      }
      applyMove(s, a + b);
      break;
    }

    // ---- trading ----
    // Buying a regular stock is an all-or-nothing company buy-out: you can't
    // acquire a partial stake from the bank — only the full 11-share supply, for
    // the company's fixed Starter / Growth / Premium acquisition price. This
    // instantly sells the stock out and claims the Payout Claim, but does not
    // move its live per-share market price. Once owned, shares only re-enter via
    // the owner selling back to the bank (→ Bank Auction pool) or a P2P trade.
    case 'buy': {
      const { code } = action;
      if (!canTradeNow(s)) break;
      if (isIpoCode(code)) break;
      const t = s.trade!;
      if (t.scope === 'stock' && t.code !== code) break;
      if (s.supply[code] !== REGULAR_SUPPLY) break; // already bought out — no partial stake available
      const p = s.players[s.cur];
      const stock = STOCK_BY_CODE[code];
      const cost = stock.buyout;
      if (p.cash < cost) break;
      p.cash -= cost;
      p.shares[code] = REGULAR_SUPPLY;
      addStockCostBasis(p, code, cost);
      setMarketStance(p, 'bullish');
      s.supply[code] = 0;
      t.actionsLeft -= 1;
      addLog(s, `${p.name} buys the ${stock.name} company at its ${stock.tier} tier price for ${money(cost)}!`, 'g');
      addTradeLog(s, 'buy', `Bought ${code} company (${stock.tier}) @ ${money(cost)}`, -cost, p.name);
      if (s.skips[code]) s.skips[code] = 0;
      // The buy-out claims the stock permanently. The buyer is trivially the
      // sole owner, and the share-market price stays unchanged on acquisition.
      s.soldOut[code] = { code, claimHolder: topOwner(s, code) };
      addLog(s, `${code} is SOLD OUT — ${p.name} holds the Payout Claim.`, 'y');
      break;
    }
    case 'sell': {
      const { code } = action;
      const qty = action.qty ?? 1;
      if (isIpoCode(code)) break;
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_TRADE_QTY) break;
      const p = s.players[s.cur];
      const owned = p.shares[code] || 0;
      if (owned < qty) break;
      // Two ways to sell: an active Trade Step (landed on a stock / Free Trading Day),
      // which consumes a trade action — or the Trading Market, available on any of
      // your own turns without landing. Both routes share the same per-company,
      // per-turn allowance: half the holding, rounded down.
      const t = s.trade;
      const tradeStepSell = !!t && canTradeNow(s);
      if (!tradeStepSell && !canMarketSell(s)) break;
      if (qty > bankSellRemaining(s, code)) break;
      // Rulebook §11: the seller receives one price step BELOW current market
      // (or the $100 floor). A block sale of 3+ shares additionally moves the
      // market price down one step.
      const price = sellBackPrice(s, code);
      const proceeds = price * qty;
      const realized = recordStockSale(p, code, qty, proceeds, owned);
      p.cash += proceeds;
      p.shares[code] = owned - qty;
      if (p.shares[code] === 0) delete p.shares[code];
      // Sold-out stocks are permanent: sold-back shares go to the bank pool
      // (held aside for future auctions), NOT back into normal supply.
      if (s.soldOut[code]) s.bankPool[code] = (s.bankPool[code] || 0) + qty;
      else s.supply[code] = (s.supply[code] || 0) + qty;
      s.bankSoldThisTurn[code] = (s.bankSoldThisTurn[code] || 0) + qty;
      if (qty >= 3) setMarketStance(p, 'bearish');
      if (qty >= 3) moveTradePrice(s, code, -1);
      if (tradeStepSell) t!.actionsLeft -= 1;
      const moved = qty >= 3 ? ' (▼1 step)' : '';
      addLog(s, `${p.name} sells ${qty} ${code} @ ${money(price)}${moved} · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)}`, 'r');
      addTradeLog(s, 'sell', `${qty}× ${code} @ ${money(price)} · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)}`, proceeds, p.name);
      recomputeAndLogClaim(s, code);
      break;
    }
    case 'skipStock': {
      if (s.auction) break; // resolve the auction first
      const { code } = action;
      const t = s.trade;
      if (!t || t.scope !== 'stock' || t.code !== code) break;
      if ((s.supply[code] || 0) > 0) {
        s.skips[code] = (s.skips[code] || 0) + 1;
        addLog(s, `${s.players[s.cur].name} skips ${code} — weak-demand marker ${s.skips[code]}/${WEAK_DEMAND_THRESHOLD}.`, 'r');
        if (s.skips[code] >= WEAK_DEMAND_THRESHOLD) {
          moveTradePrice(s, code, -1);
          s.skips[code] = 0;
          addLog(s, `Weak demand: ${code} drops 1 step (${WEAK_DEMAND_THRESHOLD} markers).`, 'r');
          recordMarketSignal(s, {
            kind: 'weakDemand',
            title: `Weak Demand · ${code}`,
            summary: `${code} fell one price step after ${WEAK_DEMAND_THRESHOLD} consecutive skips.`,
            impacts: [{ code, d: -1 }],
          });
        }
      } else {
        addLog(s, `${code} is sold out — no marker added.`);
      }
      s.trade = null;
      break;
    }

    // ---- margin ----
    case 'takeMargin': {
      if (!s.opts.margin) break;
      if (s.auction) break; // not while a Bank Auction is live
      // Margin may only be taken while buying stock (a purchase context).
      if (!s.trade && !s.ipoListPick && !s.ipoBuy) break;
      const p = s.players[s.cur];
      // A full $2,000 increment must never push the balance past the $4,000 cap —
      // checking only "already at the cap" let a mid-value balance (e.g. $2,300,
      // reachable via a partial margin-call repayment) take a full increment and
      // breach the cap (e.g. $2,300 -> $4,300).
      if (p.margin + MARGIN_INCREMENT > MARGIN_MAX) break;
      p.cash += MARGIN_INCREMENT; p.margin += MARGIN_INCREMENT;
      setMarketStance(p, 'bullish');
      addLog(s, `${p.name} takes margin +${money(MARGIN_INCREMENT)} (balance ${money(p.margin)})`, 'y');
      addTradeLog(s, 'margin', `Margin +${money(MARGIN_INCREMENT)}`, MARGIN_INCREMENT, p.name);
      break;
    }
    case 'repayMargin': {
      // Blocked while a margin call is being resolved: paying it down "voluntarily"
      // here doesn't touch marginCall.owed, so the player's raised cash gets spent
      // without ever clearing the call — leaving them to raise the SAME amount
      // again (and, if out of sellable shares, permanently stuck). Forced-sale
      // resolution must go through payMarginCall/marginSell instead.
      if (s.marginCall && s.marginCall.player === s.cur) break;
      if (s.insolvency && s.insolvency.player === s.cur) break;
      const p = s.players[s.cur];
      const amt = Math.min(MARGIN_INCREMENT, p.margin);
      if (amt <= 0 || p.cash < amt) break;
      p.cash -= amt; p.margin -= amt;
      addLog(s, `${p.name} repays margin ${money(amt)} (balance ${money(p.margin)})`, 'g');
      addTradeLog(s, 'repay', `Margin repaid ${money(amt)}`, -amt, p.name);
      break;
    }
    case 'marginSell': {
      // Forced sale to raise cash during a margin call. Follows normal sell-back
      // mechanics for regular stock (rulebook §11/§17): one step below market, and
      // the price drops one step. IPO shares have no sell-back step, so they sell
      // at their current price with no movement. No action cost.
      const mc = s.marginCall;
      if (!mc || mc.player !== s.cur) break;
      const { code } = action;
      const p = s.players[s.cur];
      const owned = p.shares[code] || 0;
      if (owned <= 0) break;
      const ipo = isIpoCode(code);
      const price = ipo ? priceOf(s, code) : sellBackPrice(s, code);
      const realized = recordStockSale(p, code, 1, price, owned);
      p.cash += price;
      p.shares[code] = owned - 1;
      if (p.shares[code] === 0) delete p.shares[code];
      if (ipo) s.ipos[IPO_INDEX[code]].supply += 1;
      else if (s.soldOut[code]) s.bankPool[code] = (s.bankPool[code] || 0) + 1;
      else s.supply[code] = (s.supply[code] || 0) + 1;
      addLog(s, `${p.name} sells 1 ${code} @ ${money(price)} to cover margin · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)}`, 'r');
      addTradeLog(s, 'sell', `1× ${code} @ ${money(price)} (margin) · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)}`, price, p.name);
      recomputeAndLogClaim(s, code);
      break;
    }
    case 'payMarginCall': {
      const mc = s.marginCall;
      if (!mc || mc.player !== s.cur) break;
      const p = s.players[s.cur];
      if (p.cash < mc.owed) break;   // must raise enough cash first (sell stock)
      p.cash -= mc.owed; p.margin -= mc.owed;
      p.cash -= MARGIN_DEFAULT_PENALTY;
      addLog(s, `${p.name} covers margin call ${money(mc.owed)} + ${money(MARGIN_DEFAULT_PENALTY)} penalty (balance ${money(p.margin)})`, 'r');
      addTradeLog(s, 'repay', `Margin call −${money(mc.owed)}`, -mc.owed, p.name);
      addTradeLog(s, 'penalty', `Margin penalty −${money(MARGIN_DEFAULT_PENALTY)}`, -MARGIN_DEFAULT_PENALTY, p.name);
      pushFeeEvent(s, 'marginCall', p, -(mc.owed + MARGIN_DEFAULT_PENALTY));
      s.marginCall = null;
      break;
    }

    // ---- insolvency / forced sale (Phase 8: Portfolio Tax, Audit Notice, ----
    // ---- and Payout Claim payments a player can't fully cover in cash) ----
    case 'forcedSell': {
      const iv = s.insolvency;
      if (!iv) break;
      const { code } = action;
      if (isIpoCode(code)) break; // regular stock only — IPO/ETF can't be force-sold
      const p = s.players[iv.player];
      const owned = p.shares[code] || 0;
      if (owned <= 0) break;
      // Forced sales pay the normal sell-back price (rulebook §11/§17): one step
      // below market. Single-share sales don't move the price (as elsewhere).
      const price = sellBackPrice(s, code);
      const realized = recordStockSale(p, code, 1, price, owned);
      p.cash += price;
      p.shares[code] = owned - 1;
      if (p.shares[code] === 0) delete p.shares[code];
      if (s.soldOut[code]) s.bankPool[code] = (s.bankPool[code] || 0) + 1;
      else s.supply[code] = (s.supply[code] || 0) + 1;
      addLog(s, `${p.name} force-sells 1 ${code} @ ${money(price)} to cover ${iv.label} · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)}`, 'r');
      addTradeLog(s, 'sell', `1× ${code} @ ${money(price)} (forced) · ${realized >= 0 ? 'gain' : 'loss'} ${money(realized)}`, price, p.name);
      recomputeAndLogClaim(s, code);
      break;
    }
    case 'payInsolvency': {
      const iv = s.insolvency;
      if (!iv) break;
      const p = s.players[iv.player];
      const hasSellable = Object.keys(p.shares).some((c) => !isIpoCode(c) && (p.shares[c] ?? 0) > 0);
      if (p.cash < iv.owed && hasSellable) break; // keep selling while there's stock left
      const paid = Math.min(Math.max(p.cash, 0), iv.owed);
      p.cash -= paid;
      if (iv.payTo != null) s.players[iv.payTo].cash += paid;
      const waived = iv.owed - paid;
      addLog(s, waived > 0
        ? `${p.name} pays ${money(paid)} toward ${iv.label} — ${money(waived)} waived (out of shares).`
        : `${p.name} pays ${money(paid)} to settle ${iv.label}.`, waived > 0 ? 'y' : 'g');
      if (iv.payTo != null) {
        addTradeLog(s, 'payout', `Payout Claim → ${s.players[iv.payTo].name}`, -paid, p.name);
        addTradeLog(s, 'payout', `Payout Claim from ${p.name}`, paid, s.players[iv.payTo].name);
      }
      pushFeeEvent(s, iv.reason, p, -paid);
      s.insolvency = null;
      break;
    }

    // ---- short sell (legacy state — no longer triggered from board) ----
    case 'doShort': {
      const { code } = action;
      if (!s.opts.shorts || !s.shortPick) break;
      if (isIpoCode(code)) break;
      if (s.shorts.some((sh) => sh.owner === s.cur)) break;
      const p = s.players[s.cur];
      s.shorts.push({ owner: s.cur, ownerName: p.name, pcolor: p.color, code, entryStep: s.prices[code] });
      setMarketStance(p, 'bearish');
      addLog(s, `${p.name} shorts ${code} @ ${money(priceOf(s, code))}`, 'r');
      addTradeLog(s, 'short', `Short ${code} @ ${money(priceOf(s, code))}`, 0, p.name);
      s.shortPick = false;
      break;
    }
    case 'skipShort':
      s.shortPick = false;
      break;

    // ---- IPO ----
    case 'pickKnownIpo': {
      const ip = ipoOf(s, action.code);
      if (!ip.revealed || ip.supply <= 0) break;
      const price = LADDER[ip.step];
      s.ipoListPick = false;
      s.ipoBuy = { code: action.code, max: 2, bought: 0, price, actor: s.cur };
      addLog(s, `Buying IPO ${action.code} @ ${money(price)} (up to 2 shares).`, 'g');
      break;
    }
    case 'ipoBuyShare': {
      const b = s.ipoBuy;
      if (!b) break;
      if (b.actor !== s.cur) break; // only the player on the IPO space may buy
      const ip = ipoOf(s, b.code);
      const p = s.players[b.actor];
      if (b.bought >= b.max || ip.supply <= 0 || p.cash < b.price) break;
      p.cash -= b.price;
      p.shares[b.code] = (p.shares[b.code] || 0) + 1;
      addStockCostBasis(p, b.code, b.price);
      ip.supply -= 1; b.bought += 1;
      // IPO prices never move from buying/selling (rulebook §16) — only card
      // effects move them, via moveEventPrice.
      addLog(s, `${p.name} buys 1 ${b.code} (IPO) @ ${money(b.price)}`, 'g');
      addTradeLog(s, 'ipo', `1× ${b.code} IPO @ ${money(b.price)}`, -b.price, p.name);
      break;
    }
    case 'ipoBuyDone':
      s.ipoBuy = null; s.ipoChoice = false; s.ipoListPick = false;
      break;
    case 'skipIpo':
      s.ipoBuy = null; s.ipoChoice = false; s.ipoListPick = false;
      break;

    // ---- Investor Day ----
    case 'chooseInvestorGrowth': {
      const prompt = s.investorDay;
      if (!prompt) break;
      const p = s.players[s.cur];
      s.investorDay = null;
      if (prompt.eligibleCodes.length === 0) {
        p.cash += 500;
        addLog(s, `${p.name} chooses Company Growth with no company able to rise — collects ${money(500)}.`, 'g');
      } else {
        s.pick = {
          d: 1,
          label: 'Company Growth — choose one company you own to move UP 1 step',
          codes: prompt.eligibleCodes,
          source: 'investor',
        };
        addLog(s, `${p.name} chooses Company Growth — select one owned company to move up 1 step.`, 'g');
      }
      break;
    }
    case 'chooseInvestorTip': {
      if (!s.investorDay) break;
      const p = s.players[s.cur];
      s.investorDay = null;
      // A peek never removes the card. If the live pile is exhausted, prepare
      // its normal reshuffle now so this is the same card the next draw reveals.
      if (s.decks.ME.length === 0 && s.discard.ME.length > 0) {
        s.decks.ME = rng.shuffle(s.discard.ME);
        s.discard.ME = [];
      }
      const idx = s.decks.ME[0];
      const next = idx == null ? null : CARDS.ME[idx];
      if (!next) {
        p.cash += 500;
        addLog(s, `${p.name} finds no Market Event to preview — collects ${money(500)} instead.`, 'y');
        break;
      }
      s.card = next;
      s.cardPreviewMode = 'insider';
      addLog(s, `${p.name} uses Insider Information — next Market Event: ${next.title}. The card stays on top of the deck.`, 'y');
      break;
    }

    // ---- card draw & effect ----
    case 'draw': {
      const { deck } = action;
      // Resolve the head of the queue only — forced draws are taken in order.
      if (s.pendingDraws[0] !== deck) break;
      // Recycle an exhausted deck by RESHUFFLING its discard pile — reusing it
      // in drawn order would repeat the exact same card sequence.
      if (s.decks[deck].length === 0) { s.decks[deck] = rng.shuffle(s.discard[deck]); s.discard[deck] = []; }
      const idx = s.decks[deck].shift()!;
      const c = CARDS[deck][idx];
      // Circuit Breaker physically leaves the Market Event deck while held. It
      // returns to that discard pile only after the holder plays it.
      if (c.eff.k !== 'circuitBreaker') s.discard[deck].push(idx);
      s.card = c;
      s.cardPreviewMode = null;
      s.pendingDraws.shift();
      s.lastDraw = { deck, title: c.title, seq: (s.lastDraw?.seq ?? 0) + 1 };
      // NOTE: do NOT clear s.trade here. A player can owe a forced draw (e.g. from
      // landing on The Fed / Market Event) while also holding a trade
      // interaction; clearing trade would silently strip their landing trade.
      addLog(s, `Drew ${DECK_META[deck].label}: ${c.title}`, deck === 'ME' ? 'r' : deck === 'FED' ? 'y' : 'b');
      recordCardSignal(s, c);
      if (deck === 'ME') beginMarketEventEffect(s, c.eff);
      else applyEffect(s, c.eff);
      break;
    }
    case 'pickTarget': {
      if (!s.pick) break;
      if (s.pick.codes && !s.pick.codes.includes(action.code)) break;
      if (s.pick.d < 0 && s.pick.protectedCodes?.includes(action.code)) {
        addLog(s, `Circuit Breaker shields ${action.code} from this card's price drop.`, 'g');
      } else {
        if (s.pick.source === 'investor') moveTradePrice(s, action.code, s.pick.d);
        else moveEventPrice(s, action.code, s.pick.d);
        addLog(s, `${action.code} moves ${s.pick.d > 0 ? '+' : ''}${s.pick.d} step`, s.pick.d > 0 ? 'g' : 'r');
      }
      s.pick = null;
      break;
    }
    case 'skipPick':
      s.pick = null;
      break;
    case 'playCircuitBreaker':
      resolveCircuitBreaker(s, action.code);
      break;
    case 'passCircuitBreaker':
      resolveCircuitBreaker(s, null);
      break;

    // ---- ETF ----
    case 'buyEtf': {
      const etf = ETF_BY_CODE[action.code];
      if (!etf || s.etfPick !== action.code) break;
      const p = s.players[s.cur];
      if (p.cash < ETF_PRICE) break;
      p.cash -= ETF_PRICE;
      p.etfShares[etf.code] = (p.etfShares[etf.code] || 0) + 1;
      s.etfPick = null;
      addLog(s, `${p.name} buys 1 ${etf.name} share @ ${money(ETF_PRICE)}`, 'b');
      addTradeLog(s, 'buy', `1× ${etf.name} ETF @ ${money(ETF_PRICE)}`, -ETF_PRICE, p.name);
      break;
    }
    case 'skipEtf':
      s.etfPick = null;
      break;

    // ---- bank auctions (Market Open, ascending turn-order bidding) ----
    case 'auctionBid':
      handleBid(s, action.amount);
      break;
    case 'auctionPass':
      handlePass(s);
      break;

    // ---- Market Open Trading Window (all players may P2P trade / bid; no bank sell-back) ----
    case 'closeMarketOpenWindow': {
      if (!s.marketOpenWindow) break;
      if (s.auction) break; // pooled-share auctions must finish before the window closes
      s.marketOpenWindow = false;
      addLog(s, 'Market Open Trading Window closed.');
      break;
    }

    // ---- player-to-player trading (negotiated price, never moves the market) ----
    case 'proposeP2POffer': {
      if (s.auction) break; // no private trades while a Bank Auction is live
      const { from, to, code, qty, direction, price } = action;
      if (from === to) break;
      if (from < 0 || from >= s.players.length || to < 0 || to >= s.players.length) break;
      if (qty < 1 || price < 0) break;
      if (!STOCK_BY_CODE[code] && !IPO_BY_CODE[code]) break; // regular stock or IPO only — never ETFs
      s.p2pSeq += 1;
      s.p2pOffers.push({ id: s.p2pSeq, from, to, code, qty, direction, price });
      const proposer = s.players[from];
      const counterparty = s.players[to];
      const verb = direction === 'sell' ? 'sell' : 'buy';
      addLog(s, `${proposer.name} offers to ${verb} ${qty}× ${code} ${direction === 'sell' ? 'to' : 'from'} ${counterparty.name} for ${money(price)}`, 'b');
      break;
    }
    case 'acceptP2POffer': {
      const idx = s.p2pOffers.findIndex((o) => o.id === action.id);
      if (idx < 0) break;
      const offer = s.p2pOffers[idx];
      s.p2pOffers.splice(idx, 1);
      const ok = resolveP2POffer(s, offer);
      if (!ok) addLog(s, `Trade offer between ${s.players[offer.from].name} and ${s.players[offer.to].name} fell through — insufficient shares or cash.`, 'r');
      break;
    }
    case 'declineP2POffer': {
      const idx = s.p2pOffers.findIndex((o) => o.id === action.id);
      if (idx < 0) break;
      const offer = s.p2pOffers[idx];
      s.p2pOffers.splice(idx, 1);
      addLog(s, `${s.players[offer.to].name} declined ${s.players[offer.from].name}'s trade offer.`);
      break;
    }
    case 'cancelP2POffer': {
      const idx = s.p2pOffers.findIndex((o) => o.id === action.id);
      if (idx < 0) break;
      const offer = s.p2pOffers[idx];
      s.p2pOffers.splice(idx, 1);
      addLog(s, `${s.players[offer.from].name} withdrew their trade offer to ${s.players[offer.to].name}.`);
      break;
    }

    // ---- market close & turn management ----
    case 'callClose':
      triggerClose(s);
      break;
    case 'endTurn': {
      if (blocked(s)) break;
      if (s.bonusRollPending) {
        s.bonusRollPending = false;
        s.turnPhase = 'preRoll';
        s.dice = [null, null];
        clearTurnState(s);
        addLog(s, `Doubles bonus — ${s.players[s.cur].name} rolls again.`, 'y');
        break;
      }
      const n = s.players.length;
      if (s.closing) {
        const next = (s.cur + 1) % n;
        if (next === s.closeDrawer) {
          if (s.extendedRoundsLeft > 0) {
            s.extendedRoundsLeft -= 1;
            addLog(s, `Extended Hours round — one more pass before Market Close.`, 'y');
          } else {
            s.phase = 'over'; break;
          }
        }
      }
      // Snapshot current ranks (includes ETF value) before advancing turn
      const ranked = [...s.players]
        .map((p, i) => ({ i, score: rankingScore(s, p), nw: netWorth(s, p) }))
        .sort((a, b) => b.score - a.score || b.nw - a.nw);
      ranked.forEach((entry, rank) => { s.players[entry.i].prevRank = rank; });
      s.cur = (s.cur + 1) % n;
      if (s.cur === 0) startLap(s);
      // Arm Market Close when the configured final round begins. The closing
      // flow then lets every player finish that round and ends before another
      // lap starts. Waiting until lap > closeRounds added an unintended full
      // extra round to every fixed-length game.
      if (s.opts.closeMode === 'rounds' && s.lap >= s.opts.closeRounds && !s.closing) {
        triggerClose(s);
      }
      s.turnPhase = 'preRoll';
      s.dice = [null, null];
      s.bonusRollPending = false;
      s.bonusRollUsed = false;
      clearTurnState(s);
      settleShorts(s);
      addLog(s, `— ${s.players[s.cur].name}'s turn —`);
      break;
    }
  }
}
