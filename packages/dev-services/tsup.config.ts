import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/agent.ts',
    'src/scenarios.ts',
    'src/ws-server.ts',
    'src/sse-server.ts',
    'src/mcp-server.ts',
    'src/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
});
