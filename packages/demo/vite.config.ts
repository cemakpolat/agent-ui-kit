import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hari/core': resolve(__dirname, '../core/src/index.ts'),
      '@hari/ui': resolve(__dirname, '../ui/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
