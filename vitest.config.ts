import { defineConfig } from 'vitest/config';

// Unit tests only: pure functions in src/lib and src/i18n, and the generator
// scripts. Nothing here needs Astro, a browser or the network.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
