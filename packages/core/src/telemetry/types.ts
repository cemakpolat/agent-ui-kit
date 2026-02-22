// ─────────────────────────────────────────────────────────────────────────────
// TelemetryEvent — Typed event union for HARI runtime instrumentation.
//
// Events are emitted by useAgentBridge (bridge lifecycle + intent flow) and
// by host-app callbacks (action execution, what-if queries, explain panels).
//
// The union is discriminated on `type` so consumers can narrow with a switch.
// ─────────────────────────────────────────────────────────────────────────────

/** Bridge became fully connected (handshake complete). */
interface BridgeConnectedEvent {
  type: 'bridge:connected';
  /** Class name of the transport, e.g. 'MockAgentBridge'. */
  transportType?: string;
  /** Wall-clock time from connect() call to connected state (ms). */
  latencyMs?: number;
}

/** Bridge connection was closed (either cleanly or after exhausting retries). */
interface BridgeDisconnectedEvent {
  type: 'bridge:disconnected';
  reason?: string;
}

/** Bridge is attempting to re-establish a dropped connection. */
interface BridgeReconnectingEvent {
  type: 'bridge:reconnecting';
  attempt: number;
}

/** Agent delivered a new IntentPayload. */
interface IntentReceivedEvent {
  type: 'intent:received';
  domain: string;
  intentType: string;
  confidence: number;
  ambiguityCount: number;
  actionCount: number;
}

/** User committed a parameter modification and it was dispatched to the bridge. */
interface IntentModifiedEvent {
  type: 'intent:modified';
  /** IDs of the controls that changed. */
  controlIds: string[];
  domain: string;
  intentType: string;
}

/** User fired a what-if query. */
interface WhatIfQueriedEvent {
  type: 'whatif:queried';
  query: string;
  domain?: string;
}

/** Agent returned a what-if result. */
interface WhatIfResolvedEvent {
  type: 'whatif:resolved';
  /** Round-trip latency from query to result (ms). */
  latencyMs: number;
  deltaCount: number;
  confidence?: number;
}

/** User clicked an action button (first tap for two-step, or direct execute). */
interface ActionExecutedEvent {
  type: 'action:executed';
  actionId: string;
  /** 'low' | 'medium' | 'high' — from the action's blastRadius */
  riskLevel?: string;
  domain?: string;
}

/** User confirmed a two-step action after the countdown/delay. */
interface ActionConfirmedEvent {
  type: 'action:confirmed';
  actionId: string;
}

/** User dismissed the confirmation prompt for a two-step action. */
interface ActionCancelledEvent {
  type: 'action:cancelled';
  actionId: string;
}

/** User opened an explain panel for an explainability element. */
interface ExplainOpenedEvent {
  type: 'explain:opened';
  elementId: string;
}

export type TelemetryEvent =
  | BridgeConnectedEvent
  | BridgeDisconnectedEvent
  | BridgeReconnectingEvent
  | IntentReceivedEvent
  | IntentModifiedEvent
  | WhatIfQueriedEvent
  | WhatIfResolvedEvent
  | ActionExecutedEvent
  | ActionConfirmedEvent
  | ActionCancelledEvent
  | ExplainOpenedEvent;

export type TelemetryEventType = TelemetryEvent['type'];
