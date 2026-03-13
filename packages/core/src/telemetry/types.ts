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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 8.3 — Governance Observability Events
//
// These events power the GovernanceMetrics aggregator and ultimately feed
// Grafana-compatible dashboards for decision latency analysis and authority
// mode transition heatmaps.
// ─────────────────────────────────────────────────────────────────────────────

/** Human authority mode changed (emitted on every transition). */
interface AuthorityModeChangedEvent {
  type: 'governance:authority_changed';
  /** Viewer/session identifier */
  holderId: string;
  fromMode: string;
  toMode: string;
  /** Escalation direction: 'up' | 'down' */
  direction: 'up' | 'down';
  reason: string;
  /** Governance domain context (e.g. 'deployment', 'finance') */
  domain?: string;
  timestamp: string;
}

/** A governed action was presented to a human for review. */
interface GovernedActionPresentedEvent {
  type: 'governance:action_presented';
  actionId: string;
  requiredAuthority: string;
  reversibility: string;
  preconditionCount: number;
  metPreconditions: number;
  domain?: string;
  timestamp: string;
}

/** A governed action was approved by a human. */
interface GovernedActionApprovedEvent {
  type: 'governance:action_approved';
  actionId: string;
  approverId: string;
  approverAuthority: string;
  /** Time from presentation to approval (ms) — decision latency */
  deliberationMs: number;
  domain?: string;
  timestamp: string;
}

/** A governed action was rejected by a human. */
interface GovernedActionRejectedEvent {
  type: 'governance:action_rejected';
  actionId: string;
  rejectorId: string;
  reason: string;
  /** Time from presentation to rejection (ms) */
  deliberationMs: number;
  domain?: string;
  timestamp: string;
}

/** A precondition was waived (requires override authority). */
interface PreconditionWaivedEvent {
  type: 'governance:precondition_waived';
  actionId: string;
  preconditionDescription: string;
  waivedBy: string;
  waiverAuthority: string;
  justification?: string;
  timestamp: string;
}

/** A governance marketplace item was imported (pattern, template, or hierarchy). */
interface MarketplaceItemImportedEvent {
  type: 'governance:marketplace_imported';
  itemType: 'pattern' | 'template' | 'hierarchy';
  itemId: string;
  itemName: string;
  timestamp: string;
}

/** AI suggested preconditions for an action. */
interface AIGovernanceSuggestionEvent {
  type: 'governance:ai_suggestion';
  actionDescription: string;
  suggestedCount: number;
  acceptedCount: number;
  /** Which AI provider was used (e.g. 'ollama/llama3.2') */
  provider: string;
  latencyMs: number;
  timestamp: string;
}

/** AI generated a justification summary for a governance decision. */
interface AIJustificationGeneratedEvent {
  type: 'governance:ai_justification';
  decisionId: string;
  provider: string;
  latencyMs: number;
  timestamp: string;
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
  | ExplainOpenedEvent
  // Phase 8.3 — Governance events
  | AuthorityModeChangedEvent
  | GovernedActionPresentedEvent
  | GovernedActionApprovedEvent
  | GovernedActionRejectedEvent
  | PreconditionWaivedEvent
  | MarketplaceItemImportedEvent
  | AIGovernanceSuggestionEvent
  | AIJustificationGeneratedEvent;

export type TelemetryEventType = TelemetryEvent['type'];
