import type { Action } from '../engine';
import type { StockOpportunity } from '../data';

export interface Player3DState {
  pos: number;
  piece: string;
  color: string;
  name: string;
  cash: number;
  margin: number;
  marketStance: 'bullish' | 'balanced' | 'bearish';
}

export interface CardPreview {
  deck: string;        // 'ME' | 'FED'
  title: string;
  effect: string;
  strategyOnly: boolean;
}

export interface LBEntry {
  rank: number;       // 0-based
  playerIdx: number;
  name: string;
  color: string;
  piece: string;
  nw: number;
  marketStance: 'bullish' | 'balanced' | 'bearish';
}

export interface TradeInfo3D {
  code: string;
  name: string;
  price: number;
  owned: number;
  supply: number;
  cash: number;
  actionsLeft: number;
  // Stock-card design fields
  sector: string;        // display name, e.g. 'Comms/Media'
  sectorColor: string;   // hex sector color
  glyph: string;         // sector glyph char
  risk: string;          // 'Low' | 'Med' | 'High'
  dividend: number;      // printed dividend per share
  opportunity: StockOpportunity;
  stepDiff: number;      // current step − starting step (signed)
  tier: string;          // Starter | Growth | Premium
  buyoutPrice: number;   // fixed whole-company acquisition price
  fedSignal: {
    label: string;
    tone: 'tailwind' | 'headwind' | 'mixed' | 'neutral';
    net: number;
    lastTitle: string | null;
  };
}

export type Board3DAction = Exclude<Action,
  | { t: 'setNum' }
  | { t: 'setName' }
  | { t: 'setPiece' }
  | { t: 'setOpt' }
  | { t: 'startGame' }
  | { t: 'toggleTest' }
>;

export interface ActionButton3D {
  label: string;
  action: Board3DAction;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'gold' | 'neutral';
}

export interface ActionRow3D {
  key: string;
  title: string;
  detail?: string;
  value?: string;
  color?: string;
  buttons?: ActionButton3D[];
}

export interface NumberAction3D {
  label: string;
  min: number;
  max?: number;
  step: number;
  value: number;
  action: 'auctionBid';
}

export interface ActionPanel3D {
  id: string;
  title: string;
  description?: string;
  accent?: string;
  urgent?: boolean;
  rows?: ActionRow3D[];
  buttons?: ActionButton3D[];
  numberAction?: NumberAction3D;
}

export interface P2PPlayer3D {
  index: number;
  name: string;
  color: string;
  cash: number;
  holdings: Array<{ code: string; name: string; qty: number }>;
}

export interface P2POffer3D {
  id: number;
  summary: string;
  warning?: string;
  canAccept: boolean;
}

export interface ActionCenter3D {
  required: ActionPanel3D[];
  marketIntel: ActionPanel3D;
  portfolio: ActionPanel3D;
  tradeDesk: {
    players: P2PPlayer3D[];
    offers: P2POffer3D[];
  };
  canCallClose: boolean;
  status: string;
}

/** Live per-stock price snapshot for board tiles/tooltips. */
export interface PriceInfo3D {
  p: number;        // current dollar price
  d: -1 | 0 | 1;    // direction vs printed starting step
  delta: number;    // signed ladder-step difference from opening
  s: number;        // shares remaining in supply
  so?: boolean;     // sold out (permanent)
  claim?: number | null; // Payout Claim holder player index; null = Contested
}

export interface Board3DPayload {
  players: Player3DState[];
  move?: { from: number; to: number; playerIdx: number };
  ts: number;
  canRoll: boolean;
  dice: [number | null, number | null];
  bonusRoll: 'earned' | 'active' | null;
  currentPlayerIdx: number;
  progress: string;
  leaderboard: LBEntry[];
  card: CardPreview | null;
  pendingDraw: string | null;
  canEndTurn: boolean;
  tradeInfo: TradeInfo3D | null;
  actionCenter: ActionCenter3D;
  prices: Record<string, PriceInfo3D>;
  /** Most recent draw event; seq is unique per draw so the 3D board animates once. */
  drawEvent: { deck: string; title: string; seq: number } | null;
  /** Cards remaining per deck (IPO = unrevealed listings). */
  deckCounts: { ME: number; FED: number; IPO: number };
}

export interface Board3DCommand {
  t: 'dispatch';
  action: Board3DAction;
  ts: number;
}

/** Runtime boundary for commands coming from the plain-JS 3D board. */
export function isBoard3DCommand(value: unknown): value is Board3DCommand {
  if (!value || typeof value !== 'object') return false;
  const command = value as { t?: unknown; ts?: unknown; action?: unknown };
  if (command.t !== 'dispatch' || typeof command.ts !== 'number') return false;
  if (!command.action || typeof command.action !== 'object') return false;
  return isBoard3DAction(command.action);
}

function isBoard3DAction(value: unknown): value is Board3DAction {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  if (typeof action.t !== 'string') return false;
  const text = (key: string) => typeof action[key] === 'string' && (action[key] as string).length > 0;
  const integer = (key: string) => Number.isInteger(action[key]);
  const nonNegativeNumber = (key: string) => typeof action[key] === 'number' && Number.isFinite(action[key]) && (action[key] as number) >= 0;

  switch (action.t) {
    case 'newGame': case 'roll': case 'takeMargin': case 'repayMargin': case 'payMarginCall':
    case 'payInsolvency': case 'skipShort': case 'ipoBuyShare': case 'ipoBuyDone':
    case 'skipIpo': case 'skipPick': case 'passCircuitBreaker': case 'callClose':
    case 'skipEtf': case 'auctionPass': case 'closeMarketOpenWindow': case 'endTurn':
      return true;
    case 'buy': case 'skipStock': case 'marginSell': case 'forcedSell':
    case 'doShort': case 'pickKnownIpo': case 'pickTarget': case 'playCircuitBreaker':
    case 'buyEtf':
      return text('code');
    case 'sell':
      return text('code') && (action.qty === undefined || (integer('qty') && (action.qty as number) > 0));
    case 'draw':
      return action.deck === 'ME' || action.deck === 'FED';
    case 'proposeP2POffer':
      return integer('from') && integer('to') && text('code') && integer('qty')
        && (action.qty as number) > 0 && (action.direction === 'sell' || action.direction === 'buy')
        && nonNegativeNumber('price');
    case 'acceptP2POffer': case 'declineP2POffer': case 'cancelP2POffer':
      return integer('id') && (action.id as number) >= 0;
    case 'auctionBid':
      return nonNegativeNumber('amount');
    default:
      return false;
  }
}

export const STORAGE_KEY = 'exchange_3d_state';
export const COMMAND_KEY = 'exchange_3d_cmd';
export const COMMAND_PREFIX = `${COMMAND_KEY}:`;

type CommandStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'removeItem'>;

/** Consume the oldest queued 3D command. The legacy single-slot key remains a
    fallback for boards opened from an older cached HTML bundle. */
export function takeNextBoard3DCommand(storage: CommandStorage): unknown {
  const queuedKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(COMMAND_PREFIX)) queuedKeys.push(key);
  }
  queuedKeys.sort();
  const key = queuedKeys[0] ?? (storage.getItem(COMMAND_KEY) ? COMMAND_KEY : null);
  if (!key) return null;
  const raw = storage.getItem(key);
  storage.removeItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

export function sync3dBoard(payload: Board3DPayload): void {
  const json = JSON.stringify(payload);
  localStorage.setItem(STORAGE_KEY, json);
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: json }));
  } catch { /* non-critical */ }
}
