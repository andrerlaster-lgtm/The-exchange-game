import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  style?: CSSProperties;
  accent?: string;
}

export default function Panel({ children, style, accent }: Props) {
  return (
    <div
      className="card-box"
      style={{ borderColor: accent, ...style }}
    >
      {children}
    </div>
  );
}
