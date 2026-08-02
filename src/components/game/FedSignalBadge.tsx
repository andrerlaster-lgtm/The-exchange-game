import { fedSignalForStock } from '../../engine';
import type { GameState } from '../../engine';

interface Props {
  s: GameState;
  code: string;
  compact?: boolean;
  dark?: boolean;
}

const COLORS = {
  tailwind: { fg: '#15803d', bg: 'rgba(34,197,94,0.14)', border: 'rgba(34,197,94,0.36)', icon: '▲' },
  headwind: { fg: '#b91c1c', bg: 'rgba(239,68,68,0.13)', border: 'rgba(239,68,68,0.34)', icon: '▼' },
  mixed: { fg: '#9a6700', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.38)', icon: '↕' },
  neutral: { fg: '#746858', bg: 'rgba(116,104,88,0.10)', border: 'rgba(116,104,88,0.24)', icon: '—' },
};

export default function FedSignalBadge({ s, code, compact = false, dark = false }: Props) {
  const signal = fedSignalForStock(s, code);
  const colors = COLORS[signal.tone];
  const text = compact
    ? signal.tone === 'neutral'
      ? 'Fed —'
      : `Fed ${colors.icon}${Math.abs(signal.net) || ''}`
    : `${colors.icon} ${signal.label}`;
  const title = signal.lastTitle
    ? `${signal.label} across the last three Fed decisions. Latest: ${signal.lastTitle}.`
    : 'No Fed decision has been drawn yet.';

  return (
    <span
      aria-label={`${code}: ${signal.label}`}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 'fit-content', whiteSpace: 'nowrap',
        borderRadius: 999, border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: dark && signal.tone === 'neutral' ? 'rgba(235,225,207,0.66)' : colors.fg,
        padding: compact ? '1px 5px' : '4px 8px',
        fontSize: compact ? 8 : 10,
        fontWeight: 900, letterSpacing: compact ? 0.2 : 0.55,
        textTransform: 'uppercase',
      }}
    >
      {text}
    </span>
  );
}
