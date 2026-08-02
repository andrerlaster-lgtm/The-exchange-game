export interface Player3DState {
  pos: number;
  piece: string;
  color: string;
  name: string;
}

export interface CardPreview {
  deck: string;        // 'ME' | 'FED' | 'AH'
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
  stepDiff: number;      // current step − starting step (signed)
}

/** Live per-stock price snapshot for board tiles/tooltips. */
export interface PriceInfo3D {
  p: number;        // current dollar price
  d: -1 | 0 | 1;    // direction vs printed starting step
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
  currentPlayerIdx: number;
  leaderboard: LBEntry[];
  card: CardPreview | null;
  pendingDraw: string | null;
  canEndTurn: boolean;
  tradeInfo: TradeInfo3D | null;
  prices: Record<string, PriceInfo3D>;
  /** Human-readable reason End Turn is blocked by a prompt only visible in the 2D view. */
  blockedHint: string | null;
  /** Most recent draw event; seq is unique per draw so the 3D board animates once. */
  drawEvent: { deck: string; title: string; seq: number } | null;
  /** Cards remaining per deck (IPO = unrevealed listings). */
  deckCounts: { ME: number; FED: number; AH: number; IPO: number };
}

export interface Board3DCommand {
  t: 'roll' | 'draw' | 'endTurn' | 'buyStock' | 'sellStock';
  deck?: string;
  code?: string;
  qty?: number;
  ts: number;
}

export const STORAGE_KEY = 'exchange_3d_state';
export const COMMAND_KEY = 'exchange_3d_cmd';

export function sync3dBoard(payload: Board3DPayload): void {
  const json = JSON.stringify(payload);
  localStorage.setItem(STORAGE_KEY, json);
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: json }));
  } catch { /* non-critical */ }
}
