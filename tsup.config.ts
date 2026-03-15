import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  outDir: 'src/dist',
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
