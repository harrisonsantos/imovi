import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // PGlite initializes a Postgres WASM instance per test. Bound resource use
    // without increasing deadlines or skipping assertions.
    maxWorkers: 1,
    minWorkers: 1,
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/*.config.*',
        '**/tests/__fixtures__/**',
      ],
    },
  },
});
