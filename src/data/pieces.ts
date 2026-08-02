export interface Piece {
  key: string;
  label: string;
  emoji: string;
}

export const PIECES: Piece[] = [
  { key: 'bull',   label: 'Bull',        emoji: '🐂' },
  { key: 'bear',   label: 'Bear',        emoji: '🐻' },
  { key: 'bill',   label: 'Money Bill',  emoji: '💵' },
  { key: 'laptop', label: 'Laptop',      emoji: '💻' },
  { key: 'calc',   label: 'Calculator',  emoji: '🧮' },
  { key: 'vault',  label: 'Vault',       emoji: '🏦' },
];

export const PIECE_BY_KEY: Record<string, Piece> = Object.fromEntries(PIECES.map(p => [p.key, p]));

export const DEFAULT_PIECES = PIECES.map(p => p.key);
