// Card effect application and market-close trigger (called on Immer drafts).

import { STOCK_BY_CODE, isIpoCode } from '../data';
import { money } from '../utils/formatMoney';
import type { Effect } from '../data/types';
import type { GameState, LogKind } from './types';
import { eventPool, stepOf } from './rules';
import { isDiversified } from './scoringEngine';
import { moveEventPrice } from './stockState';
import { pushFeeEvent } from './feeLog';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

/** Offer diversified-portfolio crash protection if the current player qualifies. */
function offerDiversifiedProtection(s: GameState): void {
  const p = s.players[s.cur];
  if (!isDiversified(s, p)) return;
  const ownedCodes = Object.keys(p.shares).filter((c) => !isIpoCode(c));
  if (ownedCodes.length === 0) return;
  s.pick = {
    d: +1,
    label: 'Diversified Portfolio — choose 1 company to reduce its loss by 1 step',
    codes: ownedCodes,
  };
  addLog(s, `${p.name} holds a Diversified Portfolio — pick 1 stock to protect.`, 'g');
}

export function triggerClose(s: GameState): void {
  if (s.closing) return;
  s.closing = true;
  s.closeDrawer = s.cur;
  if (s.extendedHoursAvailable) {
    s.extendedHoursAvailable = false;
    s.extendedRoundsLeft = 1;
    addLog(s, `MARKET CLOSE — Extended Hours played! One additional round before final scoring.`, 'y');
  } else {
    addLog(s, `MARKET CLOSE — finish this round, then final scoring.`, 'r');
  }
}

export function applyEffect(s: GameState, e: Effect): void {
  const pool = eventPool(s);
  switch (e.k) {
    case 'sector':
      pool.filter((x) => x.sec === e.sec).forEach((x) => moveEventPrice(s, x.code, e.d));
      break;
    case 'all':
      pool.forEach((x) => moveEventPrice(s, x.code, e.d));
      if (e.crash && e.d < 0) offerDiversifiedProtection(s);
      break;
    case 'risk':
      Object.values(STOCK_BY_CODE).filter((x) => x.risk === e.risk)
        .forEach((x) => moveEventPrice(s, x.code, e.d));
      break;
    case 'multi':
      e.m.forEach((mv) => {
        if (mv.sec) pool.filter((x) => x.sec === mv.sec).forEach((x) => moveEventPrice(s, x.code, mv.d));
        else Object.values(STOCK_BY_CODE).filter((x) => x.risk === mv.risk)
          .forEach((x) => moveEventPrice(s, x.code, mv.d));
      });
      break;
    case 'lowest': {
      const t = pool.slice().sort((a, b) => stepOf(s, a.code) - stepOf(s, b.code))[0];
      moveEventPrice(s, t.code, e.d);
      addLog(s, `${t.code} (lowest) moves ${e.d > 0 ? '+' : ''}${e.d}`);
      break;
    }
    case 'highest': {
      const t = pool.slice().sort((a, b) => stepOf(s, b.code) - stepOf(s, a.code))[0];
      moveEventPrice(s, t.code, e.d);
      addLog(s, `${t.code} (highest) moves ${e.d > 0 ? '+' : ''}${e.d}`);
      break;
    }
    case 'pick':
      s.pick = { d: e.d, label: e.label };
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
