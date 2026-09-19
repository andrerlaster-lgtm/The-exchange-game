export function money(v: number): string {
  return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
}

/** Signed percentage for a price move, e.g. `+5.0%` / `-10.0%`. */
export function pct(v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(1)}%`;
}
