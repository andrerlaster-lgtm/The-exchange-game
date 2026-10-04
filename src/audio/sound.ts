// Game sounds. Recorded effects from Kenney's Casino Audio, RPG Audio, Interface Sounds and
// Music Jingles packs (CC0, kenney.nl), converted to AAC in public/audio so they play on iPhone too.
//
// Sounds are chosen in one place: the store calls soundForAction() after every dispatched
// action with the state before and after, so no component has to know about audio.

import type { Action, GameState } from '../engine';

const NAMES = [
  'diceShake', 'diceThrow1', 'diceThrow2', 'cardSlide', 'cardPlace', 'cardShuffle', 'cardFan',
  'chipsStack', 'chipsHandle', 'chipLay', 'chipsCollide', 'coins', 'coins2', 'sign', 'pageFlip',
  'uiMove', 'uiConfirm', 'uiBack', 'uiError', 'uiOpen', 'uiClose', 'uiToggle', 'uiTick',
  'jWin', 'jGood', 'jBad', 'jAlert', 'jRound',
] as const;
export type SoundName = (typeof NAMES)[number];

const KEY = 'exchange-sound-v1';
interface SoundSettings { muted: boolean; volume: number }
const settings: SoundSettings = { muted: false, volume: 0.7 };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (saved && typeof saved.muted === 'boolean') settings.muted = saved.muted;
  if (saved && typeof saved.volume === 'number') settings.volume = Math.min(1, Math.max(0, saved.volume));
} catch { /* defaults */ }

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers: Partial<Record<SoundName, AudioBuffer>> = {};
const listeners = new Set<() => void>();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* not saved */ }
  listeners.forEach((l) => l());
}

/** Browsers only allow audio after a tap or key press, so the first one sets everything up. */
function unlock() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  } catch { return; }
  master = ctx.createGain();
  master.gain.value = settings.volume;
  master.connect(ctx.destination);
  for (const name of NAMES) {
    fetch(`${import.meta.env.BASE_URL}audio/${name}.m4a`)
      .then((r) => r.arrayBuffer())
      .then((b) => ctx!.decodeAudioData(b))
      .then((decoded) => { buffers[name] = decoded; })
      .catch(() => { /* that sound just stays silent */ });
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

export function play(name: SoundName, { vol = 1, delay = 0, rate = 1 } = {}) {
  if (settings.muted || !ctx || !master) return;
  const buf = buffers[name];
  if (!buf) return;
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
  g.gain.value = vol;
  src.connect(g).connect(master);
  src.start(ctx.currentTime + delay);
}

export const soundSettings = {
  get: (): SoundSettings => ({ ...settings }),
  setMuted(muted: boolean) { settings.muted = muted; save(); if (!muted) play('uiToggle', { vol: 0.6 }); },
  setVolume(v: number) { settings.volume = Math.min(1, Math.max(0, v)); if (master && ctx) master.gain.setTargetAtTime(settings.volume, ctx.currentTime, 0.05); save(); },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

// ---------- What each move sounds like ----------
const BUYS = new Set(['buy', 'buyCompanyShare', 'ipoBuyShare', 'buyEtf', 'buyOutstandingShares', 'pickKnownIpo', 'buyOpeningBell', 'buyMarketProtection', 'investIpoGrowth', 'auctionBid']);
const SELLS = new Set(['sell', 'sellCompanyShare', 'marginSell', 'forcedSell']);
const PAYS = new Set(['payLandingFee', 'payMarginCall', 'payInsolvency', 'payBankLoan', 'payCyberattackFee', 'payRegulatoryInvestigation', 'payPlayerDebt', 'payFeeDebt', 'repayMargin', 'repayCompanyLoan', 'choosePayoutPayCash', 'choosePayoutForceSell']);
const BORROWS = new Set(['takeBankLoan', 'takeCompanyLoan', 'takeMargin', 'requestPlayerLoan', 'choosePayoutLoan']);
const QUIET = new Set(['skipStock', 'skipIpo', 'skipEtf', 'skipPick', 'passOpeningBell', 'passCircuitBreaker', 'auctionPass', 'ackLandingNotice', 'dismissMarketOpenReport', 'ipoBuyDone', 'outstandingBuyDone', 'deferLandingFee', 'declinePlayerLoan', 'endTurn']);
// Cash going up from these is the move itself, not income.
const CASH_FROM_MOVE = new Set([...SELLS, ...BORROWS, 'acceptP2POffer', 'declineP2POffer']);

export function soundForAction(a: Action, before: GameState, after: GameState) {
  if (after === before) { if (!QUIET.has(a.t)) play('uiError', { vol: 0.5 }); return; }
  switch (a.t) {
    case 'roll':
    case 'rollForOrder':
      play('diceShake', { vol: 0.8 });
      play('diceThrow1', { delay: 0.35 });
      break;
    case 'rollLoanRate': case 'rollRegime': case 'rollRateDecision':
      play('diceThrow2'); break;
    case 'draw': play('cardSlide'); break;
    case 'chooseInvestorGrowth': case 'chooseInvestorTip': case 'chooseInvestorUpgrade': case 'pickTarget':
      play('cardPlace'); break;
    case 'upgradeCompany': play('sign'); play('chipsStack', { delay: 0.1 }); break;
    case 'startGame': case 'newGame': play('cardShuffle', { vol: 0.8 }); break;
    case 'proposeP2POffer': play('pageFlip'); break;
    case 'acceptP2POffer': play('coins'); break;
    case 'declineP2POffer': case 'cancelP2POffer': play('uiBack'); break;
    case 'playCircuitBreaker': case 'callClose': play('jAlert', { vol: 0.8 }); break;
    default:
      if (BUYS.has(a.t)) play('chipsStack');
      else if (SELLS.has(a.t)) play('chipsHandle');
      else if (PAYS.has(a.t)) play('chipLay');
      else if (BORROWS.has(a.t)) play('sign');
      else if (QUIET.has(a.t)) play('uiTick', { vol: 0.5 });
  }

  // Things that happened as a result of the move.
  if (before.phase !== 'over' && after.phase === 'over') { play('jWin', { delay: 0.3 }); return; }
  if ((!before.marginCall && after.marginCall) || (!before.insolvency && after.insolvency)) play('jAlert', { delay: 0.25 });
  else if (!before.payoutShortfallChoice && after.payoutShortfallChoice) play('jBad', { delay: 0.25 });
  if (!before.marketOpenReport && after.marketOpenReport) play('jRound', { delay: 0.4, vol: 0.8 });
  if (!before.landingNotice && after.landingNotice) play('pageFlip', { delay: 0.3, vol: 0.8 });
  const pi = before.cur;
  const gained = (after.players[pi]?.cash ?? 0) - (before.players[pi]?.cash ?? 0);
  if (gained > 0 && !CASH_FROM_MOVE.has(a.t)) play(gained >= 5000 ? 'coins' : 'coins2', { delay: 0.45, vol: 0.85 });
}
