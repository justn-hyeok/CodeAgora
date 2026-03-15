import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    poolMatchGlobs: [
      ['**/e2e-*.test.ts', 'forks'],
    ],
  },
});
