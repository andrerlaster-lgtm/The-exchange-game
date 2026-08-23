// Card effect application and market-close trigger (called on Immer drafts).

import { CARDS, CIRCUIT_BREAKER_INDEX, LADDER, MARKET_RUN_MOVE_BY_RISK, REGULAR_SUPPLY, STOCK_BY_CODE } from '../data';
import { money } from '../utils/formatMoney';
import type { Card, Effect } from '../data/types';
import type { GameState, LogKind, MarketSignalImpact } from './types';
import { companyBuyoutCost, eventPool, stepOf } from './rules';
import { moveEventPrice } from './stockState';
import { pushFeeEvent } from './feeLog';
import { recordCardSignal, recordMarketSignal } from './marketSignals';
import { marketStanceMeta, regimeCashDelta } from './marketRegime';
import { payDividendCard } from './playerState';
import { netWorth } from './scoringEngine';
import { addFeeDebt } from './feeDebt';
import { applyMeterSentiment, moveMeterTowardNeutral } from './marketMeter';
import type { Rng } from '../utils/rng';

const CEILING_STEP = LADDER.length - 1;

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

function cyberattackFee(s: GameState, player: number): number {
  return Math.max(500, Math.round(netWorth(s, s.players[player]) * 0.03 / 100) * 100);
}

/** Codes whose price this BATCH effect can move down right now (sector, all,
    risk, multi, regime only). Circuit Breaker is intentionally limited to
    Market Events. 'pick', 'lowest', and 'highest' are deliberately absent
    here — each names exactly one target, so their Circuit Breaker offer is
    made against that single locked `targetCode` (see `beginMarketEventEffect`
    and `actionResolver.ts`'s `pickTarget`), never a predicted set. */
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
    case 'regime':
      if (e.regime === 'bear') {
        codes = [
          ...Object.values(STOCK_BY_CODE).filter((stock) => stock.risk !== 'Low').map((stock) => stock.code),
          ...s.ipos.filter((ipo) => ipo.revealed).map((ipo) => ipo.code),
        ];
      }
      break;
  }
  return [...new Set(codes)].filter((code) => stepOf(s, code) > 0);
}

/**
 * Fair automatic target selection for 'lowest'/'highest' cards: among
 * eligible companies (able to move in the required direction) tied for the
 * extreme price, break the tie with the seeded RNG — never with array or
 * object insertion order, so the result replays identically after save/load
 * given the same seed. Returns null when no company can legally move.
 */
export function selectExtremeTarget(
  s: GameState,
  e: Extract<Effect, { k: 'lowest' | 'highest' }>,
  rng?: Rng,
): string | null {
  const dir: 1 | -1 = e.d > 0 ? 1 : -1;
  const eligible = eventPool(s).filter((x) => (dir === 1 ? stepOf(s, x.code) < CEILING_STEP : stepOf(s, x.code) > 0));
  if (eligible.length === 0) return null;
  const extremeStep = eligible.reduce((best, x) => {
    const step = stepOf(s, x.code);
    return (e.k === 'lowest' ? step < best : step > best) ? step : best;
  }, stepOf(s, eligible[0].code));
  const tied = eligible.filter((x) => stepOf(s, x.code) === extremeStep);
  return (tied.length === 1 ? tied[0] : tied[rng ? rng.int(0, tied.length - 1) : 0]).code;
}

/** Owned companies the Circuit Breaker holder can actually shield from the
    currently pending effect. When `targetCode` is set (a 'pick' card once
    the drawing player has chosen, or a 'lowest'/'highest' card once fair
    seeded selection has already run), the only "option" is that one code. */
export function circuitBreakerOptions(s: GameState): string[] {
  const prompt = s.circuitBreakerPrompt;
  if (!prompt) return [];
  const p = s.players[prompt.player];
  if (prompt.targetCode != null) {
    return (p.shares[prompt.targetCode] ?? 0) > 0 ? [prompt.targetCode] : [];
  }
  return negativeEffectCodes(s, prompt.effect).filter((code) => (p.shares[code] ?? 0) > 0);
}

/**
 * Resolve a fully-known card (its price effect is already settled — either
 * because it resolved immediately or a Circuit Breaker decision just
 * finished) into its market signal and one-time meter sentiment. This is the
 * single place both apply, so no path can record a "requested" signal or
 * skip the sentiment because it took a different route to resolution.
 */
export function finalizeCard(s: GameState, card: Card, impacts: MarketSignalImpact[]): void {
  recordCardSignal(s, card, impacts);
  if (card.meterSentiment) applyMeterSentiment(s, card.meterSentiment);
}

/** Begin resolving a freshly-drawn Market Event effect. The target must be
    known before Circuit Breaker is ever offered:
    - 'pick' only opens the target picker here; the Circuit Breaker decision
      (if any) happens in actionResolver's `pickTarget` case once the drawing
      player has actually chosen, then resolves through `resolveCircuitBreaker`.
    - 'lowest'/'highest' select their one fair, seeded target immediately, then
      offer Circuit Breaker on that specific company if the holder owns it.
    - Every other (batch) effect offers Circuit Breaker against the full set
      of eligible owned companies, exactly as before.
    Returns the real, resolved impacts when applied immediately; null when the
    caller must not finalize/record yet (paused for a Circuit Breaker
    decision, or a 'pick' effect deferred to pickTarget). */
export function beginMarketEventEffect(s: GameState, effect: Effect, rng?: Rng, card?: Card): MarketSignalImpact[] | null {
  if (effect.k === 'pick') {
    const impacts = applyEffect(s, effect, [], rng);
    // applyEffect only opens s.pick when an eligible target exists. If it
    // didn't (every legal target already clamped), there's nothing to defer
    // — finalize now with the empty impacts already logged inside applyEffect,
    // exactly like the lowest/highest no-target case below. Returning null
    // unconditionally here would silently drop the card's signal forever,
    // since nothing would ever open pickTarget to finalize it later.
    if (s.pick) {
      s.pick.card = card;
      return null;
    }
    return impacts;
  }
  if (effect.k === 'lowest' || effect.k === 'highest') {
    const target = selectExtremeTarget(s, effect, rng);
    if (target == null) {
      addLog(s, `No eligible company can move — no effect.`, 'y');
      return [];
    }
    const holder = s.circuitBreakerHolder;
    if (effect.d < 0 && holder != null && (s.players[holder].shares[target] ?? 0) > 0) {
      s.circuitBreakerPrompt = { player: holder, effect, targetCode: target, card };
      addLog(s, `${s.players[holder].name} may play Circuit Breaker on ${target} before it moves.`, 'y');
      return null;
    }
    const before = stepOf(s, target);
    moveEventPrice(s, target, effect.d);
    const after = stepOf(s, target);
    addLog(s, `${target} (${effect.k}) moves ${effect.d > 0 ? '+' : ''}${effect.d}`);
    return after !== before ? [{ code: target, d: after - before }] : [];
  }
  const holder = s.circuitBreakerHolder;
  if (holder == null) return applyEffect(s, effect, [], rng);
  s.circuitBreakerPrompt = { player: holder, effect, card };
  if (circuitBreakerOptions(s).length === 0) {
    s.circuitBreakerPrompt = null;
    return applyEffect(s, effect, [], rng);
  }
  addLog(s, `${s.players[holder].name} may play Circuit Breaker before prices move.`, 'y');
  return null;
}

/** Resolve the holder's play/pass choice, apply the paused event, then
    finalize (signal + meter sentiment) using the real outcome. The card to
    finalize against comes from `prompt.card`, captured when the prompt was
    created — never from the mutable `s.card`, which a later forced draw
    (e.g. a ceiling-crossing trade queuing another Market Event mid-pick) can
    overwrite before this decision resolves. `prompt.card` is undefined only
    for the pre-existing board-space Bull/Bear Run effect, which is not a
    Card and records its own (pre-existing, unchanged) signal before this
    pause ever begins. */
export function resolveCircuitBreaker(s: GameState, code: string | null): void {
  const prompt = s.circuitBreakerPrompt;
  if (!prompt) return;
  const holder = prompt.player;

  if (prompt.targetCode != null) {
    // targetCode is only ever set for 'pick'/'lowest'/'highest' — all three
    // carry a single-step `d`, unlike the other Effect variants.
    const targetEffect = prompt.effect as Extract<Effect, { k: 'pick' | 'lowest' | 'highest' }>;
    const target = prompt.targetCode;
    if (code != null && code !== target) return;
    // Ownership can change between the prompt opening and this decision (a
    // still-open trade step can sell the exact target out from under the
    // holder) — re-check now rather than trusting the prompt's snapshot,
    // the same way the batch branch below re-checks circuitBreakerOptions.
    if (code != null && (s.players[holder].shares[target] ?? 0) <= 0) return;
    s.circuitBreakerPrompt = null;
    let impacts: MarketSignalImpact[] = [];
    if (code == null) {
      addLog(s, `${s.players[holder].name} keeps Circuit Breaker for a future Market Event.`);
      const before = stepOf(s, target);
      moveEventPrice(s, target, targetEffect.d);
      const after = stepOf(s, target);
      if (after !== before) impacts = [{ code: target, d: after - before }];
    } else {
      s.circuitBreakerHolder = null;
      s.discard.ME.push(CIRCUIT_BREAKER_INDEX);
      addLog(s, `${s.players[holder].name} plays Circuit Breaker on ${target}.`, 'g');
    }
    if (prompt.effect.k === 'pick') s.pick = null;
    if (prompt.card) finalizeCard(s, prompt.card, impacts);
    return;
  }

  if (code != null && !circuitBreakerOptions(s).includes(code)) return;
  const effect = prompt.effect;
  s.circuitBreakerPrompt = null;
  if (code == null) {
    addLog(s, `${s.players[holder].name} keeps Circuit Breaker for a future Market Event.`);
    const impacts = applyEffect(s, effect);
    if (prompt.card) finalizeCard(s, prompt.card, impacts);
    return;
  }
  s.circuitBreakerHolder = null;
  s.discard.ME.push(CIRCUIT_BREAKER_INDEX);
  addLog(s, `${s.players[holder].name} plays Circuit Breaker on ${code}.`, 'g');
  const impacts = applyEffect(s, effect, [code]);
  if (prompt.card) finalizeCard(s, prompt.card, impacts);
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

/**
 * Apply an effect and return the REAL impacts (post-clamp, post-protection).
 * For 'pick', this only OPENS the target picker (`s.pick`) — same as the
 * pre-existing Investor Day "Company Growth" pattern, it never resolves a
 * move itself. Actual resolution (and any Circuit Breaker pause) happens in
 * actionResolver's `pickTarget` case and `resolveCircuitBreaker` above, once
 * a real target is known — a card's Circuit Breaker offer cannot be made
 * before the target it would protect is chosen.
 */
export function applyEffect(s: GameState, e: Effect, protectedCodes: string[] = [], rng?: Rng): MarketSignalImpact[] {
  const pool = eventPool(s);
  const protectedSet = new Set(protectedCodes);
  const impacts: MarketSignalImpact[] = [];
  const move = (code: string, d: number): boolean => {
    if (d < 0 && protectedSet.has(code)) {
      addLog(s, `Circuit Breaker shields ${code} from this card's price drop.`, 'g');
      return false;
    }
    const before = stepOf(s, code);
    moveEventPrice(s, code, d);
    const after = stepOf(s, code);
    if (after !== before) impacts.push({ code, d: after - before });
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
    // Fair automatic targets (see selectExtremeTarget): only reached here
    // when beginMarketEventEffect calls applyEffect directly (no Circuit
    // Breaker holder to consider) — the paused/protected path resolves the
    // pre-selected target itself, without re-entering this switch.
    case 'lowest':
    case 'highest': {
      const target = selectExtremeTarget(s, e, rng);
      if (target == null) {
        addLog(s, `No eligible company can move — no effect.`, 'y');
        break;
      }
      if (move(target, e.d)) addLog(s, `${target} (${e.k}) moves ${e.d > 0 ? '+' : ''}${e.d}`);
      break;
    }
    case 'pick': {
      // Only offer companies that can actually move in this direction. A
      // required target is never presented with an impossible choice, and
      // never needs a Skip — every listed code is legal.
      const dir: 1 | -1 = e.d > 0 ? 1 : -1;
      const eligible = pool
        .filter((x) => (dir === 1 ? stepOf(s, x.code) < CEILING_STEP : stepOf(s, x.code) > 0))
        .map((x) => x.code);
      if (eligible.length === 0) {
        addLog(s, `${e.label} finds no eligible company that can move — no effect.`, 'y');
        break;
      }
      s.pick = { d: e.d, label: e.label, codes: eligible, source: 'card' };
      break;
    }
    case 'cash':
      s.players[s.cur].cash += e.amt;
      addLog(s, `${s.players[s.cur].name} collects ${money(e.amt)}`, 'g');
      break;
    case 'dividend':
      payDividendCard(s, s.cur);
      break;
    case 'cyberattack': {
      const p = s.players[s.cur];
      const codes = Object.keys(p.shares).filter((code) => (p.shares[code] ?? 0) > 0 && stepOf(s, code) > 0);
      const fee = cyberattackFee(s, s.cur);
      if (codes.length === 0) {
        const paid = Math.min(Math.max(0, p.cash), fee);
        p.cash -= paid;
        const remaining = fee - paid;
        if (remaining > 0) addFeeDebt(p, remaining);
        addLog(s, `${p.name} has no holding to shield from Cyberattack — charged ${money(fee)}${remaining > 0 ? ` (${money(remaining)} carried as debt)` : ''}.`, 'r');
      } else {
        s.cyberattackPrompt = { player: s.cur, fee, codes };
        addLog(s, `${p.name} must resolve Cyberattack: protect a holding or pay ${money(fee)}.`, 'r');
      }
      break;
    }
    case 'openingBell': {
      const candidates = Object.values(STOCK_BY_CODE).filter((stock) =>
        s.supply[stock.code] === REGULAR_SUPPLY && !s.soldOut[stock.code]
          && !s.players.some((p) => (p.shares[stock.code] ?? 0) > 0),
      );
      if (candidates.length === 0) {
        addLog(s, 'Opening Bell finds no untouched company — the opportunity passes.', 'y');
        break;
      }
      const stock = candidates[rng ? rng.int(0, candidates.length - 1) : 0];
      // Live price, not the fixed starting tier price — an "untouched"
      // company (never bought/sold) can still have had its price moved by a
      // market event or Bull/Bear Run. Charging the stale tier price here
      // would book the same instant unrealized loss/gain the landing buy-out
      // fix (2026-08-23) addressed for the other acquisition path.
      const cost = companyBuyoutCost(s, stock.code);
      s.openingBellPrompt = { player: s.cur, code: stock.code, price: cost };
      addLog(s, `${s.players[s.cur].name} gets an Opening Bell opportunity: buy untouched ${stock.code} for ${money(cost)}, or pass.`, 'b');
      break;
    }
    case 'regulatoryInvestigation': {
      const p = s.players[s.cur];
      const codes = Object.keys(p.shares).filter((code) => (p.shares[code] ?? 0) > 0 && stepOf(s, code) > 0);
      const fee = 5_000;
      if (codes.length === 0) {
        const paid = Math.min(Math.max(0, p.cash), fee);
        p.cash -= paid;
        const remaining = fee - paid;
        if (remaining > 0) addFeeDebt(p, remaining);
        addLog(s, `${p.name} has no holding to investigate — charged ${money(fee)}${remaining > 0 ? ` (${money(remaining)} carried as debt)` : ''}.`, 'r');
      } else {
        s.regulatoryInvestigationPrompt = { player: s.cur, fee, codes };
        addLog(s, `${p.name} must resolve Regulatory Investigation: penalize a holding or pay ${money(fee)}.`, 'r');
      }
      break;
    }
    case 'margin':
      s.players.forEach((p) => {
        if (p.margin > 0) {
          p.cash -= e.amt;
          addLog(s, `${p.name} margin call −${money(e.amt)}`, 'r');
          pushFeeEvent(s, 'marginCall', p, -e.amt);
        }
      });
      break;
    case 'regime': {
      const regularMove = MARKET_RUN_MOVE_BY_RISK[e.regime];
      Object.values(STOCK_BY_CODE).forEach((stock) => {
        const d = regularMove[stock.risk];
        if (d !== 0) move(stock.code, d);
      });
      s.ipos.filter((ipo) => ipo.revealed).forEach((ipo) => move(ipo.code, e.regime === 'bull' ? 1 : -1));

      const runLabel = e.regime === 'bull' ? 'Bull Run' : 'Bear Run';
      s.players.forEach((player) => {
        const stance = player.marketStance;
        const requested = regimeCashDelta(stance, e.regime);
        const before = player.cash;
        player.cash = Math.max(0, player.cash + requested);
        const actual = player.cash - before;
        const meta = marketStanceMeta(stance);
        addLog(s, `${meta.glyph} ${player.name} was ${meta.label} for the ${runLabel}: ${actual > 0 ? '+' : ''}${money(actual)}.`, requested >= 0 ? 'g' : 'r');
        player.marketStance = 'balanced';
      });
      break;
    }
    case 'circuitBreaker':
      s.circuitBreakerHolder = s.cur;
      addLog(s, `${s.players[s.cur].name} keeps Circuit Breaker for a future negative Market Event or Bear Run.`, 'g');
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
    case 'meterDelta':
      applyMeterSentiment(s, e.delta);
      addLog(s, `Market Meter moves ${e.delta > 0 ? '+' : ''}${e.delta} — no price change.`, e.delta > 0 ? 'g' : 'r');
      break;
    case 'meterTowardNeutral':
      moveMeterTowardNeutral(s, e.amount);
      addLog(s, `Market Meter cools ${e.amount} toward Neutral — no price change.`, 'y');
      break;
    case 'insiderPreview': {
      // A real, non-blocking peek: read the next card without shifting it out
      // of the live deck, discarding it, or resolving its effect — same
      // mechanic as the pre-existing Investor Day "Insider Information" tip
      // (chooseInvestorTip in actionResolver.ts), reused here for a card that
      // grants the same peek. Recycles the discard pile first if the live
      // pile is exhausted, same as a real draw would, but never draws.
      if (s.decks.ME.length === 0 && s.discard.ME.length > 0 && rng) {
        s.decks.ME = rng.shuffle(s.discard.ME);
        s.discard.ME = [];
      }
      const idx = s.decks.ME[0];
      const next = idx == null ? null : CARDS.ME[idx];
      if (!next) {
        addLog(s, 'Insider Information finds no upcoming Market Event to preview.', 'y');
        break;
      }
      s.card = next;
      s.cardPreviewMode = 'insider';
      addLog(s, `Insider Information reveals the next Market Event: ${next.title}. The card stays on top of the deck.`, 'y');
      break;
    }
    case 'none':
      break;
  }
  return impacts;
}
