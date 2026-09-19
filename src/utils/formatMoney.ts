export function money(v: number): string {
  return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
}

/** Signed percentage, e.g. `+5.0%` / `-10.0%`. Used for returns and yields. */
export function pct(v: number): string {
  return `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.abs(v).toFixed(1)}%`;
}

/** Signed basis points for a percentage, e.g. `+500 bp` for +5%. */
export function bp(pctValue: number): string {
  const n = Math.round(pctValue * 100);
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toLocaleString('en-US')} bp`;
}

/**
 * A price move as a percentage with its basis points, e.g. `-5.0% (-500 bp)`.
 * Price moves come from basis-point rules, so wherever a MOVE is shown both
 * units appear. Returns and yields (not moves) stay as plain percentages.
 */
export function pctBp(pctValue: number): string {
  return `${pct(pctValue)} (${bp(pctValue)})`;
}

/** An unsigned move size for rules text, e.g. `5% (500 bp)`. */
export function moveSize(basisPoints: number): string {
  const b = Math.abs(basisPoints);
  return `${b / 100}% (${b.toLocaleString('en-US')} bp)`;
}
