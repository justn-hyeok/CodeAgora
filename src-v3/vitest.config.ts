import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    poolMatchGlobs: [
      ['**/e2e-*.test.ts', 'forks'],
    ],
  },
});
