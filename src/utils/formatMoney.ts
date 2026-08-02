export function money(v: number): string {
  return (v < 0 ? '-$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
}
