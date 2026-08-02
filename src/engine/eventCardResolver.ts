// Card effect application and market-close trigger (called on Immer drafts).

import { CIRCUIT_BREAKER_INDEX, STOCK_BY_CODE } from '../data';
import { money } from '../utils/formatMoney';
import type { Effect } from '../data/types';
import type { GameState, LogKind } from './types';
import { eventPool, stepOf } from './rules';
import { moveEventPrice } from './stockState';
import { pushFeeEvent } from './feeLog';
import { recordMarketSignal } from './marketSignals';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

/** Codes whose price this effect can move down right now. Circuit Breaker is
    intentionally limited to Market Events; this helper only identifies the
    eligible company choices once such a card has been drawn. */
function negativeEffectCodes(s: GameState, e: Effect): string[] {
  const pool = eventPool(s);
  let codes: string[] = [];
  switch (e.k) {
    case 'sector':
      if (e.d < 0) codes = pool.filter((x) => x.sec === e.sec).map((x) => x.code);
      break;
    case 'all':
      if (e.d < 0) codes = pool.map((x) => x.code);
      break;
    case 'risk':
      if (e.d < 0) codes = Object.values(STOCK_BY_CODE).filter((x) => x.risk === e.risk).map((x) => x.code);
      break;
    case 'multi':
      for (const mv of e.m) {
        if (mv.d >= 0) continue;
        if (mv.sec) codes.push(...pool.filter((x) => x.sec === mv.sec).map((x) => x.code));
        else codes.push(...Object.values(STOCK_BY_CODE).filter((x) => x.risk === mv.risk).map((x) => x.code));
      }
      break;
    case 'lowest':
      if (e.d < 0 && pool.length > 0) codes = [pool.slice().sort((a, b) => stepOf(s, a.code) - stepOf(s, b.code))[0].code];
      break;
    case 'highest':
      if (e.d < 0 && pool.length > 0) codes = [pool.slice().sort((a, b) => stepOf(s, b.code) - stepOf(s, a.code))[0].code];
      break;
    case 'pick':
      if (e.d < 0) codes = Object.keys(STOCK_BY_CODE);
      break;
  }
  return [...new Set(codes)].filter((code) => stepOf(s, code) > 0);
}

/** Owned companies the Circuit Breaker holder can actually shield from the
    currently pending negative Market Event. */
export function circuitBreakerOptions(s: GameState): string[] {
  const prompt = s.circuitBreakerPrompt;
  if (!prompt) return [];
  const p = s.players[prompt.player];
  return negativeEffectCodes(s, prompt.effect).filter((code) => (p.shares[code] ?? 0) > 0);
}

/** Pause a negative Market Event only when the holder has an affected company.
    Otherwise the card resolves immediately and the held card stays available. */
export function beginMarketEventEffect(s: GameState, e: Effect): void {
  const holder = s.circuitBreakerHolder;
  if (holder == null) { applyEffect(s, e); return; }
  s.circuitBreakerPrompt = { player: holder, effect: e };
  if (circuitBreakerOptions(s).length === 0) {
    s.circuitBreakerPrompt = null;
    applyEffect(s, e);
    return;
  }
  addLog(s, `${s.players[holder].name} may play Circuit Breaker before prices move.`, 'y');
}

/** Resolve the holder's play/pass choice and then apply the paused event. */
export function resolveCircuitBreaker(s: GameState, code: string | null): void {
  const prompt = s.circuitBreakerPrompt;
  if (!prompt) return;
  if (code != null && !circuitBreakerOptions(s).includes(code)) return;
  const effect = prompt.effect;
  const holder = prompt.player;
  s.circuitBreakerPrompt = null;
  if (code == null) {
    addLog(s, `${s.players[holder].name} keeps Circuit Breaker for a future Market Event.`);
    applyEffect(s, effect);
    return;
  }
  s.circuitBreakerHolder = null;
  s.discard.ME.push(CIRCUIT_BREAKER_INDEX);
  addLog(s, `${s.players[holder].name} plays Circuit Breaker on ${code}.`, 'g');
  applyEffect(s, effect, [code]);
}

export function triggerClose(s: GameState): void {
  if (s.closing) return;
  s.closing = true;
  s.closeDrawer = s.cur;
  if (s.extendedHoursAvailable) {
    s.extendedHoursAvailable = false;
    s.extendedRoundsLeft = 1;
    addLog(s, `MARKET CLOSE — Extended Hours played! One additional round before final scoring.`, 'y');
    recordMarketSignal(s, {
      kind: 'close',
      title: 'Market Close Delayed',
      summary: 'Extended Hours added one final round before scoring.',
      impacts: [],
    });
  } else {
    addLog(s, `MARKET CLOSE — finish this round, then final scoring.`, 'r');
    // The Market Close card was already recorded as the latest important event.
    // A manually called close still needs its own signal.
    if (!(s.marketSignals[0]?.kind === 'market' && s.marketSignals[0]?.title === 'Market Close')) {
      recordMarketSignal(s, {
        kind: 'close',
        title: 'Market Close Called',
        summary: 'Finish the current round, then move to final scoring.',
        impacts: [],
      });
    }
  }
}

export function applyEffect(s: GameState, e: Effect, protectedCodes: string[] = []): void {
  const pool = eventPool(s);
  const protectedSet = new Set(protectedCodes);
  const move = (code: string, d: number): boolean => {
    if (d < 0 && protectedSet.has(code)) {
      addLog(s, `Circuit Breaker shields ${code} from this card's price drop.`, 'g');
      return false;
    }
    moveEventPrice(s, code, d);
    return true;
  };
  switch (e.k) {
    case 'sector':
      pool.filter((x) => x.sec === e.sec).forEach((x) => move(x.code, e.d));
      break;
    case 'all':
      pool.forEach((x) => move(x.code, e.d));
      break;
    case 'risk':
      Object.values(STOCK_BY_CODE).filter((x) => x.risk === e.risk)
        .forEach((x) => move(x.code, e.d));
      break;
    case 'multi':
      e.m.forEach((mv) => {
        if (mv.sec) pool.filter((x) => x.sec === mv.sec).forEach((x) => move(x.code, mv.d));
        else Object.values(STOCK_BY_CODE).filter((x) => x.risk === mv.risk)
          .forEach((x) => move(x.code, mv.d));
      });
      break;
    case 'lowest': {
      const t = pool.slice().sort((a, b) => stepOf(s, a.code) - stepOf(s, b.code))[0];
      if (move(t.code, e.d)) addLog(s, `${t.code} (lowest) moves ${e.d > 0 ? '+' : ''}${e.d}`);
      break;
    }
    case 'highest': {
      const t = pool.slice().sort((a, b) => stepOf(s, b.code) - stepOf(s, a.code))[0];
      if (move(t.code, e.d)) addLog(s, `${t.code} (highest) moves ${e.d > 0 ? '+' : ''}${e.d}`);
      break;
    }
    case 'pick':
      s.pick = { d: e.d, label: e.label, protectedCodes: e.d < 0 ? protectedCodes : undefined };
      break;
    case 'cash':
      s.players[s.cur].cash += e.amt;
      addLog(s, `${s.players[s.cur].name} collects ${money(e.amt)}`, 'g');
      break;
    case 'margin':
      s.players.forEach((p) => {
        if (p.margin > 0) {
          p.cash -= e.amt;
          addLog(s, `${p.name} margin call −${money(e.amt)}`, 'r');
          pushFeeEvent(s, 'marginCall', p, -e.amt);
        }
      });
      break;
    case 'circuitBreaker':
      s.circuitBreakerHolder = s.cur;
      addLog(s, `${s.players[s.cur].name} keeps Circuit Breaker for a future negative Market Event.`, 'g');
      break;
    case 'extend':
      // Banks a 1-round Market Close extension, consumed by triggerClose once
      // Market Close actually fires (rulebook §20 — "played before Market
      // Close triggers"). Drawing it after closing has already started is too
      // late — the bell already rang.
      if (s.closing) {
        addLog(s, `${s.players[s.cur].name} draws Extended Hours too late — Market Close has already been called.`);
      } else {
        s.extendedHoursAvailable = true;
        addLog(s, `${s.players[s.cur].name} banks Extended Hours — Market Close will be delayed by 1 round.`, 'g');
      }
      break;
    case 'close':
      triggerClose(s);
      break;
    case 'none':
      break;
  }
}
