import path from 'node:path'

import { defineConfig } from 'vitest/config'

// Standalone vitest config for the lint-rule smoke tests. The default
// vitest.config.ts at the project root only includes `src/**/*.test.{ts,tsx}`;
// these tests live outside src/ on purpose so they don't get bundled with the
// application tests. Run with `npx vitest run --config tests-lint/vitest.config.ts`.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['tests-lint/**/*.test.ts'],
    // The Node ESLint API needs more than the default 5s on a cold worker.
    testTimeout: 30_000,
  },
})
