// Computer opponents. Wraps the simulation bot (src/ai/bot.ts) for live play:
// works out whose decision the game is waiting on, and if that player is a
// computer, picks the action. Idea borrowed from boardgame.io's bots; the
// decisions themselves come from the bot the balance simulations already use.

import { answerOffer, development, markets, nextAction, styles, trading } from './bot';
import type { Action, GameState } from '../engine';
import type { Rng } from '../utils/rng';

export const BOT_LABEL: Record<string, string> = {
  normal: 'Steady',
  cash: 'Cautious',
  investor: 'Investor',
};

/** The player index the game is currently waiting on, or null. */
export function decisionOwner(s: GameState): number | null {
  if (s.phase === 'orderRoll') return s.orderRoll?.pending[0] ?? null;
  if (s.phase !== 'play') return null;
  if (s.p2pOffers.length > 0) return s.p2pOffers[0].to;
  if (s.insolvency) return s.insolvency.player;
  return s.cur;
}

export function isBot(s: GameState, i: number | null): boolean {
  return i !== null && Boolean(s.players[i]?.bot);
}

/** True while a computer player owns the current decision (human input is ignored then). */
export function botTurn(s: GameState): boolean {
  return isBot(s, decisionOwner(s));
}

/** The computer player's next action, or null if it has nothing to do. */
export function botAction(s: GameState, rng: Rng): Action | null {
  const owner = decisionOwner(s);
  if (!isBot(s, owner)) return null;
  if (s.phase === 'orderRoll') return { t: 'rollForOrder' };

  // Live-play policy: each computer seat plays its own style; computers don't
  // start player-to-player trades (a human can still offer them one).
  styles.enabled = true;
  styles.bySeat = Object.fromEntries(s.players.map((p, i) => [i, p.bot ?? 'normal']));
  trading.enabled = false;
  development.enabled = true;
  markets.onlyPlayers = null;

  if (s.p2pOffers.length > 0) return answerOffer(s);
  // A human's forced sale during a computer's turn is the human's to resolve.
  if (s.insolvency && !isBot(s, s.insolvency.player)) return null;
  return nextAction(s, rng);
}
