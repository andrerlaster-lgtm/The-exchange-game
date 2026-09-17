/** Convert a percent value (e.g. 5 for "5%") to basis points (1 bp = 0.01%). */
export function toBps(percent: number): number {
  return Math.round(percent * 100);
}
