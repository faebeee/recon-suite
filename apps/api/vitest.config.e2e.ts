import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Isolated, throwaway state: in-memory database, and defaults that a local apps/api/.env
    // must not override (the tests check the SSRF guard).
    env: { DATABASE_PATH: ':memory:' },
  },
});
