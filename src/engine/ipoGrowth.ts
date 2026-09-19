// IPO growth investments and milestones (2026-09-19). Runs on Immer drafts.

import { IPO_BY_CODE, IPO_GROWTH_INVESTMENTS, IPO_MILESTONES, isIpoCode } from '../data';
import type { IpoGrowthSize } from '../data';
import { money, pctBp } from '../utils/formatMoney';
import type { GameState, LogKind } from './types';
import { canMarketSell, ipoOf } from './rules';
import { moveTradePrice } from './stockState';
import { recordMarketSignal } from './marketSignals';

function addLog(s: GameState, text: string, kind: LogKind = 'n'): void {
  s.log.unshift({ text, kind, t: s.lap });
  if (s.log.length > 40) s.log.pop();
}

/** Percent an IPO is above (or below) its launch price. */
export function ipoPctFromLaunch(s: GameState, code: string): number {
  const ip = ipoOf(s, code);
  return ip.startPrice > 0 ? ((ip.price - ip.startPrice) / ip.startPrice) * 100 : 0;
}

/** The next milestone an IPO has not yet paid, or null once all have. */
export function nextIpoMilestone(s: GameState, code: string) {
  return IPO_MILESTONES[ipoOf(s, code).milestonesPaid ?? 0] ?? null;
}

// ── Growth investment ───────────────────────────────────────────────────────

/** Why the current player can't make this growth investment now, or null. */
export function ipoGrowthBlockReason(s: GameState, code: string, size: IpoGrowthSize): string | null {
  if (!s.opts.ipos) return 'IPOs are turned off for this game.';
  if (!isIpoCode(code) || !IPO_BY_CODE[code]) return 'Only IPOs take growth investments.';
  if (!ipoOf(s, code).revealed) return `${code} has not launched yet.`;
  if ((s.players[s.cur].shares[code] ?? 0) <= 0) return `You need at least 1 share of ${code} to fund its growth.`;
  if (s.ipoGrowthThisTurn) return 'You have already made an IPO growth investment this turn.';
  if ((s.ipoBoughtThisTurn ?? []).includes(code)) return `You bought ${code} shares this turn — fund its growth on a later turn.`;
  if (!canMarketSell(s)) return 'Roll and resolve every required action first.';
  const inv = IPO_GROWTH_INVESTMENTS[size];
  if (s.players[s.cur].cash < inv.cost) return `${inv.label} costs ${money(inv.cost)}.`;
  return null;
}

export function investIpoGrowth(s: GameState, code: string, size: IpoGrowthSize): void {
  if (ipoGrowthBlockReason(s, code, size)) return;
  const p = s.players[s.cur];
  const inv = IPO_GROWTH_INVESTMENTS[size];
  p.cash -= inv.cost;
  s.ipoGrowthThisTurn = true;
  // Through the trade mover, like Investor Day's Company Growth: a player-
  // driven rise, so crossing $5,000 queues a Market Event the same way.
  const r = moveTradePrice(s, code, inv.bp, 'ipoGrowth');
  addLog(s, `${p.name} makes a ${inv.label} in ${code} for ${money(inv.cost)} — ${code} ${pctBp(r.pct)} to ${money(r.after)}.`, 'g');
}

// ── Milestones ──────────────────────────────────────────────────────────────

/** Record every player's IPO holdings as the new turn begins. */
export function snapshotIpoHoldings(s: GameState): void {
  const snap: GameState['ipoSharesAtTurnStart'] = {};
  s.players.forEach((p, i) => {
    const held: Record<string, number> = {};
    for (const [code, n] of Object.entries(p.shares)) if (isIpoCode(code) && n > 0) held[code] = n;
    snap[i] = held;
  });
  s.ipoSharesAtTurnStart = snap;
}

/**
 * Pay any milestone an IPO has newly reached. Runs after every action so every
 * price source is covered. `turnStart` is the holdings snapshot for the turn in
 * which the move happened — taken before the action, because End Turn replaces
 * the snapshot for the next turn after any round-end repricing. A player earns
 * on the smaller of what they held then and what they hold now, so shares
 * bought during the turn don't qualify and shares sold during it don't either.
 * If one move clears several thresholds, each pays in order.
 */
export function payIpoMilestones(s: GameState, turnStart: GameState['ipoSharesAtTurnStart']): void {
  for (const ip of s.ipos) {
    if (!ip.revealed) continue;
    ip.milestonesPaid ??= 0;
    while (ip.milestonesPaid < IPO_MILESTONES.length) {
      const m = IPO_MILESTONES[ip.milestonesPaid];
      if (ipoPctFromLaunch(s, ip.code) < m.pct) break;
      const paid: string[] = [];
      s.players.forEach((p, i) => {
        const qualifying = Math.min(turnStart[i]?.[ip.code] ?? 0, p.shares[ip.code] ?? 0);
        if (qualifying <= 0) return;
        const amount = qualifying * m.perShare;
        p.cash += amount;
        paid.push(`${p.name} ${money(amount)}`);
      });
      ip.milestonesPaid += 1;
      const who = paid.length ? paid.join(', ') : 'no qualifying holders';
      addLog(s, `${ip.code} reaches ${m.name} (+${m.pct}% from launch) — ${money(m.perShare)}/share: ${who}.`, 'g');
      recordMarketSignal(s, {
        kind: 'ipo',
        title: `IPO Milestone · ${ip.code} ${m.name}`,
        summary: `${ip.code} is up ${m.pct}% from its launch price. Holders earn ${money(m.perShare)} per share held before this turn (${who}).`,
        impacts: [],
      });
    }
  }
}
