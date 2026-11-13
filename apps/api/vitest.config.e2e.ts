import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Isolated, throwaway state: in-memory database, no login configured (loopback is open).
    env: {
      DATABASE_PATH: ':memory:',
      ADMIN_PASSWORD: '',
      ADMIN_PASSWORD_HASH: '',
      API_TOKEN: '',
    },
  },
});
