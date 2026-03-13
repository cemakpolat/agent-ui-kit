import {
  MockAgentBridge,
  WebSocketAgentBridge,
  SSEAgentBridge,
  MCPAgentBridge,
  buildCapabilityManifest,
} from '@hari/core';
import type { AgentBridge } from '@hari/core';
import {
  makeIotMutator,
  makeCloudopsMutator,
  makeTravelMutator,
} from '../scenarios/live-mutations';

// ─────────────────────────────────────────────────────────────────────────────
// Transport & configuration constants extracted from App.tsx
// ─────────────────────────────────────────────────────────────────────────────

export type TransportType = 'mock' | 'websocket' | 'sse' | 'mcp';

const REGISTERED_DOMAINS = ['travel', 'cloudops', 'iot', 'reports', 'deployment', 'product-analytics', 'engineering', 'hr', 'support', 'incident', 'collab', 'logistics'];
const REGISTERED_INTENT_TYPES = ['comparison', 'diagnostic_overview', 'sensor_overview', 'document', 'form', 'timeline', 'workflow', 'kanban', 'calendar', 'tree', 'chat', 'diagram', 'map'];

export const capabilityManifest = buildCapabilityManifest(REGISTERED_DOMAINS, REGISTERED_INTENT_TYPES);

export const LIVE_MUTATORS: Record<string, (() => (intent: import('@hari/core').IntentPayload) => import('@hari/core').IntentPayload) | undefined> = {
  iot: makeIotMutator, cloudops: makeCloudopsMutator, travel: makeTravelMutator,
};
export const LIVE_UPDATE_INTERVAL_MS = 2000;

const TRANSPORT_DEFAULTS: Record<TransportType, string> = {
  mock: 'N/A', websocket: 'ws://localhost:3001', sse: 'http://localhost:3002', mcp: 'ws://localhost:3003',
};

export function createBridge(transportType: TransportType, config?: Record<string, string>): AgentBridge {
  switch (transportType) {
    case 'websocket': return new WebSocketAgentBridge({ url: config?.websocketUrl || TRANSPORT_DEFAULTS.websocket });
    case 'sse': { const u = config?.sseUrl || TRANSPORT_DEFAULTS.sse; return new SSEAgentBridge({ streamUrl: u, sendUrl: u }); }
    case 'mcp': return new MCPAgentBridge({ url: config?.mcpUrl || TRANSPORT_DEFAULTS.mcp });
    default: return new MockAgentBridge({ connectLatencyMs: 150, roundtripLatencyMs: 400 });
  }
}

export function getDefaultTransport(): TransportType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env?.VITE_TRANSPORT || 'mock';
  return (['mock', 'websocket', 'sse', 'mcp'].includes(env) ? env : 'mock') as TransportType;
}
