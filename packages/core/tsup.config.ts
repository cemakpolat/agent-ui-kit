import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // External dependencies — consumers bring their own React and Zod
  external: ['react', 'react-dom', 'zod', 'zustand', 'immer'],
  outDir: 'dist',
});
