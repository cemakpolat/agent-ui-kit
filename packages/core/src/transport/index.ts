export type {
  AgentBridge,
  AgentBridgeEvents,
  AgentBridgeEventName,
  AgentBridgeListener,
  ConnectionState,
  WhatIfQuery,
  WhatIfDelta,
  WhatIfResult,
  ReconnectOptions,
  TransportOptions,
} from './types';

export { MockAgentBridge } from './mock';
export type { MockTransportOptions } from './mock';

export { WebSocketAgentBridge } from './websocket';
export type { WebSocketTransportOptions } from './websocket';

export { SSEAgentBridge } from './sse';
export type { SSETransportOptions } from './sse';

export {
  parseNdjsonLine,
  splitNdjsonBuffer,
  NdjsonStreamParser,
  streamNdjson,
} from './streaming';
export type { NdjsonChunkResult } from './streaming';

export { adaptIntentPayload, adaptWithVersionCheck } from './adapter';
export type { RawPayload, AdaptResult } from './adapter';

export { MCPAgentBridge } from './mcp';
export type { MCPTransportOptions } from './mcp';

// Phase 5.1: Governance Agent Bridge
export { GovernanceAgentBridge } from './governance-bridge';
export type {
  GovernanceBridgeOptions,
  GovernanceBridgeEvents,
  GovernanceCheckResult,
} from './governance-bridge';
