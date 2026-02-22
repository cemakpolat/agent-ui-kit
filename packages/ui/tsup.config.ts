import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // JSX handled by tsup's built-in esbuild transform
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
  external: ['react', 'react-dom', '@hari/core'],
  outDir: 'dist',
});
