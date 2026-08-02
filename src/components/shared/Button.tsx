import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'primary' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

export default function Button({ variant = 'default', size = 'md', style, ...rest }: Props) {
  const cls = variant === 'primary' ? 'primary' : variant === 'danger' ? 'danger' : '';
  const pad = size === 'sm' ? '3px 8px' : undefined;
  const fs = size === 'sm' ? 11 : undefined;
  return <button className={cls} style={{ padding: pad, fontSize: fs, ...style }} {...rest} />;
}
