import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests only — the e2e/ directory is Playwright, not Vitest.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
