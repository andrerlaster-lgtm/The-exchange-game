/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// The balance simulation runs hundreds of full games and takes minutes, so it
// is deliberately kept out of the normal `vitest run` include glob. Run it with
// `npm run sim` when tuning the market model's basis-point constants.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/simulation/**/*.sim.ts'],
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
