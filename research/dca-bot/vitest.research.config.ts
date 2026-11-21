import { defineConfig } from 'vitest/config';

// Only for research/dca-bot/calculator_check.test.ts; see the header of that file.
export default defineConfig({
  test: {
    include: ['research/dca-bot/calculator_check.test.ts'],
    environment: 'node',
  },
});
