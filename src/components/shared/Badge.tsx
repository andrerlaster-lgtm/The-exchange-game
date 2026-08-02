import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  color?: string;
  bg?: string;
  style?: CSSProperties;
}

export default function Badge({ children, color, bg, style }: Props) {
  return (
    <span
      className="tag"
      style={{ color, background: bg, ...style }}
    >
      {children}
    </span>
  );
}
