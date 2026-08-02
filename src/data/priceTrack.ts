// The 12-step price ladder shared by all stocks and IPOs.
export const LADDER: readonly number[] = [
  100, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000,
];

export function ladderStep(price: number): number {
  const i = LADDER.indexOf(price);
  if (i < 0) throw new Error(`price ${price} is not on the ladder`);
  return i;
}
